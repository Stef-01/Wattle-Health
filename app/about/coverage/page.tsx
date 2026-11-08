// Every state, counted (2026-10-24): who in this mode's roster sees people in each state, prescribers
// apart, because ADHD medication is authorised state by state. A state no prescriber reaches says so.
import { coverage, coverageLine, STATE_NAMES } from "@/src/data/coverage";
import { getDoctors } from "@/src/data/providers";
import { scopeRoster } from "@/src/server/mode";
import { ByMode } from "@/src/ui/ByMode";
import { Cell, Group, LargeTitle, NavBar, Screen } from "@/src/ui/kit";

export const metadata = { title: "Every state · Wattle" };

// Static: both modes' tables are built and the browser shows one (ByMode), see app/about/page.tsx.
export default async function CoveragePage() {
  const all = await getDoctors();
  const table = (mode: "wattle" | "adhdme") => (
    <Group>
      {coverage(scopeRoster(all, mode).filter((d) => !d.adhdme?.evidenceUnclear)).map((r) => (
        <Cell key={r.state} title={STATE_NAMES[r.state]} sub={coverageLine(r)} />
      ))}
    </Group>
  );
  return (
    <Screen tone="grouped">
      <NavBar back="/about" title="Every state" collapse />
      <LargeTitle>Every state</LargeTitle>
      <ByMode block wattle={table("wattle")} adhdme={table("adhdme")} />
      <p className="px-4 pt-3 text-footnote text-grey">Providers who see people in each state, in person or by telehealth. ADHD medication is prescribed state by state.</p>
    </Screen>
  );
}
