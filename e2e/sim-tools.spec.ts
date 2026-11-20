import { expect, test, type Page } from "@playwright/test";

const errors = (page: Page) => {
  const list: string[] = [];
  page.on("pageerror", (e) => list.push(e.message));
  return list;
};
const noHorizontalScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

test("ECG OS: loads, 3D heart ready, rhythm + HeartSim API", async ({ page }) => {
  const errs = errors(page);
  await page.goto("/tools/ecg-os");
  await expect(page.getByRole("heading", { name: "ECG OS" })).toBeVisible();
  await expect(page.getByText("not clinically validated").first()).toBeVisible();
  await expect(page.getByTestId("heart-3d")).toHaveAttribute("data-state", "ready", { timeout: 60_000 });
  expect(await noHorizontalScroll(page)).toBe(true);

  // API exists and feeds the engine
  const r = await page.evaluate(() => {
    const api = window.HeartSim!;
    return { bpm: api.setBPM(100), af: api.setRhythm("AF"), tach: api.setRhythm("sinus tachycardia"), keys: Object.keys(api) };
  });
  expect(r.keys).toEqual(expect.arrayContaining(["setBPM", "setRhythm", "setChamberState"]));
  expect(r.af.ok).toBe(false); // AF is phase 2: never faked
  expect(r.bpm).toBe(100);

  // rhythm dropdown disables AF/VT
  const opts = await page.getByTestId("heart-rhythm").locator("option").evaluateAll((os) => os.map((o) => ({ t: o.textContent, d: (o as HTMLOptionElement).disabled })));
  expect(opts.some((o) => /atrial fib/i.test(o.t ?? "") && o.d)).toBe(true);
  expect(opts.some((o) => /ventricular tach/i.test(o.t ?? "") && o.d)).toBe(true);

  // manual override is a labelled override
  await page.evaluate(() => window.HeartSim!.setChamberState({ lv: 0.9 }));
  await expect(page.getByText("Manual override").first()).toBeVisible();
  await page.getByTestId("override-clear").dispatchEvent("click"); // the control re-renders on every sim tick, so skip the actionability "stable" wait
  await expect(page.getByTestId("override-clear")).toHaveCount(0);
  expect(errs).toEqual([]);
});

test("Ventilator OS: loads, 3D lungs ready, LungSim API, old route redirects", async ({ page }) => {
  const errs = errors(page);
  const res = await page.goto("/tools/ventilator");
  expect(page.url()).toContain("/tools/ventilator-os");
  expect(res?.ok()).toBe(true);
  await expect(page.getByRole("heading", { name: "Ventilator OS" })).toBeVisible();
  await expect(page.getByText("not clinically validated").first()).toBeVisible();
  await expect(page.getByTestId("lung-3d")).toHaveAttribute("data-state", "ready", { timeout: 60_000 });
  expect(await noHorizontalScroll(page)).toBe(true);

  const out = await page.evaluate(() => {
    const api = window.LungSim!;
    const a = api.setVentilator({ vt: 450, peep: 10, rr: 16, fio2: 60, ieRatio: "1:2" });
    api.setLobeExpansion({ rul: 0.35, rml: 0.35, rll: 0.35 });
    return { a, t: api.getTelemetry() };
  });
  expect(out.a.ok).toBe(true);
  expect(out.t.peepSet).toBe(10);
  expect(out.t.pplat).toBeNull(); // plateau is only reported after an inspiratory hold

  await page.getByTestId("lung-mode").selectOption("one-lung");
  await expect(page.getByTestId("lung-mode-note")).toContainText("one-lung");
  expect(errs).toEqual([]);
});

test("old Ventilator playground name is gone from Tools and search", async ({ page }) => {
  await page.goto("/tools");
  await expect(page.getByText("Ventilator OS").first()).toBeVisible();
  await expect(page.getByText("ECG OS").first()).toBeVisible();
  await expect(page.getByText("Ventilator playground")).toHaveCount(0);
});
