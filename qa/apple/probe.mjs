// Prints computed styles for a selector on a route (debug helper for the Apple pass).
import { chromium, devices } from "@playwright/test";
const [route = "/", sel = ".glass", ...props] = process.argv.slice(2);
const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const page = await (await b.newContext({ ...devices["iPhone 15"] })).newPage();
await page.goto(`http://localhost:3300/`);
await page.evaluate(() => localStorage.setItem("wattle.splash.seen", "true"));
await page.goto(`http://localhost:3300${route}`, { waitUntil: "networkidle" });
const out = await page.$$eval(sel, (els, props) => els.slice(0, 4).map((e) => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return { cls: String(e.className).slice(0, 80), box: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], ...Object.fromEntries(props.map((p) => [p, s.getPropertyValue(p)])) }; }), props);
console.log(JSON.stringify(out, null, 1));
await b.close();
