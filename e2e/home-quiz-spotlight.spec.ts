import { expect, test } from "@playwright/test";

test("Daily Quiz spotlight is the first section on Home, with streak, countdown and topic of the week", async ({ page }) => {
  await page.goto("/");
  const spot = page.locator('[data-testid="quiz-spotlight"]:visible');
  await expect(spot).toHaveCount(1);
  await expect(spot.getByTestId("quiz-streak")).toHaveText(/🔥\s*Start your streak/);
  await expect(spot.getByTestId("quiz-countdown")).toHaveText(/^\d{2}:\d{2}:\d{2}$/);
  await expect(spot.getByTestId("topic-of-week")).toContainText(/topic of the week|Editor's pick this week/i);
  await expect(spot.getByRole("link", { name: /today's quiz/i })).toHaveAttribute("href", "/quiz");

  // first section in the main column: nothing visible sits above it inside <main>
  const box = await spot.boundingBox();
  const main = page.locator("main:visible").first();
  const firstChildTop = await main.evaluate((m) => (m.firstElementChild as HTMLElement).getBoundingClientRect().top);
  expect(box && Math.abs(box.y - firstChildTop) < 2).toBeTruthy();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("streak shows the stored count from the device", async ({ page }) => {
  await page.addInitScript(() => {
    const d = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    localStorage.setItem("icu360:v1", JSON.stringify({ v: 1, opened: {}, quiz: {}, saved: [], daily: { history: { [d]: { score: 4, total: 5 } }, streak: 4, best: 4, last: d } }));
  });
  await page.goto("/");
  const spot = page.locator('[data-testid="quiz-spotlight"]:visible');
  await expect(spot.getByTestId("quiz-streak")).toHaveText(/🔥\s*4-day streak/);
  await expect(spot).toContainText("Today's quiz done");
});

test("360px phone: no horizontal overflow with the spotlight", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/");
  await expect(page.locator('[data-testid="quiz-spotlight"]:visible')).toHaveCount(1);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
