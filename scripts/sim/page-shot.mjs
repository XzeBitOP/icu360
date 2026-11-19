// node scripts/sim/page-shot.mjs <url> <out.png> <w> <h> [selector-to-wait] [fullPage]
import { chromium } from "@playwright/test";
const [url, out, w = "1440", h = "900", sel = "", full = ""] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await (await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 })).newPage();
p.on("console", (m) => { if (m.type() === "error") console.log("console:", m.text().slice(0, 200)); });
p.on("pageerror", (e) => console.log("pageerror:", e.message));
await p.goto(url, { waitUntil: "load" });
if (sel) await p.waitForSelector(sel, { timeout: 60000 }).catch(() => console.log("selector timeout", sel));
await p.waitForTimeout(2500);
await p.screenshot({ path: out, fullPage: !!full });
await b.close();
