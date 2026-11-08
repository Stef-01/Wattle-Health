// The first-run path frame by frame: splash → tap → Home, then Home at rest with a name and a recent search.
import { chromium } from "@playwright/test";
import fs from "node:fs";
const BASE = process.env.BASE ?? "http://localhost:3300";
const OUT = process.env.OUT ?? "shots";
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
for (const [w, h, scale] of [[390, 844, 2], [1280, 800, 1]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: scale, isMobile: w < 500, hasTouch: w < 500 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  console.log(w, "active after redirect:", await page.evaluate(() => { const a = document.activeElement; return a ? `${a.tagName} ${a.className} matches(:focus-visible)=${a.matches(":focus-visible")} outline=${getComputedStyle(a).outlineStyle}` : "none"; }));
  // tap the splash and record the arrival of Home
  if (w < 500) await page.touchscreen.tap(w / 2, h / 2); else await page.mouse.click(w / 2, h / 2);
  for (const t of [0, 120, 250, 400, 700, 1200, 2500]) {
    await page.waitForTimeout(t === 0 ? 30 : t - [0, 120, 250, 400, 700, 1200, 2500][[0, 120, 250, 400, 700, 1200, 2500].indexOf(t) - 1]);
    await page.screenshot({ path: `${OUT}/${w}_home-arrive-${String(t).padStart(4, "0")}.png` });
  }
  console.log(w, "active on home:", await page.evaluate(() => { const a = document.activeElement; return a ? `${a.tagName} ${a.className.slice(0, 60)} fv=${a.matches(":focus-visible")}` : "none"; }));
  // Home with a name and a recent search
  await page.evaluate(() => {
    localStorage.setItem("wattle.name", JSON.stringify("Stefan"));
  });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${w}_home-named.png` });
  await page.screenshot({ path: `${OUT}/${w}_home-named.full.png`, fullPage: true });
  console.log(w, "localStorage keys:", await page.evaluate(() => Object.keys(localStorage).join(",")));
  await ctx.close();
}
await browser.close();
