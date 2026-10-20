// Simulator recording of the ADHDme app for the pitch film: the live app on an iPhone 15 (393x852 @3x),
// recorded frame by frame through Chrome's screencast, so every frame is a real app state (real typing,
// real page transitions, real scrolling). Every action is logged with its time so the film can retime the
// recording to the founders' voice without ever cutting inside a state.
// usage: OUT=<dir> node qa/pitch/simrec.mjs   ->  <dir>/f/<n>.jpg, <dir>/frames.json, <dir>/events.json
import { chromium, devices } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = (process.env.BASE ?? "https://wattlehealth.vercel.app").replace(/\/$/, "");
const OUT = path.resolve(process.env.OUT ?? "qa/pitch/sim");
const QUERY = "ADHD. A doctor who’s lived it. Telehealth is fine.";
const PREFER = [/^18 to/i, /been through it too/i, /^me$/i, /first time/i, /assessment or diagnosis/i, /yes, a gp/i, /open to either/i];
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "f"), { recursive: true });

const b = await chromium.launch();
const ctx = await b.newContext({ ...devices["iPhone 15"], viewport: { width: 393, height: 852 }, screen: { width: 393, height: 852 }, deviceScaleFactor: 3 });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
const frames = [], events = [];
let recording = false, n = 0;
cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
  if (recording) {
    const f = `${String(n++).padStart(5, "0")}.jpg`;
    fs.writeFileSync(path.join(OUT, "f", f), Buffer.from(data, "base64"));
    frames.push({ f, t: metadata.timestamp });
  }
  await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
});
const now = () => Date.now() / 1000;
const mark = (name) => { events.push({ name, t: now() }); console.log("mark", name); };
const wait = (ms) => page.waitForTimeout(ms);
// smooth scroll with an ease-in-out curve, like a finger flick that settles
const glide = (dy, ms) => page.evaluate(([dy, ms]) => new Promise((res) => {
  const y0 = window.scrollY, t0 = performance.now();
  const step = (t) => { const k = Math.min(1, (t - t0) / ms), e = k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2; window.scrollTo(0, y0 + dy * e); k < 1 ? requestAnimationFrame(step) : res(); };
  requestAnimationFrame(step);
}), [dy, ms]);
const glideTo = async (sel, offset, ms) => {
  const y = await page.locator(sel).first().evaluate((e, off) => e.getBoundingClientRect().top + window.scrollY - off, offset);
  await glide(y - (await page.evaluate(() => window.scrollY)), ms);
};

// ---- state before recording: ADHDme brand, a first-time visitor (splash shows)
await page.goto(`${BASE}/`);
await page.evaluate(() => { localStorage.clear(); localStorage.setItem("wattle.brand.v1", "adhdme"); });
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1179, maxHeight: 2556, everyNthFrame: 1 });
recording = true;

// ===== PART A: open the app, say what you need, a few questions, the right person, their own words
mark("A.launch");
await page.goto(`${BASE}/splash`); await wait(2200);
mark("A.home");
await page.goto(`${BASE}/`); await page.evaluate(() => localStorage.setItem("wattle.splash.seen", "true"));
await page.locator("textarea").first().waitFor(); await wait(900);
mark("A.type");
await page.locator("textarea").first().tap(); await wait(300);
await page.keyboard.type(QUERY, { delay: 85 });
await wait(700);
mark("A.find");
await page.getByText("Find my provider").tap();
await page.waitForURL(/\/narrow/);
for (let i = 0; i < 14 && !/\/results/.test(page.url()); i++) {
  await wait(900);
  const see = page.getByRole("button", { name: "See your picks" });
  if (await see.count()) { mark("A.see"); await see.tap(); break; }
  const o = page.locator("[data-answer]"); const c = await o.count();
  if (c) {
    const t = await o.allInnerTexts(); let k = 0;
    for (const re of PREFER) { const j = t.findIndex((x) => re.test(x.trim())); if (j >= 0) { k = j; break; } }
    mark(`A.q${i}`); await o.nth(k).tap(); await wait(450);
  } else mark(`A.intro${i}`);
  await page.getByRole("button", { name: "Continue" }).tap().catch(() => {});
}
await page.waitForSelector("text=Your top pick", { timeout: 30000 });
mark("A.results"); await wait(1400);
await glide(330, 2000); await wait(600);
mark("A.pick");
await page.locator("a[href*='/doctor']").first().tap();
await page.waitForURL(/\/doctor\//); await page.evaluate(() => window.scrollTo(0, 0)); await wait(1500);
mark("A.profile");
await glideTo("[role=tablist], [role=tab]", 160, 1300); await wait(500);
mark("A.about");
await page.getByRole("tab", { name: "About" }).tap(); await wait(900);
await glide(950, 3200); await wait(600);
mark("A.end");

// ===== PART B: the next free time, connect the calendar, the opening arrives, book, Openings
await glideTo('a:has-text("Next free"), button:has-text("Next free")', 520, 1600); await wait(1500);
mark("B.nextfree"); await wait(2200);
const href = new URL(page.url()).pathname.split("/doctor/")[1];
const quiet = () => page.evaluate(() => { const k = "wattle.openings.v1"; const s = JSON.parse(localStorage.getItem(k) || "{}"); s.lastPromptAt = Date.now(); localStorage.setItem(k, JSON.stringify(s)); });
const prompt = () => page.evaluate(() => { const k = "wattle.openings.v1"; const s = JSON.parse(localStorage.getItem(k) || "{}"); delete s.lastPromptAt; localStorage.setItem(k, JSON.stringify(s)); });
await page.evaluate((id) => { localStorage.setItem("wattle.saved.v1", JSON.stringify([decodeURIComponent(id).replace("~", ":")])); localStorage.removeItem("wattle.openings.v1"); }, href);
await quiet();   // no in-app prompt while connecting the calendar: the film's lock screen is the one notification
mark("B.openings");
await page.goto(`${BASE}/me/openings`); await page.waitForSelector("text=Connect a calendar"); await wait(1200);
mark("B.connect");
await page.getByRole("button", { name: /^Google/ }).tap();
await page.waitForSelector("text=Free and busy times only."); await wait(1500);
mark("B.allow");
await page.getByRole("button", { name: "Connect", exact: true }).tap();
await page.waitForSelector("text=/Connected/", { timeout: 10000 }); await wait(1400);
mark("B.home");
await prompt();  // now let the opening through: this is what the lock-screen notification opens into
await page.goto(`${BASE}/`);
await page.locator("text=/just opened up/").first().waitFor({ timeout: 15000 }).catch(() => {}); await wait(1600);
mark("B.book");
await page.getByRole("button", { name: /Book follow-up/ }).first().tap();
await page.waitForSelector("text=/Booked with/", { timeout: 10000 }).catch(() => {}); await wait(2000);
await quiet();   // no second prompt after booking
mark("B.list");
await page.goto(`${BASE}/me/openings`); await wait(1200);
await glide(260, 2400); await wait(800);
mark("B.end");

recording = false;
await cdp.send("Page.stopScreencast");
fs.writeFileSync(path.join(OUT, "frames.json"), JSON.stringify(frames));
fs.writeFileSync(path.join(OUT, "events.json"), JSON.stringify(events, null, 1));
console.log(`${frames.length} frames over ${(frames.at(-1).t - frames[0].t).toFixed(1)} s`);
await b.close();
