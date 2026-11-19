import { chromium } from "@playwright/test";
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" })).newPage();
await p.goto("http://localhost:3200/tools/ecg-os", { waitUntil: "load" });
await p.waitForSelector("[data-testid=heart-3d][data-state=ready]", { timeout: 90000 });
await p.waitForTimeout(1500);
await p.screenshot({ path: "/workspace/dbg/dark1.png" });
await b.close();
