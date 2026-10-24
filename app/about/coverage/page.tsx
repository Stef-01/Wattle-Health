// Every state, counted (2026-10-24): who in this mode's roster sees people in each state, prescribers
// apart, because ADHD medication is authorised state by state. A state no prescriber reaches says so.
import { coverage, coverageLine, STATE_NAMES } from "@/src/data/coverage";
import { getDoctors } from "@/src/data/providers";
import { currentMode, scopeRoster } from "@/src/server/mode";
import { Cell, Group, LargeTitle, NavBar, Screen } from "@/src/ui/kit";

export const metadata = { title: "Every state · Wattle" };

export default async function CoveragePage() {
  const mode = await currentMode();
  const rows = coverage(scopeRoster(await getDoctors(), mode).filter((d) => !d.adhdme?.evidenceUnclear));
  return (
    <Screen tone="grouped">
      <NavBar back="/about" title="Every state" collapse />
      <LargeTitle>Every state</LargeTitle>
      <Group>
        {rows.map((r) => (
          <Cell key={r.state} title={STATE_NAMES[r.state]} sub={coverageLine(r)} />
        ))}
      </Group>
      <p className="px-4 pt-3 text-footnote text-grey">Providers who see people in each state, in person or by telehealth. ADHD medication is prescribed state by state.</p>
    </Screen>
  );
}
