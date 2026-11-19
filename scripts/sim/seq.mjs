// node scripts/sim/seq.mjs <url> <prefix> <w> <h> <n> <gapMs> [hoverX,hoverY]
import { chromium } from "@playwright/test";
const [url, prefix, w = "900", h = "700", n = "4", gap = "120", hover] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await (await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 })).newPage();
p.on("pageerror", (e) => console.log("pageerror:", e.message));
await p.goto(url, { waitUntil: "load" });
await p.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
await p.evaluate(() => { const r = window.__runner; r.pause(); r.seek(8000); });
if (hover) { const [x, y] = hover.split(",").map(Number); await p.mouse.move(x, y); }
for (let i = 0; i < +n; i++) {
  await p.evaluate((g) => { const r = window.__runner; r.seek(r.timeMs + g); }, +gap * (i === 0 ? 0 : 1));
  await p.waitForTimeout(250);
  await p.screenshot({ path: `${prefix}${i}.png` });
}
await b.close();
