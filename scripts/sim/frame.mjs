// node scripts/sim/frame.mjs <url> <testid> <out> [w h]
import { chromium } from "@playwright/test";
const [url, tid, out, w = "1440", h = "900"] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await (await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2 })).newPage();
await p.goto(url, { waitUntil: "load" });
await p.waitForSelector(`[data-testid=${tid}][data-state=ready]`, { timeout: 90000 });
await p.waitForTimeout(2500);
await p.locator(`[data-testid=${tid}]`).screenshot({ path: out });
await b.close();
