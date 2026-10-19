// Full-journey screenshot walk at 430x932 against a running `pnpm start` (port 3300), or any
// deployment: BASE=https://stef-01.github.io/Wattle-Health node qa/figma/walk.mjs. Hrefs the
// page renders already carry that base path, so they are opened as is.
// Usage: node qa/figma/walk.mjs  → qa/figma/walk/*.png + walk.json (+ sheet.png with sharp;
// python qa/figma/sheet.py composes one with PIL otherwise).
import { chromium } from "@playwright/test";
import { throughNarrow } from "./narrow-helper.mjs";
import fs from "node:fs";
import path from "node:path";

const BASE = (process.env.BASE ?? "http://localhost:3300").replace(/\/$/, "");
const ORIGIN = new URL(BASE).origin;
const OUT = path.resolve(process.env.OUT ?? "qa/figma/walk");
fs.mkdirSync(OUT, { recursive: true });
const SENTENCE = "I've had chronic pelvic pain for years. I feel like nobody listens. I want someone experienced with endometriosis who takes a collaborative approach.";


const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const shots = [];
if (process.env.SHARE) { await page.goto(process.env.SHARE); await page.waitForTimeout(1500); }
async function shot(name) {
  await page.waitForTimeout(400);
  const file = path.join(OUT, `${String(shots.length + 1).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  shots.push({ name, file, url: page.url() });
  console.log(name, page.url());
}
/** An app route ("/match/2") under BASE; a rendered href ("/Wattle-Health/doctor/x") under the origin. */
const go = (route) => page.goto(route.startsWith(new URL(BASE).pathname) && new URL(BASE).pathname !== "/" ? `${ORIGIN}${route}` : `${BASE}${route}`);

await go("/splash"); await shot("P01-splash");
await go("/"); await page.evaluate(() => localStorage.setItem("wattle.splash.seen", "true")); await go("/"); await shot("P02-home");
await page.fill("textarea", SENTENCE); await shot("P02-home-filled");
await page.click("text=Find my doctor"); await page.waitForURL(/\/narrow/); await page.waitForTimeout(900); await shot("P03-narrow");
await throughNarrow(page); await page.waitForTimeout(1500); await shot("P05-results");
const first = (await page.locator("a[href*='/doctor/']").first().getAttribute("href")).replace(/\/$/, "");
await go(first); await page.waitForTimeout(700); await shot("P06-profile");
await page.evaluate(() => window.scrollBy(0, 700)); await page.waitForTimeout(300); await shot("P06-profile-2");
for (const t of ["Research", "Practical", "Why this match"]) { const b = page.getByRole("button", { name: new RegExp(`^${t}`) }); if (await b.count()) await b.first().click(); }
await page.waitForTimeout(400); await shot("P06-profile-open");
await page.getByRole("button", { name: /^Call to book/ }).first().click(); await page.waitForTimeout(500); await shot("P06-contact");
await go("/heard"); await shot("P03-heard");
await go(`${first}/expertise`); await shot("P07-expertise");
await go(`${first}/why`); await shot("P09-why");
await go("/adjust"); await shot("P08-adjust");
await go("/results/none"); await shot("P10-nomatch");
await go("/results"); await page.waitForTimeout(800); await page.getByRole("button", { name: "Save" }).first().click({ timeout: 8000 }).catch(() => {}); await page.waitForTimeout(400);
await go("/saved"); await page.waitForTimeout(1500); await shot("tab-saved");
await go("/recent"); await shot("tab-recent");
await go("/me"); await shot("tab-me");
await go("/join"); await shot("C01-join");
await go("/join/verify"); await shot("C02-verify");
await go("/join/practice"); await shot("C03-practice");
await go("/join/interview"); await shot("C04-interview");
await go("/join/interview/3"); await shot("C05-question");
await page.fill("textarea", "um I ask people to tell me the whole story before we talk about options, most have been rushed before"); await page.click("text=Next"); await page.waitForURL(/\/join\/draft\/3/); await page.waitForTimeout(500); await shot("C06-draft");
await go("/join/share"); await shot("C07-share");
await go("/join/review"); await shot("C08-review");
// Laptop: the 560 px reading column on white.
const lap = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
await lap.goto(`${BASE}/`); await lap.evaluate(() => localStorage.setItem("wattle.splash.seen", "true")); await lap.goto(`${BASE}/`);
await lap.fill("textarea", SENTENCE); await lap.click("text=Find my doctor"); await throughNarrow(lap); await lap.waitForTimeout(1500);
await lap.screenshot({ path: path.join(OUT, "99-laptop-results.png") }); shots.push({ name: "laptop-results", file: path.join(OUT, "99-laptop-results.png"), url: lap.url() });
await lap.goto(`${BASE}/`); await lap.waitForTimeout(900);
await lap.screenshot({ path: path.join(OUT, "99-laptop-home.png") }); shots.push({ name: "laptop-home", file: path.join(OUT, "99-laptop-home.png"), url: lap.url() });
await lap.goto(`${ORIGIN}${first}`); await lap.waitForTimeout(700);
await lap.screenshot({ path: path.join(OUT, "99-laptop-profile.png") }); shots.push({ name: "laptop-profile", file: path.join(OUT, "99-laptop-profile.png"), url: lap.url() });
await browser.close();

// contact sheet: 6 per row, each 215x466
const sharp = await import("sharp").catch(() => null);
if (sharp) {
  const w = 215, h = 466, cols = 6, rows = Math.ceil(shots.length / cols);
  const composites = await Promise.all(shots.map(async (s, i) => ({ input: await sharp.default(s.file).resize(w, h).toBuffer(), left: (i % cols) * (w + 10) + 10, top: Math.floor(i / cols) * (h + 10) + 10 })));
  await sharp.default({ create: { width: cols * (w + 10) + 10, height: rows * (h + 10) + 10, channels: 3, background: "#1b1b1b" } }).composite(composites).png().toFile(path.join(OUT, "sheet.png"));
  console.log("sheet.png written");
}
fs.writeFileSync(path.join(OUT, "walk.json"), JSON.stringify(shots, null, 2));
