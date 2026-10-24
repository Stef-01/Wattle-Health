// Display-only admin pieces, safe on server and client.
import type { ReactNode } from "react";

/** A labelled number for the overview. */
export function Stat({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="rounded-card bg-surface-soft px-4 py-3">
      <p className="text-footnote text-grey">{label}</p>
      <p className="tnum mt-0.5 text-title2 text-ink">{value}</p>
      {note ? <p className="mt-0.5 text-footnote text-grey">{note}</p> : null}
    </div>
  );
}

/** A 0..1 score as a bar and a number. */
export function ScoreBar({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-48 shrink-0 truncate text-subhead text-ink" title={sub}>{label}</span>
      <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-surface" aria-hidden="true">
        <span className="absolute inset-y-0 left-0 rounded-full bg-ink" style={{ width: `${Math.round(value * 100)}%` }} />
      </span>
      <span className="tnum w-10 shrink-0 text-right text-subhead text-charcoal">{value.toFixed(2)}</span>
    </div>
  );
}
