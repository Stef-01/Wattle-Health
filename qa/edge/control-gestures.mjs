// The switch and the opening notification against the gestures skill. Switch: a tap flips it once (no double
// toggle from pointer + click), a drag across the knob's travel flips it, a drag back flips it back, a short drag
// snaps back. Notification: swipe up dismisses (and records "not now"), a short pull snaps back, a pull down
// rubber-bands. Exit 1 on any miss. BASE= for another server.
import { chromium, devices } from "@playwright/test";
const BASE = (process.env.BASE ?? "http://localhost:3300").replace(/\/$/, "");
const b = await chromium.launch();
const page = await (await b.newContext({ ...devices["iPhone 15"] })).newPage();
const fails = [];
const check = (name, ok, detail) => { console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? `  (${detail})` : ""}`); if (!ok) fails.push(name); };
const drag = async (x, y, dx, dy, steps = 8, ms = 16) => { await page.mouse.move(x, y); await page.mouse.down(); for (let i = 1; i <= steps; i++) { await page.mouse.move(x + (dx * i) / steps, y + (dy * i) / steps); await page.waitForTimeout(ms); } };

// --- switch, on the Healthspan landing (two switches, no sheet in the way)
await page.goto(`${BASE}/`);
await page.evaluate(() => { localStorage.setItem("wattle.splash.seen", "true"); localStorage.setItem("wattle.saved.v1", JSON.stringify(["general-practice:sian-hebron"])); localStorage.removeItem("wattle.openings.v1"); });
await page.goto(`${BASE}/healthspan`, { waitUntil: "networkidle" }); await page.waitForTimeout(500);
const sw = page.getByRole("switch", { name: "Telehealth is fine" });
const on = () => sw.getAttribute("aria-checked");
const before = await on();
await sw.click(); await page.waitForTimeout(250);
check("a tap flips the switch exactly once", (await on()) !== before, `${before} -> ${await on()}`);
await sw.click(); await page.waitForTimeout(250);
check("a second tap flips it back", (await on()) === before);
let box = await sw.boundingBox(); const cy = box.y + box.height / 2;
const wasOn = (await on()) === "true";
await drag(box.x + (wasOn ? 38 : 14), cy, wasOn ? -24 : 24, 0); await page.waitForTimeout(250); await page.mouse.up(); await page.waitForTimeout(300);
check("a drag across the travel flips it", ((await on()) === "true") !== wasOn, `now ${await on()}`);
const midKnob = await page.evaluate(() => { const k = document.querySelector('[role=switch][aria-label="Telehealth is fine"] span'); return new DOMMatrixReadOnly(getComputedStyle(k).transform).m41; });
check("the knob rests at its end after the drag", Math.abs(midKnob - (wasOn ? 0 : 20)) < 1, `x ${midKnob}`);
box = await sw.boundingBox();
await drag(box.x + (wasOn ? 14 : 38), cy, wasOn ? 24 : -24, 0); await page.waitForTimeout(250); await page.mouse.up(); await page.waitForTimeout(300);
check("a drag back flips it back", ((await on()) === "true") === wasOn);
// a short drag (6 px) snaps back without flipping
await drag(box.x + (wasOn ? 38 : 14), cy, wasOn ? -6 : 6, 0, 4); await page.waitForTimeout(250); await page.mouse.up(); await page.waitForTimeout(300);
check("a short drag snaps back without flipping", ((await on()) === "true") === wasOn);
// mid-drag the knob is where the finger is (1:1) and the track colour is between the two
await drag(box.x + (wasOn ? 38 : 14), cy, wasOn ? -10 : 10, 0, 5);
const mid = await page.evaluate(() => { const t = document.querySelector('[role=switch][aria-label="Telehealth is fine"]'); const k = t.querySelector("span"); return { x: new DOMMatrixReadOnly(getComputedStyle(k).transform).m41, bg: t.style.backgroundColor }; });
check("mid-drag the knob tracks the finger", Math.abs(mid.x - (wasOn ? 10 : 10)) <= 1.5, `x ${mid.x.toFixed(1)}`);
check("mid-drag the track colour is derived from the knob's position", /color-mix/.test(mid.bg), mid.bg.slice(0, 60));
await page.mouse.up(); await page.waitForTimeout(300);

// --- the opening notification: connect a calendar, wait for the prompt
await page.goto(`${BASE}/me/openings`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: /^Google/ }).click();
await page.getByRole("button", { name: "Connect", exact: true }).click();
await page.waitForSelector("text=/Connected/", { timeout: 10000 });
// The prompt is checked once per page visit, 2.5 s after it loads, and at most once every three days; it may already
// have shown here while connecting, so clear that stamp and visit Home, where it shows within 2.5 s.
await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("wattle.openings.v1") ?? "{}"); delete s.lastPromptAt; s.dismissed = []; localStorage.setItem("wattle.openings.v1", JSON.stringify(s)); });
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.waitForSelector('[role=dialog][aria-label="Appointment opening"]', { timeout: 20000 }); await page.waitForTimeout(600);
const card = page.getByRole("dialog", { name: "Appointment opening" });
let cb = await card.boundingBox();
const ty = () => page.evaluate(() => { const c = document.querySelector('[role=dialog][aria-label="Appointment opening"]'); return c ? { y: Math.round(new DOMMatrixReadOnly(getComputedStyle(c).transform).m42), o: Number(getComputedStyle(c).opacity).toFixed(2) } : null; });
// pull down: rubber-band (a fifth of the distance)
await drag(cb.x + cb.width / 2, cb.y + 12, 0, 60, 6); let t = await ty();
check("pulling the notification down rubber-bands", t && t.y > 0 && t.y <= 14, JSON.stringify(t));
await page.mouse.up(); await page.waitForTimeout(500); t = await ty();
check("released, it settles back to rest", t && t.y === 0, JSON.stringify(t));
// short swipe up: snaps back
await drag(cb.x + cb.width / 2, cb.y + 12, 0, -20, 4); await page.waitForTimeout(250); t = await ty();
check("mid-swipe it tracks the finger and fades with its travel", t && t.y === -20 && Number(t.o) < 1, JSON.stringify(t));
await page.mouse.up(); await page.waitForTimeout(500); t = await ty();
check("a short swipe snaps back", t && t.y === 0 && Number(t.o) === 1, JSON.stringify(t));
// long swipe up: dismisses and records not-now
cb = await card.boundingBox();
await drag(cb.x + cb.width / 2, cb.y + 12, 0, -(cb.height * 0.5), 8); await page.waitForTimeout(200); await page.mouse.up(); await page.waitForTimeout(700);
const stillThere = await card.isVisible().catch(() => false);
check("a swipe up past a third of its height dismisses the notification", !stillThere);
const dismissed = await page.evaluate(() => (JSON.parse(localStorage.getItem("wattle.openings.v1") ?? "{}").dismissed ?? []).length);
check("the swipe recorded 'not now' for that opening", dismissed === 1, `dismissed ${dismissed}`);
await b.close();
console.log(fails.length ? `\n${fails.length} failure(s):\n${fails.join("\n")}` : "\ncontrol gestures: clean");
process.exit(fails.length ? 1 : 0);
