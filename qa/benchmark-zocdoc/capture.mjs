// Zocdoc SearchAI reverse-engineering capture (2026-10-18): what the flow shows, in what order.
import { chromium } from "@playwright/test";
import fs from "node:fs";
const URL = process.argv[2];
const OUT = "qa/benchmark-zocdoc";
const browser = await chromium.launch();
for (const [tag, vp] of [["mobile", { width: 430, height: 932 }], ["desktop", { width: 1440, height: 900 }]]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: tag === "mobile" ? 2 : 1, userAgent: tag === "mobile" ? "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" : undefined, locale: "en-US" });
  const page = await ctx.newPage();
  try {
    await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(6000);
    for (const t of ["Accept", "Accept all", "Got it", "Close"]) { const b = page.getByRole("button", { name: t }); if (await b.count()) await b.first().click().catch(() => {}); }
    await page.screenshot({ path: `${OUT}/${tag}-01.png` });
    for (let i = 2; i <= 5; i++) { await page.mouse.wheel(0, vp.height * 0.9); await page.waitForTimeout(1200); await page.screenshot({ path: `${OUT}/${tag}-0${i}.png` }); }
    fs.writeFileSync(`${OUT}/${tag}-text.txt`, (await page.locator("body").innerText()).slice(0, 20000));
    console.log(tag, "ok", page.url().slice(0, 80), await page.title());
  } catch (e) { console.log(tag, "fail", String(e).slice(0, 200)); }
  await ctx.close();
}
await browser.close();
