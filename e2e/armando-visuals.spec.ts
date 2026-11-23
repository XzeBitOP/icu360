import { expect, test } from "@playwright/test";

/** Armando Hasudungan "Visual explanation" card: credit visible, iframe only after tap, /credits page. */
test("topic with a match shows the card, credit link and a lite embed that loads only after tap", async ({ page }) => {
  const ytRequests: string[] = [];
  page.on("request", (r) => {
    if (/youtube(-nocookie)?\.com\/embed\//.test(r.url())) ytRequests.push(r.url());
  });
  // Don't hit YouTube from CI: answer the embed with a stub page.
  await page.route(/youtube-nocookie\.com\/embed\//, (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>stub player</body></html>" }));

  await page.goto("/m/sepsis-septic-shock/recognition-sepsis-3");
  const card = page.getByTestId("visual-explanation");
  await expect(card).toBeVisible();
  await expect(card.getByRole("heading", { name: "Visual explanation" })).toBeVisible();
  await expect(page.getByTestId("visual-meta")).toContainText("Armando Hasudungan");

  const credit = card.getByTestId("armando-credit").first();
  await expect(credit).toContainText("Video by Armando Hasudungan");
  await expect(credit).toContainText("armandoh.org");
  const link = credit.getByTestId("armando-credit-link");
  await expect(link).toHaveAttribute("href", "https://armandoh.org/video/septic-sepsis-pathway/");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", /noopener/);

  // Before tap: no iframe, no YouTube embed request.
  await expect(card.getByTestId("lite-yt-iframe")).toHaveCount(0);
  expect(ytRequests).toHaveLength(0);

  await card.getByTestId("lite-yt-play").first().scrollIntoViewIfNeeded();
  await card.getByTestId("lite-yt-play").first().click();
  const iframe = card.getByTestId("lite-yt-iframe");
  await expect(iframe).toHaveCount(1);
  await expect(iframe).toHaveAttribute("src", /^https:\/\/www\.youtube-nocookie\.com\/embed\/OgQ6avlpBRY\?autoplay=1/);
  await expect.poll(() => ytRequests.length).toBeGreaterThan(0);
});

test("topic without a match has no card", async ({ page }) => {
  await page.goto("/m/handover-transport-icu-safety/isbar-handover");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByTestId("visual-explanation")).toHaveCount(0);
});

test("AI tutor context excludes the partner video card", async ({ page }) => {
  const sent: { context: string }[] = [];
  await page.route("**/api/ai", async (route) => {
    sent.push(JSON.parse(route.request().postData() ?? "{}"));
    await route.fulfill({ status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" }, body: "ok" });
  });
  await page.goto("/m/sepsis-septic-shock/recognition-sepsis-3");
  await page.getByTestId("ai-bedside").click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0].context).not.toMatch(/armando|youtube|Visual explanation/i);
});

test("/credits lists Armando Hasudungan with a link to armandoh.org, and the footer links to it", async ({ page }) => {
  await page.goto("/credits");
  const card = page.getByTestId("credit-armando");
  await expect(card).toContainText("Armando Hasudungan");
  await expect(card).toContainText("Thank you");
  await expect(page.getByTestId("credit-site")).toHaveAttribute("href", "https://armandoh.org");
  await expect(page.locator("footer").getByRole("link", { name: "Partners & credits" })).toHaveAttribute("href", "/credits");
});
