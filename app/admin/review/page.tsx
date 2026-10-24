// Admin › Review: what transcripts said that no category covers. Rename it, describe it, choose its
// group, approve it, and it is scored from the next transcript on.
import { listCandidates } from "@/src/decisions/engine";
import { AdminShell } from "@/src/ui/admin/Shell";
import { ReviewCard } from "@/src/ui/admin/client";

export default async function AdminReview() {
  const all = await listCandidates();
  const pending = all.filter((c) => c.status === "pending");
  const done = all.filter((c) => c.status !== "pending");
  return (
    <AdminShell active="/admin/review" title="Review" sub={`${pending.length} waiting. Approving one adds it to what the classifier outputs; retrain the tree to use it in decisions.`}>
      {pending.length ? <div className="flex flex-col gap-3">{pending.map((c) => <ReviewCard key={c.id} c={c} />)}</div> : <p className="text-body text-grey">Nothing waiting. New ideas arrive as transcripts are classified.</p>}
      {done.length ? (
        <>
          <h2 className="mt-10 text-title3 text-ink">Reviewed</h2>
          <div className="mt-3 flex flex-col gap-3">{done.slice(0, 50).map((c) => <ReviewCard key={c.id} c={c} />)}</div>
        </>
      ) : null}
    </AdminShell>
  );
}
