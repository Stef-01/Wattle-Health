// The profile portrait must never disappear after hydration: sample its computed opacity and the
// shimmer's presence every 50 ms from navigation to 3 s, in a throttled mobile context, on production.
import { chromium } from "@playwright/test";
const BASE = process.env.BASE ?? "https://wattlehealth.vercel.app";
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const p = await c.newPage();
const cdp = await c.newCDPSession(p);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 });
await p.addInitScript(() => {
  window.__frames = [];
  const tick = () => {
    const img = document.querySelector("img.img-fade");
    const sh = document.querySelector(".shimmer");
    window.__frames.push({ t: Math.round(performance.now()), img: img ? getComputedStyle(img).opacity : null, loaded: img?.dataset.loaded ?? null, complete: img?.complete ?? null, shimmer: !!sh });
    if (performance.now() < 3000) setTimeout(tick, 50);
  };
  tick();
});
await p.goto(`${BASE}/doctor/general-practice~sian-hebron`, { waitUntil: "load" });
await p.waitForTimeout(3200);
const frames = await p.evaluate(() => window.__frames);
const withImg = frames.filter((f) => f.img !== null);
const invisibleAfterComplete = withImg.filter((f) => f.complete && Number(f.img) < 0.99);
const first = withImg[0], firstLoadedTrue = withImg.find((f) => f.loaded === "true");
console.log(`frames ${frames.length}, img present from ${first?.t} ms, data-loaded=true from ${firstLoadedTrue?.t ?? "never"} ms`);
console.log(`frames where the image was complete but not fully opaque: ${invisibleAfterComplete.length}`);
if (invisibleAfterComplete.length) console.log(JSON.stringify(invisibleAfterComplete.slice(0, 5)));
console.log("sample:", JSON.stringify(withImg.filter((_, i) => i % 6 === 0).slice(0, 12)));
await b.close();
process.exit(invisibleAfterComplete.length ? 1 : 0);
