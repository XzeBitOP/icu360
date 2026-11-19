// node scripts/sim/media.mjs  -> /workspace/icu360-screens/sim/*
import { chromium } from "@playwright/test";
const OUT = "/workspace/icu360-screens/sim";
const BASE = "http://localhost:3200";
const sizes = { m: [390, 844], d: [1440, 900] };
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
async function open(path, tid, key) {
  const [w, h] = sizes[key];
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: key === "m" ? 2 : 1 });
  const p = await ctx.newPage();
  await p.goto(BASE + path, { waitUntil: "load" });
  await p.waitForSelector(`[data-testid=${tid}][data-state=ready]`, { timeout: 90000 });
  await p.waitForTimeout(1500);
  return { p, ctx };
}
async function focusFrame(p, tid, key) {
  await p.evaluate(({ tid, key }) => {
    const f = document.querySelector(`[data-testid=${tid}]`);
    const r = f.getBoundingClientRect();
    window.scrollBy(0, r.top - (key === "m" ? 12 : 90));
  }, { tid, key });
  await p.waitForTimeout(600);
}
const shot = (p, name) => p.screenshot({ path: `${OUT}/${name}.png` });
async function seek(p, ms) { await p.evaluate((ms) => { const el = document.querySelector("[data-testid=scrub]"); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, String(ms)); el.dispatchEvent(new Event("input", { bubbles: true })); }, ms); await p.waitForTimeout(60); }
const chip = (p, text) => p.getByRole("button", { name: text, exact: true });

for (const key of ["m", "d"]) {
  // ---- heart
  let { p, ctx } = await open("/tools/ecg-os", "heart-3d", key);
  await focusFrame(p, "heart-3d", key);
  await shot(p, `heart-default-${key}`);
  await chip(p, "Conduction").click().catch(() => console.log("no Conduction chip"));
  await p.waitForTimeout(900); await shot(p, `heart-conduction-${key}`);
  await chip(p, "Conduction").click().catch(() => {});
  await chip(p, "Labels").click().catch(() => console.log("no Labels chip"));
  await p.waitForTimeout(700); await shot(p, `heart-labels-${key}`);
  await chip(p, "Labels").click().catch(() => {});
  // hover
  const fr = await p.locator("[data-testid=heart-3d]").boundingBox();
  let hovered = false;
  for (const [fx, fy] of [[0.55, 0.55], [0.45, 0.55], [0.6, 0.45], [0.5, 0.65], [0.4, 0.45], [0.55, 0.35]]) {
    await p.mouse.move(fr.x + fr.width * fx, fr.y + fr.height * fy, { steps: 4 });
    await p.waitForTimeout(400);
    if (await p.locator(".sim3d-tip").evaluate((e) => getComputedStyle(e).display !== "none" && e.textContent.length > 2).catch(() => false)) { hovered = true; break; }
  }
  console.log(key, "heart hover tooltip:", hovered);
  await shot(p, `heart-hover-tooltip-${key}`);
  await ctx.close();

  // ---- lung
  ({ p, ctx } = await open("/tools/ventilator-os", "lung-3d", key));
  await focusFrame(p, "lung-3d", key);
  const lungShots = [[null, "end-inspiration", "end-expiration"], ["ards", "ards"], ["copd", "copd"], ["one-lung", "right-lung-collapse"]];
  for (const [mode, ...names] of lungShots) {
    if (mode) await p.locator("[data-testid=lung-mode]").selectOption(mode);
    await p.locator("[data-testid=speed]").selectOption({ index: 3 }).catch(() => {});
    await p.waitForFunction(() => window.LungSim.getState().timeMs > 14000, null, { timeout: 120000, polling: 500 });
    await p.locator("[data-testid=lung-play]").click(); // pause
    await p.waitForTimeout(300);
    const cand = [];
    for (let t = 5000; t <= 13000; t += 100) { await seek(p, t); const s = await p.evaluate(() => window.LungSim.getState()); cand.push([t, s.volumeL]); }
    const hi = cand.reduce((m, c) => (c[1] > m[1] ? c : m)); const lo = cand.filter(c => c[0] >= hi[0] - 4000 && c[0] <= hi[0] + 4000).reduce((m, c) => (c[1] < m[1] ? c : m));
    console.log(key, mode, "insp t", hi, "exp t", lo);
    for (const n of names) { await seek(p, n === "end-expiration" ? lo[0] : hi[0]); await p.waitForTimeout(500); await shot(p, `lung-${n}-${key}`); }
    await p.locator("[data-testid=lung-play]").click(); // resume
  }
  await ctx.close();
}

// ---- clips: deterministic frame-by-frame capture (seek the engine, screenshot the 3D frame), stitched with ffmpeg
import { mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
for (const [path, tid, name, play] of [["/tools/ecg-os", "heart-3d", "heart-beating", "heart-play"], ["/tools/ventilator-os", "lung-3d", "lung-breathing", "lung-play"]]) {
  const ctx = await b.newContext({ viewport: { width: 1000, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(BASE + path, { waitUntil: "load" });
  await p.waitForSelector(`[data-testid=${tid}][data-state=ready]`, { timeout: 90000 });
  await p.evaluate((tid) => { const f = document.querySelector(`[data-testid=${tid}]`); window.scrollBy(0, f.getBoundingClientRect().top - 40); }, tid);
  await p.waitForFunction(() => document.querySelector("[data-testid=scrub]") && Number(document.querySelector("[data-testid=scrub]").max) > 9000, null, { timeout: 120000, polling: 500 });
  await p.locator(`[data-testid=${play}]`).click();
  const dir = `${OUT}/frames-${name}`; rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const fps = 15, n = fps * 6;
  const frame = p.locator(`[data-testid=${tid}]`);
  for (let i = 0; i < n; i++) { await seek(p, 3000 + Math.round((i * 1000) / fps)); await frame.screenshot({ path: `${dir}/f${String(i).padStart(3, "0")}.png` }); }
  execFileSync("/usr/bin/ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", `${dir}/f%03d.png`, "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p", "-c:v", "libx264", "-crf", "20", "-movflags", "+faststart", `${OUT}/${name}.mp4`]);
  rmSync(dir, { recursive: true, force: true });
  await ctx.close();
}
await b.close();
