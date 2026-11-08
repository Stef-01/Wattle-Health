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
await page.waitForTimeout(1500); // hydration on a cold production load; typing before it leaves React unaware of the values
await page.getByPlaceholder(/MED/i).fill("MED0009990001");
await page.getByPlaceholder(/Dr Nathan Reilly/i).fill("Dr Test Inbox");
await page.getByPlaceholder(/yourpractice/i).fill("qa@example-practice.com.au");
const look = page.getByRole("button", { name: /Look me up/ });
if (await look.isDisabled()) { await page.getByPlaceholder(/MED/i).fill(""); await page.getByPlaceholder(/MED/i).type("MED0009990001", { delay: 20 }); await page.waitForTimeout(300); }
log("look me up enabled:", !(await look.isDisabled()));
await look.click();
// the lookup loads the roster on a cold function (about 5 s on production); the button then reads "That's me"
const thatsMe = page.getByRole("button", { name: /That.s me/ });
await thatsMe.waitFor({ timeout: 30000 });
await page.screenshot({ path: `${OUT}/join-1-lookup.png` });
await thatsMe.click();
await page.waitForURL(/practice/, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(800);
log("after verify:", page.url().replace(BASE, ""));
await page.screenshot({ path: `${OUT}/join-2-after-verify.png` });
if (/practice/.test(page.url())) {
  const practice = page.getByPlaceholder(/Spring Hill/i); if (await practice.count()) await practice.fill("QA Practice");
  const fee = page.getByPlaceholder(/280/); if (await fee.count()) await fee.fill("200");
  await page.getByRole("button", { name: /Continue/ }).click(); await page.waitForURL(/interview/, { timeout: 30000 }).catch(() => {}); await page.waitForTimeout(600);
}
log("after practice:", page.url().replace(BASE, ""));
const skip = page.getByText(/Skip for now/).first(); if (await skip.count()) { await skip.click(); await page.waitForURL(/share|review/, { timeout: 30000 }).catch(() => {}); await page.waitForTimeout(600); }
log("after interview:", page.url().replace(BASE, ""));
if (/share/.test(page.url())) { await page.getByText(/^Continue$/).first().click(); await page.waitForURL(/review/, { timeout: 30000 }).catch(() => {}); await page.waitForTimeout(600); }
log("after share:", page.url().replace(BASE, ""));
const publish = page.getByRole("button", { name: /Publish/ }).first();
if (await publish.count()) { await publish.click(); await page.getByText(/^Submitted\.$/).waitFor({ timeout: 30000 }).catch(() => {}); await page.waitForTimeout(600); }
log("after publish:", page.url().replace(BASE, ""), "|", (await page.locator("h1").first().innerText().catch(() => "")).trim());
await page.screenshot({ path: `${OUT}/join-3-submitted.png` });
await browser.close();
