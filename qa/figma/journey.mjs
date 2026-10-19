// The guided flow end to end: home → narrowing questions → top match → scroll → second → third → "Search again".
import { chromium } from "@playwright/test";
import { throughNarrow } from "./narrow-helper.mjs";
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
await throughNarrow(page, { pick: 1, shot });
const asked = (await import("node:fs")).readdirSync(OUT).filter((f) => f.startsWith("narrow-")).length - 2;
await page.waitForURL(/\/results/, { timeout: 20000 }); await page.waitForTimeout(1800); await shot("04-top-match");
const counts = [];
for (let i = 0; i < 40; i++) {
  await page.mouse.wheel(0, 1600); await page.waitForTimeout(250);
  counts.push(await page.locator("section[data-match]").count());
  if (await page.getByRole("button", { name: "Search again" }).isVisible().catch(() => false)) break;
}
await page.waitForTimeout(500); await shot("05-end");
const sections = await page.locator("section[data-match]").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
console.log(JSON.stringify({ questionsAnswered: asked, sections, revealSteps: [...new Set(counts)], searchAgain: await page.getByRole("button", { name: "Search again" }).isVisible() }));
await browser.close();
