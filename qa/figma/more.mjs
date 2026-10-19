// The profile with every "More" pressed and every panel open, at the second demo doctor.
import { chromium } from "@playwright/test";
import path from "node:path";
const BASE = (process.env.BASE ?? "http://localhost:3300").replace(/\/$/, "");
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 })).newPage();
await page.goto(`${BASE}/`); await page.evaluate(() => localStorage.setItem("wattle.splash.seen", "true"));
await page.goto(`${BASE}/`); await page.getByRole("button", { name: "ADHD, lived experience" }).click(); await page.waitForURL(/\/results/); await page.waitForTimeout(900);
const first = (await page.locator("a[href*='/doctor/']").first().getAttribute("href")).replace(/\/$/, "");
await page.goto(`${BASE}${first}`); await page.waitForTimeout(700);
for (let i = 0; i < 6; i++) { const b = page.getByRole("button", { name: "More", exact: true }); if (!(await b.count())) break; await b.first().click(); await page.waitForTimeout(150); }
for (const t of ["Research", "Practical", "Why this pick", "Where this comes from"]) { const b = page.getByRole("button", { name: new RegExp(`^${t}`) }); if (await b.count()) await b.first().click(); }
await page.waitForTimeout(500);
await page.screenshot({ path: path.join("qa/figma/demos", "x1-more-open.png"), fullPage: true });
await browser.close();
