import { chromium } from "@playwright/test";
const BASE = process.env.BASE ?? "http://localhost:3300"; const OUT = process.env.OUT ?? "shots";
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
await page.addInitScript(() => localStorage.setItem("wattle.splash.seen", "true"));
for (const r of ["/", "/me", "/doctor/general-practice~sian-hebron", "/healthspan", "/me/context", "/join/verify"]) {
  await page.goto(`${BASE}${r}`, { waitUntil: "load" }); await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/320${r.replace(/[\/~]/g, "_") || "_home"}.png` });
}
await browser.close(); console.log("done");
