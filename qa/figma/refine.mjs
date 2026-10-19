// Results with highlights, the Refine sheet, a refine applied, and the "More about" fold opened.
import { chromium } from "@playwright/test";
import { throughNarrow } from "./narrow-helper.mjs";
const BASE = (process.env.BASE ?? "http://localhost:3300").replace(/\/$/, "");
const OUT = process.env.OUT ?? "qa/figma/journey";
const browser = await chromium.launch();
const p = await (await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 })).newPage();
await p.goto(`${BASE}/`); await p.evaluate(() => localStorage.setItem("wattle.splash.seen", "true")); await p.goto(`${BASE}/`);
await p.getByRole("button", { name: "Endometriosis, someone who listens" }).click(); await p.waitForURL(/\/narrow/);
await throughNarrow(p);
await p.waitForURL(/\/results/, { timeout: 20000 }); await p.waitForTimeout(1800);
await p.locator("section[aria-label^='Highlights']").first().scrollIntoViewIfNeeded(); await p.waitForTimeout(500);
await p.screenshot({ path: `${OUT}/07-highlights.png` });
const all = p.getByRole("button", { name: /Show all \d+ highlights/ }).first(); const hadAll = await all.count(); if (hadAll) { await all.click(); await p.waitForTimeout(500); await p.screenshot({ path: `${OUT}/08-highlights-all.png` }); }
const more = p.getByRole("button", { name: /^More about/ }).first(); await more.scrollIntoViewIfNeeded(); await p.screenshot({ path: `${OUT}/09-folded.png` }); await more.click(); await p.waitForTimeout(600); await p.screenshot({ path: `${OUT}/10-unfolded.png` });
await p.evaluate(() => window.scrollTo(0, 0)); await p.getByRole("button", { name: /Refine/ }).click(); await p.waitForTimeout(600); await p.screenshot({ path: `${OUT}/11-refine.png` });
await p.getByRole("switch", { name: /Telehealth only/ }).click(); await p.getByRole("switch", { name: /A woman doctor/ }).click(); await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}/12-refine-on.png` });
await p.getByRole("button", { name: "Show my matches" }).click(); await p.waitForTimeout(2500); await p.screenshot({ path: `${OUT}/13-refined.png` });
const heard = await p.locator("p.min-w-0").first().textContent();
console.log(JSON.stringify({ showAll: hadAll > 0, heardAfterRefine: heard }));
await browser.close();
