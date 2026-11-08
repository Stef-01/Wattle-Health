// The join flow end to end against a server: verify → practice → skip the interview → review → publish.
// Prints what each step returned on screen; BASE for production. Rows land in join_submissions (inbox mode)
// or the full tables (service role), checked separately.
import { chromium } from "@playwright/test";
import fs from "node:fs";
const BASE = process.env.BASE ?? "http://localhost:3300";
const OUT = process.env.OUT ?? "shots";
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
const log = (...a) => console.log(...a);
await page.goto(`${BASE}/join/verify`, { waitUntil: "networkidle" });
log("banner:", (await page.getByText(/Local mode/).count()) ? "local mode shown" : "none");
await page.getByPlaceholder(/MED/i).fill("MED0009990001");
await page.getByPlaceholder(/Dr Nathan Reilly/i).fill("Dr Test Inbox");
await page.getByPlaceholder(/yourpractice/i).fill("qa@example-practice.com.au");
await page.getByRole("button", { name: /Look me up/ }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/join-1-lookup.png` });
const thatsMe = page.getByRole("button", { name: /That.s me|Continue|Yes/ }).first();
if (await thatsMe.count()) { await thatsMe.click(); await page.waitForTimeout(1200); }
log("after verify:", page.url().replace(BASE, ""));
await page.screenshot({ path: `${OUT}/join-2-after-verify.png` });
if (/practice/.test(page.url())) {
  const practice = page.getByPlaceholder(/Spring Hill/i); if (await practice.count()) await practice.fill("QA Practice");
  const fee = page.getByPlaceholder(/280/); if (await fee.count()) await fee.fill("200");
  await page.getByRole("button", { name: /Continue/ }).click(); await page.waitForTimeout(1200);
}
log("after practice:", page.url().replace(BASE, ""));
const skip = page.getByText(/Skip for now/).first(); if (await skip.count()) { await skip.click(); await page.waitForTimeout(1200); }
log("after interview:", page.url().replace(BASE, ""));
const publish = page.getByRole("button", { name: /Publish/ }).first();
if (await publish.count()) { await publish.click(); await page.waitForTimeout(2500); }
log("after publish:", page.url().replace(BASE, ""), "|", (await page.locator("h1").first().innerText().catch(() => "")).trim());
await page.screenshot({ path: `${OUT}/join-3-submitted.png` });
await browser.close();
