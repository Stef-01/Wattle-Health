// Walks the guided questions: Continue on the entry screen, the given option (default first) on
// each question, then "See your matches" on the summary. Optional `shot(name)` captures each screen.
export async function throughNarrow(p, { pick = 0, shot } = {}) {
  await p.waitForURL(/\/narrow/);
  for (let i = 0; i < 14; i++) {
    if (/\/results/.test(p.url())) break;
    const see = p.getByRole("button", { name: "See your matches" });
    const radios = p.locator("[data-answer]");
    const cont = p.getByRole("button", { name: "Continue" });
    await p.waitForFunction(() => /Answer a few questions|of \d+|searching for/.test(document.body.innerText) || /results/.test(location.href), null, { timeout: 15000 }).catch(() => {});
    if (shot) await shot(`narrow-${String(i).padStart(2, "0")}`);
    if (await see.count()) { await see.click(); break; }
    if (await radios.count()) {
      const n = await radios.count();
      await radios.nth(Math.min(pick, n - 1)).click();
      await cont.click();
    } else if (await cont.count()) {
      await cont.click();
    }
    await p.waitForTimeout(450);
  }
  await p.waitForURL(/\/results/, { timeout: 25000 });
}
