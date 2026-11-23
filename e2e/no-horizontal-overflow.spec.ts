import { expect, test } from "@playwright/test";

/**
 * Regression: no page may be wider than a 360 px phone. Long unbroken titles (e.g. drug names joined by "/") and
 * grid/flex children with nowrap text (calculator and link cards) used to widen the layout viewport on mobile.
 */
test.use({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true });

const PAGES = [
  "/",
  "/browse",
  "/tools",
  "/learn",
  "/news",
  "/quiz",
  "/credits",
  "/antimicrobials",
  "/antimicrobials/tenofovir-lamivudine-dolutegravir-tld",
  "/antimicrobials/bictegravir-emtricitabine-tenofovir-alafenamide",
  "/m/sepsis-septic-shock",
  "/m/procedures",
  "/m/sepsis-septic-shock/hour-1-bundle",
  "/m/sepsis-septic-shock/recognition-sepsis-3",
  "/m/neuro-emergencies/ich-sah",
  "/m/fluids-electrolytes/hyperkalaemia",
  "/tools/sofa",
  "/tools/abg",
  "/tools/ecg-os",
  "/tools/ventilator-os",
];

test.describe("no horizontal overflow at 360 px", () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "mobile-390x844", "mobile project only");
  });
  for (const path of PAGES) {
    test(path, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle").catch(() => {});
      const { scrollWidth, innerWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
      expect(innerWidth, `${path}: layout viewport widened`).toBeLessThanOrEqual(361);
      expect(scrollWidth, `${path}: page wider than the phone`).toBeLessThanOrEqual(361);
    });
  }
});
