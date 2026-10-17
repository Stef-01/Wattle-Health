// The guided flow end to end: home → narrowing questions → top match → scroll → second → third → "Search again".
import { chromium } from "@playwright/test";
import path from "node:path";
const BASE = (process.env.BASE ?? "http://localhost:3300").replace(/\/$/, "");
const OUT = path.resolve(process.env.OUT ?? "qa/figma/journey");
import fs from "node:fs"; fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 })).newPage();
const shot = (n) => page.screenshot({ path: path.join(OUT, `${n}.png`) });
await page.goto(`${BASE}/`); await page.evaluate(() => localStorage.setItem("wattle.splash.seen", "true")); await page.goto(`${BASE}/`);
await page.fill("textarea", "Endometriosis, I feel like nobody listens");
await page.click("text=Find my doctor"); await page.waitForURL(/\/narrow/);
await page.locator("[data-answer='0']").first().waitFor({ timeout: 10000 }); await page.waitForTimeout(500); await shot("01-narrow-q1");
let asked = 0;
for (let i = 0; i < 4; i++) {
  if (/\/results/.test(page.url())) break;
  const o = page.locator("[data-answer='1']").last();
  try { await o.waitFor({ timeout: 6000 }); } catch { break; }
  await o.click(); asked++; await page.waitForTimeout(600);
  if (i === 0) await shot("02-narrow-q2");
}
await page.waitForTimeout(400); await shot("03-searching");
await page.waitForURL(/\/results/, { timeout: 20000 }); await page.waitForTimeout(1800); await shot("04-top-match");
const counts = [];
for (let i = 0; i < 40; i++) {
  await page.mouse.wheel(0, 1600); await page.waitForTimeout(250);
  counts.push(await page.locator("section[aria-label]").count());
  if (await page.getByRole("button", { name: "Search again" }).isVisible().catch(() => false)) break;
}
await page.waitForTimeout(500); await shot("05-end");
const sections = await page.locator("section[aria-label]").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
console.log(JSON.stringify({ questionsAnswered: asked, sections, revealSteps: [...new Set(counts)], searchAgain: await page.getByRole("button", { name: "Search again" }).isVisible() }));
await browser.close();
