// Admin › Overview: is the loop working (model, key, storage), how big it is, what the tree has
// learned, and a box to run one transcript through it. Plus the roster at a glance.
import { readFileSync } from "node:fs";
import path from "node:path";
import { coverage } from "@/src/data/coverage";
import { getDoctors } from "@/src/data/providers";
import { activeCategories, allCategories, currentModel, labeller, listCandidates, listCases, recentRuns, scoredWithKey } from "@/src/decisions/engine";
import { openaiConfigured, openaiModel } from "@/src/decisions/openai";
import { decisionsBackend } from "@/src/decisions/store";
import { rules } from "@/src/decisions/tree";
import { isAdhdSupport } from "@/src/mode";
import { AdminShell, Stat } from "@/src/ui/admin/Shell";
import { TryTranscript } from "@/src/ui/admin/client";
import { Group } from "@/src/ui/kit";

const BACKEND_NOTE = { supabase: "Supabase", file: "Local file (development)", memory: "Memory only: set SUPABASE_SERVICE_ROLE_KEY to keep reviews" } as const;

function adhdmeSnapshot(): { count: number; observedAt: string } | null {
  try {
    const d = JSON.parse(readFileSync(path.join(process.cwd(), "data", "adhdme", "clinicians.json"), "utf8")) as { count: number; observed_at: string };
    return { count: d.count, observedAt: d.observed_at };
  } catch {
    return null;
  }
}

export default async function AdminOverview() {
  const [all, active, candidates, cases, model, runs, doctors] = await Promise.all([allCategories(), activeCategories(), listCandidates(), listCases(), currentModel(), recentRuns(8), getDoctors()]);
  const label = labeller(active);
  const labels = Object.fromEntries(active.map((c) => [c.key, c.label]));
  const pending = candidates.filter((c) => c.status === "pending").length;
  const reviewed = all.filter((c) => c.origin === "reviewed").length;
  const stale = model ? model.scoredWith !== scoredWithKey(active) : false;
  const importance = model ? Object.entries(model.importance).sort((a, b) => b[1] - a[1]).slice(0, 8) : [];
  const cohort = doctors.filter(isAdhdSupport);
  const gaps = coverage(cohort).filter((r) => r.prescribers.inPerson + r.prescribers.telehealth === 0).map((r) => r.state);
  const snap = adhdmeSnapshot();
  return (
    <AdminShell active="/admin" title="Overview" sub={<>{openaiConfigured() ? `Classifier on ${openaiModel()}` : "OPENAI_API_KEY is not set: classifying is off"} · storage: {BACKEND_NOTE[decisionsBackend()]}</>}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Categories scored" value={active.length} note={`${reviewed} added in review`} />
        <Stat label="Waiting for review" value={pending} note={pending ? "Review tab" : "Queue is clear"} />
        <Stat label="Case studies" value={cases.length} note={`${new Set(cases.map((c) => c.decision)).size} decisions`} />
        <Stat label="Decision tree" value={model ? `v${model.version}` : "None"} note={model ? `${Math.round(model.trainingAccuracy * 100)}% fit${model.leaveOneOutAccuracy !== null ? `, ${Math.round(model.leaveOneOutAccuracy * 100)}% held out` : ""}${stale ? " · retrain" : ""}` : "Add cases, then train"} />
      </div>

      <h2 className="mt-10 text-title3 text-ink">Try a transcript</h2>
      <p className="mt-1 mb-3 text-subhead text-grey">Scores every category 0 to 1, runs the tree, and sends anything uncovered to review. The text is sent to OpenAI and not stored here.</p>
      <TryTranscript labels={labels} />

      {model ? (
        <>
          <h2 className="mt-10 text-title3 text-ink">What the tree relies on</h2>
          <p className="mt-1 mb-3 text-subhead text-grey">Share of the tree’s decisions each parameter carries, learned from {model.cases} case studies.</p>
          <Group tone="soft">
            {importance.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between px-4 py-2.5 text-subhead"><span className="text-ink">{label(k)}</span><span className="tnum text-charcoal">{Math.round(v * 100)}%</span></div>
            ))}
          </Group>
          <h2 className="mt-8 text-title3 text-ink">Rules</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {rules(model.root, label).map((r, i) => (
              <li key={i} className="rounded-card bg-surface-soft px-4 py-3 text-subhead">
                <span className="text-charcoal">{r.when.length ? r.when.join(" and ") : "Always"}</span>
                <span className="text-grey"> → </span>
                <span className="font-semibold text-ink">{r.then}</span>
                <span className="text-grey"> · {r.n} {r.n === 1 ? "case" : "cases"}, {Math.round(r.purity * 100)}% agree</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <h2 className="mt-10 text-title3 text-ink">Recent runs</h2>
      {runs.length ? (
        <Group tone="soft" className="mt-3">
          {runs.map((r) => (
            <div key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-4 px-4 py-2.5 text-subhead">
              <span className="text-ink">{r.decision ?? "No decision"}{r.confidence !== null ? ` (${Math.round(r.confidence * 100)}%)` : ""}</span>
              <span className="text-grey">{new Date(r.at).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })} · {r.length} chars · {r.candidates.length} new · {(r.ms / 1000).toFixed(1)} s</span>
            </div>
          ))}
        </Group>
      ) : (
        <p className="mt-2 text-subhead text-grey">None yet.</p>
      )}

      <h2 className="mt-10 text-title3 text-ink">Roster</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Providers" value={doctors.length.toLocaleString("en-AU")} />
        <Stat label="ADHD cohort" value={cohort.length} note="What ADHDme mode lists" />
        <Stat label="ADHDme network" value={snap?.count ?? "—"} note={snap ? `Snapshot ${snap.observedAt}` : "No snapshot"} />
        <Stat label="States with no ADHD prescriber" value={gaps.length} note={gaps.length ? gaps.join(", ") : "Every state reached"} />
      </div>
    </AdminShell>
  );
}
