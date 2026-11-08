// Which requests fail on production (Lighthouse saw a 404 in the console on every route).
import { chromium } from "@playwright/test";
const BASE = process.env.BASE ?? "https://wattlehealth.vercel.app";
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })).newPage();
const bad = new Set();
page.on("response", (r) => { if (r.status() >= 400) bad.add(`${r.status()} ${r.url()}`); });
page.on("requestfailed", (r) => bad.add(`FAILED ${r.url()} ${r.failure()?.errorText}`));
for (const r of ["/", "/me", "/doctor/general-practice~sian-hebron", "/healthspan"]) { await page.goto(`${BASE}${r}`, { waitUntil: "networkidle" }); await page.waitForTimeout(800); }
console.log([...bad].join("\n") || "no failed requests");
await browser.close();
