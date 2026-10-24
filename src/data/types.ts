// What the screens render: the matcher's `Doctor` plus the facts the provider files carry
// that the contract does not yet (raw focus tags, publications, sources, personal profile).
import type { Doctor, Observed, PersonalProfile } from "@/src/matching/types";

export type { PersonalProfile };

export interface SourceRef {
  source: string;
  sourceUrl: string | null;
  observedAt: string;
  legalBasis?: string;
}

export interface Room {
  id: string;
  name: string | null;
  address: string | null;
  suburb: string;
  state: string;
  postcode: string;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  website: string | null;
}

export interface Publication {
  title: string;
  year: number | null;
  venue: string | null;
  doi: string | null;
  url: string | null;
  /** "identifier-matched" (ORCID / OpenAlex id) or "doctor-confirmed" (claim flow). */
  verification: "identifier-matched" | "doctor-confirmed";
}

export { STATES, type Reach, type StateCode } from "@/src/matching/types";

/** One piece of an ADHDme fee note: plain text, emphasis, or a link (http(s) only). */
export type NoteSegment = { kind: "text" | "strong"; text: string } | { kind: "link"; text: string; href: string };

/**
 * The provider's whole card from the ADHDme network (founder's site), as ADHDme publishes it:
 * what it costs, how the pathway runs, who else is involved, and where to book. Found tier: the
 * words are the network page's, attributed to `profileUrl`.
 */
export interface AdhdmeCard {
  id: string;
  slug: string;
  /** ADHDme's own category: gp, psychiatrist, psychologist, occupational-therapy, physiotherapy, exercise-physiology, coach, allied. */
  category: string;
  role: string;
  summary: string;
  chips: string[];
  qualifications: string | null;
  experience: string[];
  pathway: { step: string; detail: string }[];
  worksWith: string[];
  fees: { heading: string; figures: { amount: string; label: string }[]; notes: NoteSegment[][] };
  booking: { url: string; hint: string | null } | null;
  links: { kind: string; label: string; url: string }[];
  /** Facts ADHDme lists under the card ("Appointments", "Billing", "Wheelchair access"…). "Not declared" is kept as written. */
  details: { label: string; value: string }[];
  disclosure: string | null;
  /** Offers ADHD assessment. False for a continuation prescriber. */
  assesses: boolean;
  bulkBilled: boolean;
  /** ADHDme's own call (owner, 2026-10-07): the evidence for this kind of care is unclear, so search leaves it out. */
  evidenceUnclear: boolean;
  profileUrl: string;
  observedAt: string;
}

export interface DoctorRecord extends Doctor {
  /** The source's own focus tags, verbatim, with provenance. */
  focusTags: Observed<string[]>;
  /** College credential as the source printed it (e.g. "Fellow"), or null. */
  credential: string | null;
  /** Whether the source said anything about telehealth / capacity at all. */
  declared: { telehealth: boolean; capacity: boolean; languages: boolean };
  waitTimeText: string | null;
  rooms: Room[];
  /** A stated limit on who the practice sees ("healthcare workers and carers only"), shown wherever the doctor is. */
  scopeNote?: string;
  /** The doctor's portrait as published on their own practice page, hotlinked with attribution (founder instruction 2026-10-16). */
  photo?: { url: string; sourceUrl: string; alt?: string };
  sources: SourceRef[];
  publications: Publication[];
  /** The ADHDme network card, for providers in that network. */
  adhdme?: AdhdmeCard;
}

/** Human-readable source names for the tier badge. */
export const SOURCE_LABELS: Record<string, string> = {
  "ranzcp-find": "RANZCP",
  ranzcog_find: "RANZCOG",
  ramsay: "Ramsay Health Care",
  mater: "Mater",
  epworth: "Epworth",
  ascia_find: "ASCIA",
  anzsped_units: "ANZSPED",
  openalex: "OpenAlex",
  supabase: "Wattle",
  claim: "the doctor",
  illustrative: "Illustrative example",
  "practice-website": "their practice website",
  adhdme: "the ADHDme network",
};

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

/** Fields the contract allows as a string or a list; the screens always render a list. */
export function asList(v: string | string[] | undefined): string[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : v.trim() ? [v] : [];
}

/** Research topics, whichever way the record carries them. */
export function topicsOf(d: Doctor): string[] {
  const t = d.researchTopics;
  if (!t) return [];
  return Array.isArray(t) ? t : t.value;
}
