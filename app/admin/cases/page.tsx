// Admin › Case studies: the worked examples the decision tree learns from, and the button that
// trains it. Case text stays in the decisions store (never in git).
import { listCases } from "@/src/decisions/engine";
import { AdminShell } from "@/src/ui/admin/Shell";
import { AddCases, ImportNotes, RemoveCase, TrainButton } from "@/src/ui/admin/client";

export default async function AdminCases() {
  const cases = await listCases();
  const decisions = [...new Set(cases.map((c) => c.decision))].sort();
  return (
    <AdminShell active="/admin/cases" title="Case studies" sub={`${cases.length} cases, ${decisions.length} decisions. Training scores any case the current categories haven’t seen, then fits the tree.`}>
      <TrainButton cases={cases.length} />
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-3">
          {cases.length ? cases.map((c) => (
            <details key={c.id} className="rounded-card bg-surface-soft px-4">
              <summary className="hit flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate text-body text-ink">{c.title}</span>
                  <span className="block text-footnote text-grey">{c.decision} · {c.source}{c.scores ? " · scored" : " · not scored yet"}</span>
                </span>
              </summary>
              <p className="whitespace-pre-wrap pb-2 text-subhead leading-read text-charcoal">{c.text}</p>
              <div className="pb-3"><RemoveCase id={c.id} /></div>
            </details>
          )) : <p className="text-body text-grey">No case studies yet.</p>}
        </div>
        <aside>
          <h2 className="text-title3 text-ink">Import from meeting notes</h2>
          <p className="mt-1 mb-3 text-subhead text-grey">Paste a Granola note. Each case it discusses comes back as a draft, with the decision kept apart from the case, for you to check before it is saved.</p>
          <ImportNotes />
          <h2 className="mt-10 text-title3 text-ink">Add one by hand</h2>
          <p className="mt-1 mb-3 text-subhead text-grey">Each needs what happened and the decision it reached. Same title or source ref updates the case.</p>
          <AddCases />
        </aside>
      </div>
    </AdminShell>
  );
}
