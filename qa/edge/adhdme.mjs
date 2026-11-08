// ADHDme mode: Home, About and Coverage pick the other mode's content in the browser; frames right after load.
import { chromium } from "@playwright/test";
import fs from "node:fs";
const BASE = process.env.BASE ?? "http://localhost:3300"; const OUT = process.env.OUT ?? "shots"; fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addCookies([{ name: "wattle.mode", value: "adhdme", domain: new URL(BASE).hostname, path: "/" }]);
const page = await ctx.newPage();
await page.addInitScript(() => localStorage.setItem("wattle.splash.seen", "true"));
for (const r of ["/", "/about", "/about/coverage", "/me"]) {
  await page.goto(`${BASE}${r}`, { waitUntil: "domcontentloaded" });
  await page.screenshot({ path: `${OUT}/adhdme${r.replace(/\//g, "_")}-first.png` });
  await page.waitForLoadState("networkidle"); await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/adhdme${r.replace(/\//g, "_")}-settled.png` });
  console.log(r, (await page.locator("h1").first().textContent())?.trim(), "|", (await page.locator("main p").first().textContent({ timeout: 2000 }).catch(() => ""))?.trim().slice(0, 70));
}
await browser.close();
