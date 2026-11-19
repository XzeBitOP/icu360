// node scripts/sim/shot.mjs <url> <out.png> [w] [h] [waitMs]
import { chromium } from "@playwright/test";
const [url, out, w = "1000", h = "800", wait = "1500"] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await (await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 })).newPage();
p.on("console", (m) => { if (m.type() === "error") console.log("console:", m.text()); });
p.on("pageerror", (e) => console.log("pageerror:", e.message));
await p.goto(url, { waitUntil: "load" });
await p.waitForFunction(() => window.__ready === true, null, { timeout: 60000 }).catch(() => console.log("not ready"));
await p.waitForTimeout(+wait);
await p.screenshot({ path: out });
await b.close();
