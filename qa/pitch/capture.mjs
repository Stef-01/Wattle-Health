// Pitch-film capture: the ADHDme-branded app on an iPhone 15, every step of the showcase flow.
// search → guided questions → top pick → profile → About tab → book; calendar connect → opening prompt → booked; Openings.
// usage: BASE=https://wattlehealth.vercel.app OUT=<dir> node qa/pitch/capture.mjs
import { chromium, devices } from "@playwright/test";
import { throughNarrow } from "../figma/narrow-helper.mjs";
import fs from "node:fs";
import path from "node:path";

const BASE = (process.env.BASE ?? "https://wattlehealth.vercel.app").replace(/\/$/, "");
const OUT = path.resolve(process.env.OUT ?? "qa/pitch/shots");
fs.mkdirSync(OUT, { recursive: true });
const QUERY = "Adult ADHD, someone who gets it";
const log = {};
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices["iPhone 15"], deviceScaleFactor: 3 });
const page = await ctx.newPage();
const shot = (n, full = false) => page.screenshot({ path: path.join(OUT, `${n}.png`), fullPage: full });
const brand = () => page.evaluate(() => { localStorage.setItem("wattle.splash.seen", "true"); localStorage.setItem("wattle.brand.v1", "adhdme"); });

await page.goto(`${BASE}/`); await brand();
await page.goto(`${BASE}/splash`); await page.waitForTimeout(1500); await shot("a-splash");
await page.goto(`${BASE}/`); await page.waitForTimeout(1200); await shot("b-home");
const box = page.locator("textarea, input[type=text]").first();
for (const [k, n] of [[1, 8], [2, 18], [3, 30], [4, QUERY.length]]) { await box.fill(QUERY.slice(0, n)); await page.waitForTimeout(150); await shot(`c-type-${k}`); }
await page.getByText("Find my provider").click();
// answer like an adult seeking an ADHD assessment, not the helper's first option
const PREFER = [/^18 to/i, /been through it too/i, /^me$/i, /first time/i, /assessment or diagnosis/i, /yes, a gp/i, /open to either/i];
await page.waitForURL(/\/narrow/);
for (let i = 0; i < 14; i++) {
  if (/\/results/.test(page.url())) break;
  await page.waitForTimeout(700);
  await shot(`d-narrow-${String(i).padStart(2, "0")}`);
  const see = page.getByRole("button", { name: "See your picks" });
  if (await see.count()) { await see.click(); break; }
  const opts = page.locator("[data-answer]");
  const n = await opts.count();
  if (n) {
    const texts = await opts.allInnerTexts();
    let k = 0;
    for (const re of PREFER) { const j = texts.findIndex((t) => re.test(t.trim())); if (j >= 0) { k = j; break; } }
    log["q" + i] = texts[k].split(/\n/)[0] + "  <- " + texts.map((t) => t.split(/\n/)[0]).join(" / ");
    await opts.nth(k).click();
  }
  await page.getByRole("button", { name: "Continue" }).click().catch(() => {});
}
await page.waitForURL(/\/results/, { timeout: 25000 });
await page.waitForSelector("text=Your top pick", { timeout: 30000 });
await page.waitForTimeout(1500); await page.evaluate(() => window.scrollTo(0, 0));
await shot("e-results"); await shot("e-results-full", true);

const first = page.locator("a[href*='/doctor']").first();
log.doctorHref = await first.getAttribute("href");
await first.click(); await page.waitForTimeout(2500);
await shot("f-profile"); await shot("f-profile-full", true);
log.doctorName = (await page.locator("h1").first().innerText().catch(() => "")).trim();
await page.getByRole("tab", { name: "About" }).click(); await page.waitForTimeout(900);
await shot("g-about"); await shot("g-about-full", true);
await page.evaluate(() => window.scrollTo(0, 0));
const cta = page.locator('a:has-text("Next free"), button:has-text("Next free")').first();
await cta.scrollIntoViewIfNeeded().catch(() => {}); await page.waitForTimeout(600); await shot("h-nextfree");
if (await cta.count()) { await cta.click(); await page.waitForTimeout(900); await shot("h-book"); }
log.cta = await cta.innerText().catch(() => "none");

// Openings: save this doctor, connect the calendar, then the opening prompt on home
const id = decodeURIComponent((log.doctorHref || "").split("/doctor/")[1] || "").replace("~", ":");
await page.evaluate((id) => { localStorage.setItem("wattle.saved.v1", JSON.stringify([id])); localStorage.removeItem("wattle.openings.v1"); }, id);
await page.goto(`${BASE}/me/openings`);
await page.waitForSelector("text=Connect a calendar", { timeout: 15000 }); await page.waitForTimeout(500); await shot("i-connect");
await page.getByRole("button", { name: /^Google/ }).click();
await page.waitForSelector("text=Free and busy times only."); await page.waitForTimeout(500); await shot("j-sheet");
await page.getByRole("button", { name: "Connect", exact: true }).click();
await page.waitForSelector("text=/Connected/", { timeout: 10000 }); await page.waitForTimeout(600); await shot("k-connected"); await shot("k-connected-full", true);
await page.goto(`${BASE}/`);
const prompt = page.locator("text=/just opened up/");
await prompt.waitFor({ timeout: 15000 }).catch(() => {});
await page.waitForTimeout(700); await shot("l-prompt");
log.prompt = await page.locator("text=/just opened up/").first().evaluate((e) => e.closest("div[role], section, div")?.innerText ?? e.innerText).catch(() => "none");
const bookBtn = page.getByRole("button", { name: /Book/ }).first();
if (await bookBtn.count()) { await bookBtn.click(); await page.waitForSelector("text=/Booked with/", { timeout: 10000 }).catch(() => {}); await page.waitForTimeout(500); await shot("m-booked"); }
log.booked = await page.locator("text=/Booked with/").first().evaluate((e) => e.parentElement?.innerText ?? "").catch(() => "none");
await page.goto(`${BASE}/me/openings`); await page.waitForTimeout(1500); await shot("n-openings"); await shot("n-openings-full", true);
fs.writeFileSync(path.join(OUT, "log.json"), JSON.stringify(log, null, 1));
console.log(JSON.stringify(log, null, 1));
await b.close();
