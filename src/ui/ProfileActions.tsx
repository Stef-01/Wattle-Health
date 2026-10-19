"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Card } from "@/src/data/search-types";
import type { DoctorRecord } from "@/src/data/types";
import { getCompare, getResults, getSaved, toggleCompare, toggleSaved } from "./store";

/** Save / compare buttons on the profile. */
export function ProfileActions({ doctor }: { doctor: DoctorRecord }) {
  const [saved, setSaved] = useState(false);
  const [comparing, setComparing] = useState(false);
  useEffect(() => {
    setSaved(getSaved().some((d) => d.id === doctor.id));
    setComparing(getCompare().some((d) => d.id === doctor.id));
  }, [doctor.id]);
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" aria-pressed={saved} onClick={() => setSaved(toggleSaved(doctor).some((d) => d.id === doctor.id))} className={`min-h-11 rounded-full border px-4 text-sm ${saved ? "border-foliage bg-mist text-foliage" : "border-line"}`}>
        {saved ? "Saved" : "Save"}
      </button>
      <button type="button" aria-pressed={comparing} onClick={() => setComparing(toggleCompare(doctor).some((d) => d.id === doctor.id))} className={`min-h-11 rounded-full border px-4 text-sm ${comparing ? "border-foliage bg-mist text-foliage" : "border-line"}`}>
        {comparing ? "Comparing" : "Compare"}
      </button>
      <Link href="/results" className="flex min-h-11 items-center px-2 text-sm text-foliage underline-offset-4 hover:underline">
        Back to results
      </Link>
    </div>
  );
}

/** "Why this pick": both explanations from the last search, if this doctor was in it. */
export function WhyMatches({ doctorId }: { doctorId: string }) {
  const [card, setCard] = useState<Card | null | undefined>(undefined);
  useEffect(() => {
    setCard(getResults()?.cards.find((c) => c.doctor.id === doctorId) ?? null);
  }, [doctorId]);
  if (card === undefined) return null;
  if (card === null) return <p className="text-sm text-ink-soft">Search first to see why this provider is a pick for you.</p>;
  return (
    <dl className="flex flex-col gap-2 text-sm">
      <div>
        <dt className="text-xs uppercase tracking-wide text-gold">Clinical</dt>
        <dd className="m-0">{card.clinicalFit.reasons.length ? card.clinicalFit.reasons.join(" · ") : "No condition match; listed for the specialty."}</dd>
      </div>
      <div>
        <dt className="text-xs uppercase tracking-wide text-gold">Human</dt>
        <dd className="m-0">{card.humanFit.reasons.length ? card.humanFit.reasons.join(" · ") : `Not declared (${card.humanFit.basis})`}</dd>
      </div>
      {card.missed.length > 0 && (
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink-soft">Not matched</dt>
          <dd className="m-0 text-ink-soft">{card.missed.map((m) => m.label).join(" · ")}</dd>
        </div>
      )}
    </dl>
  );
}
