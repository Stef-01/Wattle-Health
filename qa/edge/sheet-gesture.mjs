// The Refine sheet against the gestures skill (emilkowalski/skills): 1:1 tracking, scrim linked to drag distance,
// rubber-band above the top, dismissal by distance or by release velocity, snap-back otherwise, a drag that starts
// from the content when it is scrolled to the top, a closing sheet caught mid-flight and pulled back, and the same
// drag through real touch events (CDP) rather than a mouse. Exit 1 on any miss. BASE= for another server.
import { chromium } from "@playwright/test";
const BASE = process.env.BASE ?? "http://localhost:3300";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.addInitScript(() => localStorage.setItem("wattle.splash.seen", "true"));
const fails = [];
const check = (name, ok, detail) => { console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? `  (${detail})` : ""}`); if (!ok) fails.push(name); };
const openSheet = async () => {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" }); await page.waitForTimeout(500);
  await page.getByRole("button", { name: /Endometriosis, someone who/ }).click(); await page.waitForURL(/narrow/); await page.waitForTimeout(600);
  await page.getByText(/Skip to my picks/).first().click(); await page.waitForURL(/results/, { timeout: 30000 }); await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /Refine/ }).click(); await page.waitForTimeout(600);
  const h = page.locator(".sheet-panel .chrome").first(); const box = await h.boundingBox(); if (!box) throw new Error("no sheet handle");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};
const state = () => page.evaluate(() => { const p = document.querySelector(".sheet-panel"), s = document.querySelector(".sheet-scrim"); if (!p) return { ty: null, scrim: null, h: 0 }; const m = new DOMMatrixReadOnly(getComputedStyle(p).transform); return { ty: Math.round(m.m42), scrim: Number(getComputedStyle(s).opacity).toFixed(2), h: p.offsetHeight }; });
const gone = async () => (await page.locator(".sheet-panel").count()) === 0 || !(await page.locator(".sheet-panel").isVisible());
const dragTo = async (from, dy, steps, msPerStep) => { await page.mouse.move(from.x, from.y); await page.mouse.down(); for (let i = 1; i <= steps; i++) { await page.mouse.move(from.x, from.y + (dy * i) / steps); await page.waitForTimeout(msPerStep); } };

// 1. tracking + linked scrim at mid-drag
let from = await openSheet(); await dragTo(from, 120, 6, 16); let s = await state();
check("panel tracks 1:1 (translateY 120 for 120 px)", Math.abs(s.ty - 120) <= 2, `ty ${s.ty}`);
check("scrim linked to drag", Number(s.scrim) < 1 && Number(s.scrim) > 0.5, `opacity ${s.scrim}`);
// 2. upward rubber-band
await page.mouse.move(from.x, from.y - 100); await page.waitForTimeout(30); s = await state();
check("rubber-band above the top (-100 px pull lands between -40 and 0)", s.ty < 0 && s.ty > -40, `ty ${s.ty}`);
// 3. short slow drag snaps back
await page.mouse.move(from.x, from.y + 40); await page.waitForTimeout(200); await page.mouse.up(); await page.waitForTimeout(500); s = await state();
check("short slow drag snaps back", s.ty === 0 && !(await gone()), `ty ${s.ty}`);
// 4. slow pull ending in a flick dismisses (release velocity, not average)
await dragTo(from, 60, 12, 60); await page.mouse.move(from.x, from.y + 60 + 50); await page.waitForTimeout(8); await page.mouse.move(from.x, from.y + 60 + 100); await page.mouse.up(); await page.waitForTimeout(600);
check("a flick at the end of a slow pull dismisses", await gone());
// 5. long drag past 25% dismisses
from = await openSheet(); const h = (await state()).h; await dragTo(from, h * 0.4, 10, 40); await page.waitForTimeout(300); await page.mouse.up(); await page.waitForTimeout(600);
check("a drag past 25% of the height dismisses", await gone());
// 6. caught mid-flight: pointer-down 120 ms into the 420 ms entrance stops the panel where it is; release settles it
await page.goto(`${BASE}/results`, { waitUntil: "networkidle" }).catch(() => null); await page.waitForTimeout(400);
await page.getByRole("button", { name: /Refine/ }).click(); await page.waitForTimeout(120);
const hb0 = await page.locator(".sheet-panel .chrome").first().boundingBox();
await page.mouse.move(hb0.x + hb0.width / 2, hb0.y + hb0.height / 2); await page.mouse.down(); s = await state(); const caughtAt = s.ty;
await page.waitForTimeout(200); s = await state();
check("a sheet is caught mid-entrance (pointer-down holds it where it is)", caughtAt > 0 && s.ty > 0 && Math.abs(s.ty - caughtAt) <= 3, `held at ${s.ty}, caught at ${caughtAt} of ${h}`);
await page.mouse.up(); await page.waitForTimeout(600); s = await state();
check("released, it settles to rest and stays open", !(await gone()) && s.ty === 0, `ty ${s.ty}`);
// 7. a drag that starts on the content (scrolled to the top) dismisses; one that starts on a switch does not
let cellBox = await page.locator(".sheet-body .text-body").first().boundingBox();
await dragTo({ x: cellBox.x + 10, y: cellBox.y + 8 }, h * 0.4, 10, 30); await page.waitForTimeout(200); await page.mouse.up(); await page.waitForTimeout(600);
check("a drag from the content dismisses", await gone());
from = await openSheet(); const sw = await page.locator(".sheet-body [role=switch]").first().boundingBox();
await dragTo({ x: sw.x + sw.width / 2, y: sw.y + sw.height / 2 }, h * 0.4, 10, 30); await page.mouse.up(); await page.waitForTimeout(600);
check("a drag that starts on a switch leaves the sheet alone", !(await gone()));
// 8. the same drag through real touch events (CDP): Chromium decides scroll vs drag from touch-action here
const cdp = await ctx.newCDPSession(page);
const touch = async (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
from = await openSheet(); const hb = await page.locator(".sheet-panel .chrome").first().boundingBox();
await touch("touchStart", hb.x + hb.width / 2, hb.y + hb.height / 2);
for (let i = 1; i <= 8; i++) { await touch("touchMove", hb.x + hb.width / 2, hb.y + hb.height / 2 + i * 15); await page.waitForTimeout(16); }
s = await state(); check("touch drag on the handle tracks 1:1", s.ty !== null && Math.abs(s.ty - 120) <= 3, `ty ${s.ty}`);
for (let i = 9; i <= 20; i++) { await touch("touchMove", hb.x + hb.width / 2, hb.y + hb.height / 2 + i * 15); await page.waitForTimeout(16); }
await touch("touchEnd", 0, 0); await page.waitForTimeout(600);
check("touch drag on the handle dismisses", await gone());
from = await openSheet(); cellBox = await page.locator(".sheet-body .text-body").first().boundingBox();
await touch("touchStart", cellBox.x + 10, cellBox.y + 8);
for (let i = 1; i <= 20; i++) { await touch("touchMove", cellBox.x + 10, cellBox.y + 8 + i * 15); await page.waitForTimeout(16); }
await touch("touchEnd", 0, 0); await page.waitForTimeout(600);
check("touch drag from the content dismisses", await gone());
await browser.close();
console.log(fails.length ? `\n${fails.length} failure(s):\n${fails.join("\n")}` : "\nsheet gesture: clean");
process.exit(fails.length ? 1 : 0);
