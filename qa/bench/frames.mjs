// Dropped frames while scrolling Results and the profile, with the glass effects on and off, in Chromium (4x CPU)
// and in WebKit (the Safari engine). A frame over 32 ms is a visible hitch at 60 Hz; over 16 ms a hitch at 120 Hz.
import { chromium, webkit, devices } from "@playwright/test";
const BASE = process.env.BASE ?? "https://wattlehealth.vercel.app";
const KILL = `.glass, .glass-dark, nav, .scroll-edge, .scroll-edge-bottom, .sheet-scrim, .sheet-panel { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; mask-image: none !important; -webkit-mask-image: none !important; }`;
const run = async (engine, label, throttle) => {
  const b = await engine.launch(); const c = await b.newContext(engine === webkit ? { ...devices["iPhone 14"] } : { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  const p = await c.newPage();
  if (throttle && engine === chromium) { const cdp = await c.newCDPSession(p); await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 }); }
  await p.addInitScript(() => localStorage.setItem("wattle.splash.seen", "true"));
  const out = [];
  for (const glass of [true, false]) {
    await p.goto(`${BASE}/`, { waitUntil: "networkidle" }); await p.waitForTimeout(300);
    await p.getByRole("button", { name: /Endometriosis, someone who/ }).click(); await p.waitForURL(/narrow/); await p.waitForTimeout(500);
    await p.getByText(/Skip to my picks/).first().click(); await p.waitForURL(/results/, { timeout: 30000 }); await p.waitForTimeout(2000);
    if (!glass) await p.addStyleTag({ content: KILL });
    const m = await p.evaluate(async () => {
      const frames = []; let last = performance.now(); let on = true;
      const tick = (t) => { frames.push(t - last); last = t; if (on) requestAnimationFrame(tick); }; requestAnimationFrame(tick);
      const start = performance.now(); let y = 0;
      while (performance.now() - start < 2500) { y += 18; window.scrollTo(0, y); await new Promise((r) => requestAnimationFrame(r)); }
      on = false; await new Promise((r) => setTimeout(r, 50));
      const f = frames.slice(2); const over32 = f.filter((d) => d > 32).length, over16 = f.filter((d) => d > 16.9).length;
      return { frames: f.length, over32, over16, worst: Math.round(Math.max(...f)), avg: +(f.reduce((a, b) => a + b, 0) / f.length).toFixed(1) };
    });
    out.push({ engine: label, glass, ...m });
  }
  await b.close(); return out;
};
const rows = [...(await run(chromium, "chromium 4x cpu", true)), ...(await run(webkit, "webkit", false))];
console.table(rows);
