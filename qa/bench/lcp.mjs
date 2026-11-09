import { chromium } from "@playwright/test";
const b = await chromium.launch(); const out=[];
for (let i=0;i<3;i++){ const c=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}); const p=await c.newPage();
await p.addInitScript(()=>{window.__lcp=[];new PerformanceObserver(l=>{for(const e of l.getEntries())window.__lcp.push({t:Math.round(e.startTime),el:e.element?.tagName,url:(e.url||'').slice(-20)})}).observe({type:'largest-contentful-paint',buffered:true});});
await p.goto("https://wattlehealth.vercel.app/doctor/general-practice~sian-hebron",{waitUntil:"networkidle"}); await p.waitForTimeout(500);
const nav=await p.evaluate(()=>{const n=performance.getEntriesByType('navigation')[0];return {ttfb:Math.round(n.responseStart),fcp:Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime||0),lcp:window.__lcp.at(-1)}});
out.push(nav); await c.close(); }
console.log(JSON.stringify(out)); await b.close();
