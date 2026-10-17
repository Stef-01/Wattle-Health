// Crawl every source page, dump every image candidate with context.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'C:/Users/stefa/wattle-health/data/enriched/personal';
const OUT = process.argv[2];
const FILES = ['research-womens-health.json','research-mental-health.json','research-chronic.json','research-brisbane-second-pass.json','research-third-sweep.json'];

const doctors = [];
for (const f of FILES) {
  const d = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  for (const doc of d.doctors) doctors.push({ name: doc.name, specialty: doc.specialty, practice: doc.practice?.name ?? doc.practice, url: doc.source?.url, file: f });
}
const urls = [...new Set(doctors.map(d => d.url))];
const extra = (process.argv[3] ? JSON.parse(fs.readFileSync(process.argv[3],'utf8')) : []);
for (const u of extra) if (!urls.includes(u)) urls.push(u);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36' });
const results = {};
for (const url of urls) {
  const page = await ctx.newPage();
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1500);
    // scroll to trigger lazy loading
    await page.evaluate(async () => {
      const h = document.body.scrollHeight;
      for (let y = 0; y < h + 1000; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(2000);
    const imgs = await page.evaluate(() => {
      const abs = (u) => { try { return new URL(u, location.href).href; } catch { return u; } };
      const out = [];
      for (const img of document.querySelectorAll('img')) {
        const r = img.getBoundingClientRect();
        let ctxEl = img;
        let text = '';
        for (let i = 0; i < 6 && ctxEl; i++) { ctxEl = ctxEl.parentElement; const t = (ctxEl?.innerText || '').replace(/\s+/g, ' ').trim(); if (t.length > 20) { text = t.slice(0, 300); break; } }
        const srcset = img.getAttribute('srcset') || img.getAttribute('data-srcset') || '';
        out.push({
          type: 'img',
          src: abs(img.currentSrc || img.getAttribute('src') || ''),
          attr_src: abs(img.getAttribute('src') || ''),
          data_src: abs(img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('data-original') || ''),
          srcset: srcset.split(',').map(s => s.trim()).filter(Boolean).map(s => { const [u, w] = s.split(/\s+/); return { url: abs(u), w }; }),
          alt: img.getAttribute('alt') || '',
          title: img.getAttribute('title') || '',
          naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight,
          renderedW: Math.round(r.width), renderedH: Math.round(r.height),
          cls: img.className?.toString().slice(0, 100),
          text,
        });
      }
      // background images
      for (const el of document.querySelectorAll('*')) {
        const bg = getComputedStyle(el).backgroundImage;
        if (bg && bg !== 'none' && bg.includes('url(')) {
          const m = bg.match(/url\(["']?([^"')]+)["']?\)/);
          if (!m) continue;
          const r = el.getBoundingClientRect();
          if (r.width < 60 || r.height < 60) continue;
          let ctxEl = el; let text = '';
          for (let i = 0; i < 6 && ctxEl; i++) { const t = (ctxEl?.innerText || '').replace(/\s+/g, ' ').trim(); if (t.length > 20) { text = t.slice(0, 300); break; } ctxEl = ctxEl.parentElement; }
          out.push({ type: 'bg', src: abs(m[1]), alt: el.getAttribute('aria-label') || '', renderedW: Math.round(r.width), renderedH: Math.round(r.height), cls: el.className?.toString().slice(0, 100), text, dataBg: el.getAttribute('data-bg') || el.getAttribute('data-background') || '' });
        }
      }
      return out;
    });
    const title = await page.title();
    results[url] = { status: resp?.status(), final: page.url(), title, imgs };
    console.log(url, resp?.status(), imgs.length);
  } catch (e) {
    results[url] = { error: String(e).slice(0, 300) };
    console.log(url, 'ERR', String(e).slice(0, 120));
  }
  await page.close();
}
await browser.close();
fs.writeFileSync(OUT, JSON.stringify({ doctors, results }, null, 1));
