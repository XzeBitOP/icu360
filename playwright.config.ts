import { defineConfig } from "@playwright/test";

// Smoke tests for ECG OS and Ventilator OS. Run against a production build:
//   npm run build && npm run test:e2e
// Uses system Chrome with software GL when PW_CHROME is set (CI-less boxes); otherwise Playwright's bundled browser.
const exe = process.env.PW_CHROME;
const port = process.env.PW_PORT ?? "3300";
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: process.env.PW_BASE ?? `http://localhost:${port}`,
    launchOptions: { executablePath: exe, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] },
  },
  projects: [
    { name: "mobile-390x844", use: { viewport: { width: 390, height: 844 }, hasTouch: true } },
    { name: "desktop-1440x900", use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: process.env.PW_BASE ? undefined : { command: `npx next start -p ${port}`, port: Number(port), reuseExistingServer: true, timeout: 60_000 },
});
