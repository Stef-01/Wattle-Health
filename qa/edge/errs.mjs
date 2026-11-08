import { chromium } from "@playwright/test";
const BASE = process.env.BASE ?? "http://localhost:3300";
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await page.addInitScript(() => localStorage.setItem("wattle.splash.seen", "true"));
const errs = []; page.on("pageerror", (e) => errs.push(e.message.slice(0, 160))); page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 200)); });
for (const r of ["/", "/narrow", "/results", "/recent", "/saved", "/me", "/me/openings", "/me/discover", "/me/context", "/healthspan", "/about", "/about/coverage", "/compare", "/join", "/splash", "/doctor/general-practice~sian-hebron"]) {
  errs.length = 0; await page.goto(`${BASE}${r}`, { waitUntil: "networkidle" }); await page.waitForTimeout(500);
  if (errs.length) console.log(r, "→", errs.join(" || "));
}
console.log("done"); await browser.close();
