// Apple pass (2026-10-23): every patient screen at iPhone 15 size, first screen and full page,
// into qa/apple/<OUT>/ (default "after"). Run once before changes with OUT=before to compare.
import { chromium, devices } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { throughNarrow } from "../figma/narrow-helper.mjs";
const BASE = (process.env.BASE ?? "http://localhost:3300").replace(/\/$/, "");
const OUT = path.resolve("qa/apple", process.env.OUT ?? "after");
fs.mkdirSync(OUT, { recursive: true });
const ROUTES = [
  ["home", "/"], ["recent", "/recent"], ["saved", "/saved"], ["me", "/me"], ["me-openings", "/me/openings"],
  ["me-discover", "/me/discover"], ["me-context", "/me/context"], ["healthspan", "/healthspan"], ["about", "/about"],
  ["doctor", "/doctor/general-practice~sian-hebron"], ["doctor-2", "/doctor/obstetrics-gynaecology~tal-jacobson"],
  ["compare", "/compare?ids=general-practice~sian-hebron,obstetrics-gynaecology~tal-jacobson"],
  ["join", "/join"], ["splash", "/splash"],
];
const only = process.env.ONLY?.split(",");
const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const ctx = await b.newContext({ ...devices["iPhone 15"], deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(`${BASE}/`);
await page.evaluate(() => {
  localStorage.setItem("wattle.splash.seen", "true");
  localStorage.setItem("wattle.saved.v1", JSON.stringify(["general-practice:sian-hebron", "obstetrics-gynaecology:tal-jacobson"]));
  localStorage.setItem("wattle.recent.v1", JSON.stringify([
    { id: "a", label: "Endometriosis, Brisbane", condition: "Endometriosis", matches: 3, at: "2026-10-18T10:00:00Z" },
    { id: "b", label: "ADHD, Brisbane", condition: "ADHD", matches: 3, at: "2026-10-17T10:00:00Z" },
  ]));
});
const shot = async (name) => {
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => null);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  await page.screenshot({ path: path.join(OUT, `${name}-full.png`), fullPage: true });
};
for (const [name, r] of ROUTES) {
  if (only && !only.includes(name)) continue;
  await page.goto(`${BASE}${r}`, { waitUntil: "networkidle" }).catch(() => null);
  await page.waitForTimeout(900);
  await shot(name);
}
if (!only || only.includes("flow")) {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.fill("textarea", "Endometriosis, I feel like nobody listens");
  await page.waitForTimeout(300);
  await shot("home-typed");
  await page.locator("button[type=submit], button:has-text('Find')").first().click();
  let n = 0;
  try {
    await throughNarrow(page, { pick: 1, shot: async (s) => { if (n++ < 3) await page.screenshot({ path: path.join(OUT, `${s}.png`) }); } });
  } catch (e) {
    // A cold dev server can spend the helper's iterations compiling /api/match; resume once.
    if (/\/narrow/.test(page.url())) await throughNarrow(page, { pick: 1 }).catch(async () => {
      await page.screenshot({ path: path.join(OUT, "flow-stuck.png") });
      console.log("flow stuck at", page.url(), String(e).slice(0, 120));
    });
  }
  await page.waitForTimeout(2200);
  await shot("results");
}
await b.close();
console.log("wrote", OUT);
