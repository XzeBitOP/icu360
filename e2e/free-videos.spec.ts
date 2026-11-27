import { expect, test } from "@playwright/test";

/** Free YouTube videos by other educators: per-channel credit, lite embed, Video library page, credits and search. */
const stub = { status: 200, contentType: "text/html", body: "<html><body>stub player</body></html>" };

test("topic with a free video shows the card with channel credit, rights wording and a tap-to-load embed", async ({ page }) => {
  const ytRequests: string[] = [];
  page.on("request", (r) => {
    if (/youtube(-nocookie)?\.com\/embed\//.test(r.url())) ytRequests.push(r.url());
  });
  await page.route(/youtube-nocookie\.com\/embed\//, (route) => route.fulfill(stub));

  await page.goto("/m/handover-transport-icu-safety/isbar-handover");
  const card = page.getByTestId("free-video-explanation");
  await expect(card).toBeVisible();
  await expect(page.getByTestId("visual-explanation")).toHaveCount(0);
  await expect(page.getByTestId("visual-meta")).toContainText("Embedded video by Geeky Medics");
  await expect(card.getByTestId("free-video-credit")).toContainText("Embedded video by Geeky Medics (YouTube)");
  await expect(card.getByTestId("free-video-rights")).toContainText(
    "Embedded video by Geeky Medics (YouTube). ICU 360 does not own this video; all rights belong to the creator. The video loads from YouTube only when you tap play.",
  );
  await expect(card).not.toContainText(/partner|permission|thank you/i);
  const ch = card.getByTestId("free-video-channel-link");
  await expect(ch).toHaveAttribute("href", /^https:\/\/www\.youtube\.com\/@/);
  await expect(ch).toHaveAttribute("target", "_blank");
  await expect(card.getByTestId("free-video-watch")).toHaveAttribute("href", "https://www.youtube.com/watch?v=X_3wY-4f8HY");

  await expect(card.getByTestId("lite-yt-iframe")).toHaveCount(0);
  expect(ytRequests).toHaveLength(0);
  await card.getByTestId("lite-yt-play").first().scrollIntoViewIfNeeded();
  await card.getByTestId("lite-yt-play").first().click();
  await expect(card.getByTestId("lite-yt-iframe")).toHaveAttribute("src", /^https:\/\/www\.youtube-nocookie\.com\/embed\/X_3wY-4f8HY\?autoplay=1/);
});

test("Armando topics keep Armando's card only", async ({ page }) => {
  await page.goto("/m/sepsis-septic-shock/recognition-sepsis-3");
  await expect(page.getByTestId("visual-explanation")).toBeVisible();
  await expect(page.getByTestId("free-video-explanation")).toHaveCount(0);
});

test("AI tutor context excludes the free video card", async ({ page }) => {
  const sent: { context: string }[] = [];
  await page.route("**/api/ai", async (route) => {
    sent.push(JSON.parse(route.request().postData() ?? "{}"));
    await route.fulfill({ status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" }, body: "ok" });
  });
  await page.goto("/m/handover-transport-icu-safety/isbar-handover");
  await page.getByTestId("ai-bedside").click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0].context).not.toMatch(/youtube|Geeky Medics|Visual explanation/i);
});

test("Video library page groups videos by module with channel credit", async ({ page }) => {
  await page.route(/youtube-nocookie\.com\/embed\//, (route) => route.fulfill(stub));
  await page.goto("/videos/library");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Video library");
  expect(await page.getByTestId("library-video").count()).toBeGreaterThan(100);
  expect(await page.getByTestId("video-library-module-group").count()).toBeGreaterThan(30);
  await expect(page.getByTestId("video-library-rights")).toContainText("We do not own these videos; all rights belong to the creators.");
  await expect(page.locator("main")).not.toContainText(/partner|permission|thank you/i);
  await expect(page.getByTestId("armando-resource-link")).toHaveAttribute("href", "/videos/armando");
  const card = page.locator("#v-X_3wY-4f8HY");
  await expect(card.getByTestId("free-video-credit")).toContainText("Embedded video by Geeky Medics (YouTube)");
  await expect(card.getByTestId("library-video-topic")).toHaveAttribute("href", "/m/handover-transport-icu-safety/isbar-handover#visual");
  await expect(page.getByTestId("lite-yt-iframe")).toHaveCount(0);
});

test("Video credits lists every credited channel; Browse links to the library", async ({ page }) => {
  await page.goto("/credits");
  const sec = page.getByTestId("credit-youtube-channels");
  await expect(sec).toContainText("We do not own these videos; all rights belong to the creators.");
  expect(await sec.getByTestId("credit-channel").count()).toBeGreaterThan(50);
  await expect(sec.getByTestId("credit-channel").filter({ hasText: "Strong Medicine" })).toBeVisible();
  await expect(page.getByTestId("credit-armando")).toBeVisible();
  await page.goto("/browse");
  await expect(page.getByTestId("video-library-link")).toHaveAttribute("href", "/videos/library");
});

test("global search finds free videos labelled 'Video · <Channel>' and opens them on the library page", async ({ page }) => {
  await page.goto("/search");
  await page.getByLabel("Search ICU 360").fill("prone positioning");
  await page.getByRole("button", { name: "Videos", exact: true }).click();
  const hit = page.getByRole("option").filter({ hasText: "Video · Rush University System for Health" }).first();
  await expect(hit).toBeVisible();
  await hit.getByRole("link").click();
  await expect(page).toHaveURL(/\/videos\/library#v-lcBPaHQUvXY$/);
  await expect(page.locator("#v-lcBPaHQUvXY")).toBeInViewport();
});
