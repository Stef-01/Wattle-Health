// Admin › Categories: everything the classifier scores. Vocabulary categories come from
// disciplines/mvp.yaml and are edited there; reviewed ones are edited here.
import { allCategories } from "@/src/decisions/engine";
import { CATEGORY_GROUPS, GROUP_LABELS } from "@/src/decisions/types";
import { AdminShell } from "@/src/ui/admin/Shell";
import { CategoryEditor } from "@/src/ui/admin/client";
import { Group } from "@/src/ui/kit";

export default async function AdminCategories() {
  const all = await allCategories();
  const reviewed = all.filter((c) => c.origin === "reviewed");
  return (
    <AdminShell active="/admin/categories" title="Categories" sub={`${all.filter((c) => c.active).length} scored on every transcript, each 0 to 1. ${reviewed.length} added in review.`}>
      <h2 className="text-title3 text-ink">Added in review</h2>
      {reviewed.length ? <div className="mt-2 divide-y divide-hairline">{reviewed.map((c) => <CategoryEditor key={c.key} c={c} />)}</div> : <p className="mt-2 text-subhead text-grey">None yet. Approve a candidate on Review.</p>}
      <h2 className="mt-10 text-title3 text-ink">From the vocabulary</h2>
      <p className="mt-1 text-subhead text-grey">Edited in disciplines/mvp.yaml, so the lexical matcher and the classifier mean the same thing.</p>
      {CATEGORY_GROUPS.map((g) => {
        const rows = all.filter((c) => c.origin === "vocabulary" && c.group === g);
        if (!rows.length) return null;
        return (
          <section key={g} className="mt-6">
            <h3 className="px-4 pb-2 text-headline text-grey">{GROUP_LABELS[g]}</h3>
            <Group tone="soft">
              {rows.map((c) => (
                <div key={c.key} className="px-4 py-2.5">
                  <p className="text-subhead text-ink">{c.label}</p>
                  <p className="text-footnote text-grey">{c.description}</p>
                </div>
              ))}
            </Group>
          </section>
        );
      })}
    </AdminShell>
  );
}
