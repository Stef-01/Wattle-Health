// Profile completeness and the outreach queue (founder decision 2026-10-19: "keep amassing doctors;
// thin bios are fine, deprioritise them in matching and flag that our team needs to reach out with
// interview questions that fill the missing data"). Each missing piece maps to the interview
// question that fills it. Deterministic; read from the record only.
import { isAllied } from "@/src/matching/types";
import type { DoctorRecord } from "./types";

export type Gap = { field: string; label: string; question: string; weight: number };

const GAPS: (Gap & { has: (d: DoctorRecord) => boolean })[] = [
  { field: "personal.philosophyOfCare", label: "How they work", question: "In two or three sentences, how would a patient describe what it's like to see you?", weight: 3, has: (d) => Boolean(d.personal?.philosophyOfCare ?? d.personal?.philosophy ?? d.personal?.communicationApproach) },
  { field: "personal.hobbies", label: "Life outside the clinic", question: "What do you love doing outside medicine?", weight: 2, has: (d) => Boolean(d.personal?.outsideMedicine || [d.personal?.hobbies ?? []].flat().length) },
  { field: "personal.whyMedicine", label: "Why medicine", question: "Why did you choose this field, and what keeps you in it?", weight: 2, has: (d) => Boolean(d.personal?.whyMedicine ?? d.personal?.purpose ?? d.personal?.professionalPurpose) },
  { field: "personal.enjoysServing", label: "Who they love seeing", question: "Which patients or concerns do you most enjoy helping with?", weight: 1, has: (d) => Boolean(d.personal?.enjoysServing?.length || d.conditions?.value?.length) },
  { field: "photo", label: "Portrait", question: "Can we use a portrait of you, and which one?", weight: 1, has: (d) => Boolean(d.photo) },
  { field: "telehealth", label: "Telehealth", question: "Do you offer telehealth, and for which appointments?", weight: 1, has: (d) => d.declared?.telehealth === true || d.telehealth?.value !== undefined },
  { field: "fee", label: "Fees", question: "What is your initial consult fee and typical out-of-pocket cost?", weight: 1, has: (d) => Boolean(d.fees?.value?.length) },
];
const TOTAL = GAPS.reduce((s, g) => s + g.weight, 0);

/** 0 to 1, and the interview questions that would fill what's missing, most important first. */
export function completeness(d: DoctorRecord): { score: number; missing: Gap[] } {
  const missing = GAPS.filter((g) => {
    try {
      return !g.has(d);
    } catch {
      return true;
    }
  }).map(({ has: _has, ...g }) => g);
  const got = TOTAL - missing.reduce((s, g) => s + g.weight, 0);
  return { score: Math.round((got / TOTAL) * 100) / 100, missing: missing.sort((a, b) => b.weight - a.weight) };
}

/** Thin = no own words about how they work, or under 40% complete. Thin profiles rank after fuller ones of the same clinical fit. */
export const isThin = (d: DoctorRecord) => {
  const c = completeness(d);
  return c.score < 0.4 || c.missing.some((g) => g.field === "personal.philosophyOfCare");
};

/** ADHDme network clinicians (adhdme.au pages) onboard and rank first (founder 2026-10-20). */
export const isNetwork = (d: DoctorRecord) => d.sources.some((s) => /(^|\/\/)(www\.)?adhdme\.au\//.test(s.sourceUrl ?? ""));

/** Within each run of equal clinical band: network clinicians first, then full profiles, then thin ones; order otherwise kept. */
export function deprioritiseThin<T extends { doctor: DoctorRecord; clinicalFit?: { band: string } }>(cards: T[]): T[] {
  const out: T[] = [];
  let i = 0;
  while (i < cards.length) {
    // A run never mixes doctors and allied providers, so moving thin profiles down never lifts an allied provider past a doctor (index.ts).
    const key = (c: T) => `${c.clinicalFit?.band}|${isAllied(c.doctor.specialty)}`;
    const band = key(cards[i]!);
    let j = i;
    while (j < cards.length && key(cards[j]!) === band) j++;
    const run = cards.slice(i, j);
    const net = run.filter((c) => isNetwork(c.doctor));
    const rest = run.filter((c) => !isNetwork(c.doctor));
    out.push(...net, ...rest.filter((c) => !isThin(c.doctor)), ...rest.filter((c) => isThin(c.doctor)));
    i = j;
  }
  return out;
}
