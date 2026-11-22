import { expect, test, type Page } from "@playwright/test";

/** AI tutor UI with /api/ai mocked (no real model calls in CI). Captures what each page sends. */
async function mockAi(page: Page) {
  const sent: { action: string; kind: string; title: string; context: string; question?: string }[] = [];
  await page.route("**/api/ai", async (route) => {
    sent.push(JSON.parse(route.request().postData() ?? "{}"));
    await route.fulfill({ status: 200, headers: { "Content-Type": "text/plain; charset=utf-8", "X-RateLimit-Remaining": "19" }, body: "- **Mocked** answer one\n- Mocked answer two" });
  });
  return sent;
}

const DISCLAIMER = "AI explanation for learning only. Not for bedside decisions. Verify with the references.";

test("algorithm: AI summarises only that algorithm's text; follow-up works", async ({ page }) => {
  const sent = await mockAi(page);
  await page.goto("/m/fluids-electrolytes/hyperkalaemia#algorithm");
  await page.getByTestId("ai-algorithm").click();
  const sheet = page.getByTestId("ai-sheet");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByTestId("ai-answer")).toContainText("Mocked answer two");
  await expect(sheet.getByTestId("ai-disclaimer")).toHaveText(DISCLAIMER);
  await expect(sheet.getByText("Don't type patient names")).toBeVisible();
  expect(sent[0]).toMatchObject({ action: "summarise", kind: "algorithm" });
  expect(sent[0].context).toMatch(/^Algorithm: Hyperkalaemia/);
  expect(sent[0].context).toContain("Urgent dialysis");
  await sheet.getByRole("button", { name: "Explain in more detail" }).click();
  await expect.poll(() => sent.length).toBe(2);
  expect(sent[1].action).toBe("explain");
  await sheet.getByTestId("ai-followup").fill("Why calcium first?");
  await sheet.getByRole("button", { name: "Send" }).click();
  await expect.poll(() => sent.length).toBe(3);
  expect(sent[2]).toMatchObject({ action: "followup", question: "Why calcium first?" });
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
});

test("daily quiz: 'Why was I wrong?' sends stem, options, choice and answer", async ({ page }) => {
  const sent = await mockAi(page);
  await page.goto("/quiz");
  const opts = page.locator("ul li button");
  await opts.first().waitFor();
  // pick options until one is wrong (the wrong-answer state shows the button)
  await opts.nth(3).click();
  const why = page.getByTestId("ai-why-wrong");
  const more = page.getByTestId("ai-quiz-explain");
  await expect(why.or(more)).toBeVisible();
  if (await why.count()) {
    await why.click();
    expect(sent[0].action).toBe("why_wrong");
    expect(sent[0].context).toContain("Learner's answer: D)");
  } else {
    await more.click();
    expect(sent[0].action).toBe("explain");
  }
  expect(sent[0].context).toMatch(/Question: .+/);
  expect(sent[0].context).toContain("Correct answer:");
  expect(sent[0].context).toContain("Explanation:");
});

test("news, calculator and ABG have AI buttons with their own text", async ({ page }) => {
  const sent = await mockAi(page);
  await page.goto("/news");
  await page.getByTestId("ai-news").first().click();
  await expect(page.getByTestId("ai-answer")).toContainText("Mocked");
  expect(sent[0].kind).toBe("news");
  expect(sent[0].context).toContain("Source:");
  await page.keyboard.press("Escape");

  await page.goto("/tools/gcs");
  await page.getByTestId("ai-calculator").click();
  await expect.poll(() => sent.length).toBe(2);
  expect(sent[1]).toMatchObject({ kind: "calculator", action: "explain_state" });
  expect(sent[1].context).toContain("Current inputs:");
  await page.keyboard.press("Escape");

  await page.goto("/tools/abg");
  await page.getByTestId("ai-abg").click();
  await expect.poll(() => sent.length).toBe(3);
  expect(sent[2].kind).toBe("abg");
  expect(sent[2].context).toContain("Interpretation:");
});

test("ECG OS and Ventilator OS: 'Explain this' sends the live sim state as text", async ({ page }) => {
  const sent = await mockAi(page);
  await page.goto("/tools/ecg-os");
  await page.getByTestId("ai-ecg").dispatchEvent("click");
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0]).toMatchObject({ kind: "ecg", action: "explain_state" });
  expect(sent[0].context).toContain("Rhythm/condition:");
  expect(sent[0].context).toMatch(/Measured: heart rate \d+/);
  await page.keyboard.press("Escape");

  await page.goto("/tools/ventilator-os");
  await page.getByTestId("ai-vent").dispatchEvent("click");
  await expect.poll(() => sent.length).toBe(2);
  expect(sent[1]).toMatchObject({ kind: "ventilator", action: "explain_state" });
  expect(sent[1].context).toContain("Mode: VC-A/C");
  expect(sent[1].context).toContain("Settings:");
});

test("friendly error when the AI is busy", async ({ page }) => {
  await page.route("**/api/ai", (route) => route.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ error: "The free AI model is busy right now. Please try again in a minute." }) }));
  await page.goto("/learn/ventilator");
  await page.getByTestId("ai-guide").first().click();
  await expect(page.getByTestId("ai-answer")).toHaveAttribute("data-status", "error");
  await expect(page.getByTestId("ai-answer")).toContainText("busy right now");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});
