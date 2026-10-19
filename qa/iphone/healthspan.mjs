// Healthspan journey at iPhone 15: pick heart + metabolism, Oura, bloodwork on, match, screenshot results.
import { chromium, devices } from "@playwright/test";
const BASE = (process.env.BASE ?? "http://localhost:3300").replace(/\/$/, "");
const b = await chromium.launch();
const page = await (await b.newContext({ ...devices["iPhone 15"] })).newPage();
await page.goto(`${BASE}/healthspan`);
await page.getByRole("button", { name: /Heart and arteries/ }).click();
await page.getByRole("button", { name: /Blood sugar and metabolism/ }).click();
await page.getByRole("button", { name: "Oura Ring" }).click();
await page.getByText("Show my picks").click();
await page.waitForSelector("text=Providers who work forwards", { timeout: 20000 });
await page.waitForTimeout(1200);
const names = await page.locator("article").evaluateAll((a) => a.map((x) => x.querySelector("img")?.alt ?? ""));
const reasons = await page.locator("article li").allInnerTexts();
await page.screenshot({ path: "qa/iphone/healthspan-results.png", fullPage: true });
console.log(JSON.stringify({ names, reasons: reasons.slice(0, 6) }));
await b.close();
