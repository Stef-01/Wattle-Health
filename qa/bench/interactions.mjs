// Runtime cost of the interactions a phone feels, on production, with CPU throttled 4x and a 4G network:
// long tasks (>50 ms) during each step and the event-timing duration of each tap. Prints a table.
import { chromium } from "@playwright/test";
const BASE = process.env.BASE ?? "https://wattlehealth.vercel.app";
const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
const p = await c.newPage(); const cdp = await c.newCDPSession(p);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: Number(process.env.CPU ?? 4) });
await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 });
await p.addInitScript(() => {
  localStorage.setItem("wattle.splash.seen", "true");
  window.__lt = []; window.__ev = [];
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push({ t: Math.round(e.startTime), d: Math.round(e.duration) }); }).observe({ type: "longtask", buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.duration > 40) window.__ev.push({ n: e.name, d: Math.round(e.duration), t: Math.round(e.startTime) }); }).observe({ type: "event", buffered: true, durationThreshold: 40 });
});
const rows = [];
const step = async (name, fn) => {
  const t0 = await p.evaluate(() => performance.now());
  await fn(); await p.waitForTimeout(1200);
  const r = await p.evaluate((t0) => { const lt = window.__lt.filter((x) => x.t >= t0); const ev = window.__ev.filter((x) => x.t >= t0); return { tasks: lt.length, longest: Math.max(0, ...lt.map((x) => x.d)), blocked: lt.reduce((s, x) => s + Math.max(0, x.d - 50), 0), slowest: ev.sort((a, b) => b.d - a.d)[0] ?? null }; }, t0);
  rows.push({ step: name, ...r, slowest: r.slowest ? `${r.slowest.n} ${r.slowest.d} ms` : "none >40 ms" });
};
await step("load home", async () => { await p.goto(`${BASE}/`, { waitUntil: "networkidle" }); });
await step("tap Recent tab", async () => { await p.tap("nav a[href='/recent']"); await p.waitForURL(/recent/); });
await step("tap Home tab", async () => { await p.tap("nav a[href='/']"); await p.waitForURL(/\/$/); });
await step("tap example", async () => { await p.getByRole("button", { name: /Endometriosis, someone who/ }).tap(); await p.waitForURL(/narrow/); });
await step("skip to picks", async () => { await p.getByText(/Skip to my picks/).first().tap(); await p.waitForURL(/results/, { timeout: 30000 }); await p.waitForTimeout(2000); });
await step("scroll results 3 screens", async () => { for (let i = 0; i < 3; i++) { await p.mouse.wheel(0, 800); await p.waitForTimeout(250); } });
await step("open Refine sheet", async () => { await p.getByRole("button", { name: /Refine/ }).tap(); });
await step("close sheet (scrim)", async () => { await p.locator(".sheet-scrim").tap({ position: { x: 10, y: 10 } }); });
await step("tap first card → profile", async () => { await p.locator("main a[href^='/doctor/']").first().tap(); await p.waitForURL(/doctor/, { timeout: 30000 }); });
await step("toggle save heart", async () => { await p.getByRole("button", { name: /^Save$|Remove from saved/ }).first().tap(); });
await step("tap Saved tab", async () => { await p.tap("nav a[href='/saved']"); await p.waitForURL(/saved/); });
console.table(rows);
const loaded = await p.evaluate(() => performance.getEntriesByType("resource").filter((r) => /\.js(\?|$)/.test(r.name)).reduce((s, r) => s + (r.transferSize || 0), 0));
console.log("JS transferred this session:", Math.round(loaded / 1024), "KB");
await b.close();
