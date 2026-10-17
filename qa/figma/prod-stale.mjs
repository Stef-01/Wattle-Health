// Simulate a visitor whose stored search predates portraits: results must re-run and show images.
import { chromium } from "@playwright/test";
const BASE = (process.env.BASE ?? "https://wattlehealth.vercel.app").replace(/\/$/, "");
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 430, height: 932 } })).newPage();
await page.goto(`${BASE}/`); await page.evaluate(() => localStorage.setItem("wattle.splash.seen", "true"));
await page.goto(`${BASE}/`); await page.getByRole("button", { name: "ADHD, lived experience" }).click(); await page.waitForURL(/\/results/); await page.waitForTimeout(2000);
// strip the version and photos from the stored request, then reload
await page.evaluate(() => { const id = JSON.parse(sessionStorage.getItem("wattle.req.current") ?? "null") ?? Object.keys(sessionStorage).find((k) => k.startsWith("wattle.req.") && k !== "wattle.req.current")?.slice(11); for (const k of Object.keys(sessionStorage)) { if (k.startsWith("wattle.req.") && k !== "wattle.req.current") { const r = JSON.parse(sessionStorage.getItem(k)); delete r.v; for (const c of r.response.cards) delete c.doctor.photo; sessionStorage.setItem(k, JSON.stringify(r)); } } void id; });
await page.reload(); await page.waitForTimeout(3500);
const imgs = await page.$$eval("article img", (els) => els.map((e) => e.naturalWidth));
console.log("after stale reload: images", imgs.length, "loaded", imgs.filter((w) => w > 0).length);
await page.goto(`${BASE}/match/1`); await page.waitForTimeout(2500);
const m = await page.$$eval("img", (els) => els.filter((e) => /http/.test(e.src) && e.naturalWidth > 0).length);
console.log("match screen portrait loaded:", m > 0);
await browser.close();
