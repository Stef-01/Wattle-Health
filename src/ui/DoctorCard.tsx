"use client";
import Link from "next/link";
import type { Card } from "@/src/data/search-types";
import { Band, ObservedBadge } from "./Badge";
import { doctorHref } from "@/src/data/doctor-slug";

const SPECIALTY: Record<string, string> = { psychiatry: "Psychiatrist", paediatrics: "Paediatrician", "obstetrics-gynaecology": "Obstetrician and gynaecologist" };

export function capacityCopy(card: Card): string {
  const d = card.doctor;
  if (!d.declared.capacity) return "Capacity not declared";
  if (d.capacity.value === "closed") return "Not taking new patients";
  if (d.waitTimeText) return `Wait ${d.waitTimeText.toLowerCase()}`;
  return "Taking new patients";
}

export function DoctorCard({
  card,
  rank,
  saved,
  comparing,
  onSave,
  onCompare,
}: {
  card: Card;
  rank: number;
  saved: boolean;
  comparing: boolean;
  onSave: () => void;
  onCompare: () => void;
}) {
  const d = card.doctor;
  const room = d.rooms[0];
  return (
    <article className="rise flex flex-col gap-3 rounded-card border border-line bg-white p-4" aria-labelledby={`${d.id}-name`}>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-ink-soft">{rank}</p>
          <ObservedBadge o={d.focusTags} />
        </div>
        <div>
          <h2 id={`${d.id}-name`} className="text-2xl">
            <Link href={doctorHref(d.id)} className="underline-offset-4 hover:underline">
              {d.name.display}
            </Link>
          </h2>
          <p className="text-sm text-ink-soft">
            {SPECIALTY[d.specialty] ?? d.specialty.replace(/-/g, " ")}
            {room ? ` · ${room.suburb}` : ""}
            {card.distanceKm !== undefined ? ` · about ${card.distanceKm} km` : ""}
          </p>
        </div>
      </div>

      <div className="flex flex-col items-start gap-1">
        <Band band={card.clinicalFit.band} />
        {card.clinicalFit.reasons.length > 0 && <p className="text-sm">{card.clinicalFit.reasons.slice(0, 3).join(" · ")}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-wide text-gold">Human fit</p>
        <p className="text-sm">{card.humanFit.reasons.length > 0 ? card.humanFit.reasons.slice(0, 3).join(" · ") : `Not declared (${card.humanFit.basis})`}</p>
      </div>

      <p className="text-sm text-ink-soft">
        {capacityCopy(card)}
        {d.declared.telehealth ? (d.telehealth.value === "none" ? " · In person only" : " · Telehealth") : " · Telehealth not declared"}
      </p>

      <div className="flex flex-wrap gap-2">
        <Link href={doctorHref(d.id)} className="flex min-h-11 items-center rounded-full bg-foliage px-4 text-sm font-medium text-paper">
          Profile
        </Link>
        <button type="button" onClick={onSave} aria-pressed={saved} className={`min-h-11 rounded-full border px-4 text-sm ${saved ? "border-foliage bg-mist text-foliage" : "border-line"}`}>
          {saved ? "Saved" : "Save"}
        </button>
        <button type="button" onClick={onCompare} aria-pressed={comparing} className={`min-h-11 rounded-full border px-4 text-sm ${comparing ? "border-foliage bg-mist text-foliage" : "border-line"}`}>
          {comparing ? "Comparing" : "Compare"}
        </button>
      </div>
    </article>
  );
}
