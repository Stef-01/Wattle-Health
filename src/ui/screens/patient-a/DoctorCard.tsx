"use client";
// P05 "Your matches" card (Figma 226:15, re-read 2026-10-16): a 405-tall photo with a 30 px
// radius and the photo shadow, a blurred caption bottom-left (name 16 medium, map-pin + suburb
// 14 in #cac8c8) and a blurred heart circle top-right. Under it, one sentence of why this
// doctor fits, in closed vocabulary, and the practical line. The portrait is the one the
// practice publishes on the page we cite; without one the card carries the doctor's initials
// on their tint. The whole card opens the profile.
import Link from "next/link";
import type { Card } from "@/src/data/search-types";
import type { DoctorRecord } from "@/src/data/types";
import { doctorHref } from "@/src/data/doctor-slug";
import { Heart, MapPin, initialsFor, tintFor } from "@/src/ui/kit";
import { drName, listSentence, practicalChips, pronouns, specialtyTitle } from "@/src/ui/screens/patient-b/facts";
import { listedOnly, matchChips } from "./card";
import { suburbOf } from "./lib";

const GERUND: Record<string, string> = { listens: "listening", direct: "direct", gentle: "gentle", collaborative: "collaborative" };
const gerund = (s: string) => GERUND[s] ?? s;
const HUMAN = /listens|collaborative|evidence|whole-person|gentle|direct|lived experience|affirming|culturally|research-active|longer|trauma/i;

/** "Lists endometriosis. Her profile reads as listening." from the engine's reasons. */
export function fitSentence(card: Card, labels: Record<string, string>): string {
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

/** The P05 photo block on its own, reused by Saved. */
export function Portrait({ d, height = 405, saved, onSave }: { d: DoctorRecord; height?: number; saved?: boolean; onSave?: () => void }) {
  const name = drName(d);
  const [bg, fg] = tintFor(name);
  const suburb = d.rooms.find((r) => r.state === "QLD")?.suburb ?? d.rooms[0]?.suburb ?? null;
  return (
    <div className="relative w-full overflow-hidden rounded-[30px] shadow-photo" style={{ height, background: d.photo ? "#e9e9e9" : bg }}>
      {d.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={d.photo.url} alt={d.photo.alt ?? name} loading="lazy" referrerPolicy="no-referrer" className="absolute inset-0 size-full object-cover object-top" />
      ) : (
        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center font-display text-[72px]" style={{ color: fg }}>
          {initialsFor(name)}
        </span>
      )}
      {onSave ? (
        <button
          type="button"
          aria-label={saved ? "Remove from saved" : "Save"}
          aria-pressed={saved}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSave();
          }}
          className="press absolute right-5 top-5 inline-flex size-11 items-center justify-center rounded-full bg-caption text-white backdrop-blur-[20px]"
        >
          <Heart size={22} fill={saved ? "currentColor" : "none"} />
        </button>
      ) : null}
      <div className="absolute bottom-5 left-5 flex h-[75px] max-w-[calc(100%-40px)] items-center rounded-[15px] bg-caption px-4 py-3 text-white shadow-[0_5px_4.5px_rgba(0,0,0,0.1)] backdrop-blur-[20px]">
        <span className="flex min-w-0 flex-col gap-2">
          <span className="truncate text-[16px] font-medium leading-normal">{name}{d.synthetic ? " (example)" : ""}</span>
          {suburb ? (
            <span className="inline-flex items-center gap-1.5 text-[14px] leading-normal text-caption-text">
              <MapPin size={16} />
              <span className="truncate">{suburb}</span>
            </span>
          ) : null}
        </span>
      </div>
    </div>
  );
}

export function DoctorCard({ card, labels, saved, onSave, index = 0 }: { card: Card; labels: Record<string, string>; saved: boolean; onSave: () => void; index?: number }) {
  const d: DoctorRecord = card.doctor;
  const km = card.distanceKm !== undefined ? `${Math.max(1, Math.round(card.distanceKm))} km` : d.telehealth.value === "only" ? "telehealth" : null;
  const where = [specialtyTitle(d.specialty), km].filter(Boolean).join(" · ");
  const practical = [where, ...practicalChips(d).slice(0, 2)].filter(Boolean);
  void suburbOf;
  return (
    <article className="rise" style={{ "--i": index } as React.CSSProperties}>
      <Link href={doctorHref(d.id)} className="press press-soft block">
        <Portrait d={d} saved={saved} onSave={onSave} />
        <p className="mt-4 text-[16px] leading-[1.5] text-charcoal">{fitSentence(card, labels)}</p>
        <p className="mt-1.5 text-[14px] text-grey">{practical.join(" · ")}</p>
      </Link>
    </article>
  );
}
