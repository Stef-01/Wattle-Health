// The Refine sheet against the gestures skill: 1:1 tracking, scrim linked to drag distance, rubber-band above
// the top, dismissal by distance or by release velocity, snap-back otherwise. Exit 1 on any miss.
import { chromium } from "@playwright/test";
const BASE = process.env.BASE ?? "http://localhost:3300";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.addInitScript(() => localStorage.setItem("wattle.splash.seen", "true"));
const fails = [];
const openSheet = async () => {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" }); await page.waitForTimeout(500);
  await page.getByRole("button", { name: /Endometriosis, someone who/ }).click(); await page.waitForURL(/narrow/); await page.waitForTimeout(600);
  await page.getByText(/Skip to my picks/).first().click(); await page.waitForURL(/results/, { timeout: 30000 }); await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /Refine/ }).click(); await page.waitForTimeout(600);
  const h = page.locator(".sheet-panel .chrome").first(); const box = await h.boundingBox(); if (!box) throw new Error("no sheet handle");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};
const state = () => page.evaluate(() => { const p = document.querySelector(".sheet-panel"), s = document.querySelector(".sheet-scrim"); const m = new DOMMatrixReadOnly(getComputedStyle(p).transform); return { ty: Math.round(m.m42), scrim: Number(getComputedStyle(s).opacity).toFixed(2), h: p.offsetHeight }; });
const dragTo = async (from, dy, steps, msPerStep) => { await page.mouse.move(from.x, from.y); await page.mouse.down(); for (let i = 1; i <= steps; i++) { await page.mouse.move(from.x, from.y + (dy * i) / steps); await page.waitForTimeout(msPerStep); } };

// 1. tracking + linked scrim at mid-drag
let from = await openSheet(); await dragTo(from, 120, 6, 16); let s = await state();
console.log("mid-drag", s);
if (Math.abs(s.ty - 120) > 2) fails.push(`panel does not track 1:1 (translateY ${s.ty} for 120 px)`);
if (!(Number(s.scrim) < 1 && Number(s.scrim) > 0.5)) fails.push(`scrim not linked to drag (opacity ${s.scrim})`);
// 2. upward rubber-band
await page.mouse.move(from.x, from.y - 100); await page.waitForTimeout(30); s = await state(); console.log("above top", s);
if (!(s.ty < 0 && s.ty > -40)) fails.push(`no rubber-band above the top (translateY ${s.ty} for -100 px)`);
// 3. short slow drag snaps back
await page.mouse.move(from.x, from.y + 40); await page.waitForTimeout(200); await page.mouse.up(); await page.waitForTimeout(500); s = await state(); console.log("after short drag", s);
if (s.ty !== 0 || !(await page.locator(".sheet-panel").isVisible())) fails.push(`short slow drag did not snap back (translateY ${s.ty})`);
// 4. slow pull ending in a flick dismisses (release velocity, not average)
await dragTo(from, 60, 12, 60); await page.mouse.move(from.x, from.y + 60 + 50); await page.waitForTimeout(8); await page.mouse.move(from.x, from.y + 60 + 100); await page.mouse.up(); await page.waitForTimeout(500);
const gone1 = (await page.locator(".sheet-panel").count()) === 0 || !(await page.locator(".sheet-panel").isVisible());
console.log("flick after slow pull dismissed:", gone1); if (!gone1) fails.push("a flick at the end of a slow pull did not dismiss");
// 5. long drag past 25% dismisses
from = await openSheet(); const h = (await state()).h; await dragTo(from, h * 0.4, 10, 40); await page.waitForTimeout(300); await page.mouse.up(); await page.waitForTimeout(500);
const gone2 = (await page.locator(".sheet-panel").count()) === 0 || !(await page.locator(".sheet-panel").isVisible());
console.log("long drag dismissed:", gone2); if (!gone2) fails.push("a drag past 25% of the height did not dismiss");
await browser.close();
console.log(fails.length ? `\n${fails.length} failure(s):\n${fails.join("\n")}` : "\nsheet gesture: clean");
process.exit(fails.length ? 1 : 0);
