// Counts taps from Home to the top pick (search box filled by typing, not counted).
import { chromium, devices } from "@playwright/test";
const BASE = (process.env.BASE ?? "http://localhost:3300").replace(/\/$/, "");
const b = await chromium.launch();
const page = await (await b.newContext({ ...devices["iPhone 15"] })).newPage();
let taps = 0;
await page.goto(`${BASE}/`);
await page.evaluate(() => localStorage.setItem("wattle.splash.seen", "true"));
await page.goto(`${BASE}/`);
await page.locator("textarea, input[type=text]").first().fill("Endometriosis, someone who listens");
await page.getByText("Find my provider").click(); taps++;
await page.waitForURL(/\/narrow/);
for (let i = 0; i < 12 && !/results/.test(page.url()); i++) {
  await page.waitForFunction(() => document.querySelector("[data-answer]") || /search for|results/.test(document.body.innerText + location.href), null, { timeout: 15000 });
  const see = page.getByRole("button", { name: "See your picks" });
  if (await see.count()) { await see.click(); taps++; break; }
  const r = page.locator("[data-answer]");
  if (await r.count()) { await r.first().click(); taps++; await page.waitForTimeout(600); }
  else { const c = page.getByRole("button", { name: "Continue" }); if (await c.count()) { await c.click(); taps++; } }
}
await page.waitForSelector("text=Your top pick", { timeout: 30000 });
console.log(JSON.stringify({ tapsToTopPick: taps }));
await b.close();
