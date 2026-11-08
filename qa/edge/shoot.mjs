// Screenshot every route at phone and laptop width: viewport at rest, and full page.
import { chromium } from "@playwright/test";
import fs from "node:fs";
const BASE = process.env.BASE ?? "http://localhost:3300";
const OUT = process.env.OUT ?? "shots";
fs.mkdirSync(OUT, { recursive: true });
const ROUTES = (process.env.ROUTES ?? "/,/narrow").split(",");
const browser = await chromium.launch();
for (const [w, h, scale] of [[390, 844, 2], [1280, 800, 1]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: scale, isMobile: w < 500, hasTouch: w < 500 });
  const page = await ctx.newPage();
  for (const r of ROUTES) {
    const name = `${w}${r.replace(/[\/~]/g, "_") || "_home"}`;
    try {
      await page.goto(`${BASE}${r}`, { waitUntil: "load", timeout: 30000 });
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${OUT}/${name}.png` });
      await page.screenshot({ path: `${OUT}/${name}.full.png`, fullPage: true });
      if (r === "/") { for (const t of [3000, 6000]) { await page.waitForTimeout(3000); await page.screenshot({ path: `${OUT}/${name}.t${t}.png` }); } }
      console.log("ok", name);
    } catch (e) { console.log("FAIL", name, e.message.slice(0, 100)); }
  }
  await ctx.close();
}
await browser.close();
