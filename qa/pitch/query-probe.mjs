// Which typed query does the results summary echo back cleanly?
import { chromium, devices } from "@playwright/test";
const BASE = process.env.BASE ?? "https://wattlehealth.vercel.app";
const PREFER = [/^18 to/i, /a woman|female/i, /^18 to/i, /been through it too/i, /^me$/i, /first time/i, /assessment or diagnosis/i, /yes, a gp/i, /open to either/i];
const b = await chromium.launch();
for (const q of (process.env.QS ?? "").split("|")) {
  const p = await (await b.newContext({ ...devices["iPhone 15"] })).newPage();
  await p.goto(BASE); await p.evaluate(() => { localStorage.setItem("wattle.splash.seen", "true"); localStorage.setItem("wattle.brand.v1", "adhdme"); });
  await p.goto(BASE); await p.locator("textarea").first().fill(q); await p.getByText("Find my provider").click();
  await p.waitForURL(/\/narrow/);
  for (let i = 0; i < 14 && !/\/results/.test(p.url()); i++) {
    await p.waitForTimeout(600);
    const see = p.getByRole("button", { name: "See your picks" }); if (await see.count()) { await see.click(); break; }
    const o = p.locator("[data-answer]"); const n = await o.count();
    if (n) { const t = await o.allInnerTexts(); let k = 0; for (const re of PREFER) { const j = t.findIndex((x) => re.test(x.trim())); if (j >= 0) { k = j; break; } } await o.nth(k).click(); }
    await p.getByRole("button", { name: "Continue" }).click().catch(() => {});
  }
  await p.waitForSelector("text=Your top pick", { timeout: 30000 });
  const sum = await p.locator("text=You searched").locator("xpath=..").innerText().catch(() => "?");
  const top = await p.locator("a[href*='/doctor']").first().getAttribute("href");
  console.log(JSON.stringify({ q, sum: sum.replace(/\n/g, " | ").slice(0, 160), top }));
}
await b.close();
