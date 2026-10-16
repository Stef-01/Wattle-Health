"use client";
// A result card, editorial (2026-10-16 v4, after the founder's "cluttered" verdict): avatar,
// serif name, one line of where, one sentence of why this doctor fits in closed vocabulary,
// one quote in their published words, one practical line. No chips. The card opens the profile.
import Link from "next/link";
import type { Card } from "@/src/data/search-types";
import type { DoctorRecord } from "@/src/data/types";
import { doctorHref } from "@/src/data/doctor-slug";
import { Avatar, Heart } from "@/src/ui/kit";
import { clip, drName, listSentence, practicalChips, pronouns, quoteOf, specialtyTitle } from "@/src/ui/screens/patient-b/facts";
import { listedOnly, matchChips } from "./card";
import { placeLine, suburbOf } from "./lib";

const GERUND: Record<string, string> = { listens: "listening", direct: "direct", gentle: "gentle", collaborative: "collaborative" };
const gerund = (s: string) => GERUND[s] ?? s;
const HUMAN = /listens|collaborative|evidence|whole-person|gentle|direct|lived experience|affirming|culturally|research-active|longer|trauma/i;

/** "Lists endometriosis and pelvic pain and reads as collaborative." from the engine's reasons. */
function fitSentence(card: Card, labels: Record<string, string>): string {
  if (listedOnly(card)) return `Listed under ${specialtyTitle(card.doctor.specialty).toLowerCase()}, no documented focus on this yet.`;
  const chips = matchChips(card, 4);
  const clinical = chips.filter((c) => !HUMAN.test(c));
  const human = chips.filter((c) => HUMAN.test(c)).map((c) => c.replace(/ and takes you seriously$/, ""));
  const pr = pronouns(card.doctor);
  const parts: string[] = [];
  if (clinical.length) parts.push(`Lists ${listSentence(clinical)}.`);
  if (human.length) parts.push(`${pr.possessive} profile reads as ${listSentence(human.map(gerund))}.`);
  if (parts.length === 0) {
    const ids = card.doctor.conditions.value.slice(0, 3).map((id) => labels[id] ?? id.replace(/-/g, " "));
    return ids.length ? `Lists ${listSentence(ids)}.` : "No clinical focus listed yet.";
  }
  return parts.join(" ");
}

export function DoctorCard({ card, labels, saved, onSave, index = 0 }: { card: Card; labels: Record<string, string>; saved: boolean; onSave: () => void; index?: number }) {
  const d: DoctorRecord = card.doctor;
  const name = drName(d);
  const near = card.distanceKm !== undefined && card.distanceKm <= 20;
  const place = near ? suburbOf(card) : placeLine(card);
  const km = card.distanceKm !== undefined ? `${Math.max(1, Math.round(card.distanceKm))} km` : d.telehealth.value === "only" ? "telehealth" : null;
  const where = [specialtyTitle(d.specialty), place, km].filter(Boolean).join(" · ");
  const quote = quoteOf(d, 30);
  const practical = practicalChips(d).slice(0, 3);

  return (
    <article className="rise relative border-b border-divider py-6" style={{ "--i": index } as React.CSSProperties}>
      <button type="button" aria-label={saved ? "Remove from saved" : "Save"} aria-pressed={saved} onClick={onSave} className={`press absolute right-0 top-6 inline-flex size-10 items-center justify-center rounded-full ${saved ? "text-ink" : "text-grey"}`}>
        <Heart size={20} fill={saved ? "currentColor" : "none"} />
      </button>
      <Link href={doctorHref(d.id)} className="press press-soft block">
        <div className="flex items-center gap-4 pr-12">
          <Avatar name={name} size={64} />
          <div className="flex min-w-0 flex-col gap-1">
            <h3 className="display line-clamp-2 text-[24px] leading-[1.1] text-ink">{name}{d.synthetic ? " (example)" : ""}</h3>
            <p className="truncate text-[15px] text-grey">{where}</p>
          </div>
        </div>
        <p className="mt-4 text-[16px] leading-[1.5] text-charcoal">{fitSentence(card, labels)}</p>
        {quote ? <p className="mt-3 font-display text-[19px] leading-[1.35] text-ink">“{clip(quote.text, 120)}”</p> : null}
        {practical.length > 0 ? <p className="mt-3 text-[14px] text-grey">{practical.join(" · ")}</p> : null}
      </Link>
    </article>
  );
}
