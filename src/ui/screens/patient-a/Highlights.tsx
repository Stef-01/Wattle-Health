"use client";
// "Highlights for you": the server-ranked highlights (src/data/highlights.ts) for one match. The top
// three show; the rest open on a toggle. Items that answer what the person asked carry a green tick.
import { useState } from "react";
import type { Highlight } from "@/src/data/search-types";
import { Check } from "@/src/ui/kit";

const ICON: Record<Highlight["kind"], string> = { clinical: "＋", approach: "◎", lived: "♡", access: "◷", research: "▤", personal: "☀", people: "◍" };

export function Highlights({ items, name }: { items: Highlight[]; name: string }) {
  const [all, setAll] = useState(false);
  if (items.length === 0) return null;
  const shown = all ? items : items.slice(0, 3);
  return (
    <section className="rounded-card px-5 py-4" style={{ background: "var(--color-surface-soft)" }} aria-label={`Highlights for ${name}`}>
      <p className="mb-1 text-footnote text-ink">Highlights for you</p>
      <ul className="flex flex-col">
        {shown.map((h, i) => (
          <li key={h.id} className="rise flex gap-3 border-b border-hairline py-3 last:border-b-0" style={{ "--i": i } as React.CSSProperties}>
            <span aria-hidden="true" className={`mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-footnote ${h.matched ? "bg-ink text-white" : "bg-white text-ink"}`}>
              {h.matched ? <Check size={13} /> : ICON[h.kind]}
            </span>
            <span className="min-w-0">
              <span className="block text-body text-ink">{h.label}</span>
              {h.detail ? <span className="mt-0.5 block text-subhead leading-read text-grey">{h.detail}</span> : null}
            </span>
          </li>
        ))}
      </ul>
      {items.length > 3 ? (
        <button type="button" aria-expanded={all} onClick={() => setAll((v) => !v)} className="press-dim mt-1 text-subhead text-ink">
          {all ? "Show fewer" : `Show all ${items.length} highlights`}
        </button>
      ) : null}
    </section>
  );
}
