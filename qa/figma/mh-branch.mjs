// Mental-health branch: "ADHD" → experience → type of care (medication) → medication → open to a GP (no) → … → results with no GPs; then a profile's reviews.
import { chromium } from "@playwright/test";
const BASE = (process.env.BASE ?? "http://localhost:3300").replace(/\/$/, "");
const OUT = process.env.OUT ?? "qa/figma/journey";
const browser = await chromium.launch();
const p = await (await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 })).newPage();
await p.goto(`${BASE}/`); await p.evaluate(() => localStorage.setItem("wattle.splash.seen", "true")); await p.goto(`${BASE}/`);
await p.fill("textarea", "I think I have ADHD, I'm an adult"); await p.click("text=Find my provider"); await p.waitForURL(/\/narrow/);
await p.getByRole("button", { name: "Continue" }).click(); await p.waitForTimeout(500);
const asked = [];
for (let i = 0; i < 12; i++) {
  if (/results/.test(p.url())) break;
  if (await p.getByRole("button", { name: "See your picks" }).count()) { await p.screenshot({ path: `${OUT}/mh-summary.png` }); await p.getByRole("button", { name: "See your picks" }).click(); break; }
  await p.locator("h1").first().waitFor(); const q = (await p.locator("h1").first().textContent())?.trim(); asked.push(q);
  const pick = /type of care/.test(q) ? "Medication, or a review of it" : /open to seeing a GP/.test(q) ? "No, a specialist only" : null;
  if (/type of care/.test(q)) await p.screenshot({ path: `${OUT}/mh-care.png` });
  if (/open to seeing a GP/.test(q)) await p.screenshot({ path: `${OUT}/mh-gp.png` });
  if (pick) await p.getByRole("radio", { name: new RegExp(pick) }).click(); else await p.locator("[data-answer]").first().click();
  await p.getByRole("button", { name: "Continue" }).click(); await p.waitForTimeout(450);
}
await p.waitForURL(/\/results/, { timeout: 25000 }); await p.waitForTimeout(1800);
const specialties = await p.locator("section[data-match] a p").first().textContent();
const rev = p.locator("section[aria-label^='Reviews of']").first(); await rev.scrollIntoViewIfNeeded(); await p.waitForTimeout(500); await p.screenshot({ path: `${OUT}/reviews.png` });
await p.getByRole("button", { name: "Write a review" }).first().click(); await p.waitForTimeout(500); await p.screenshot({ path: `${OUT}/review-sheet.png` });
console.log(JSON.stringify({ asked, topMatchLine: specialties }));
await browser.close();
