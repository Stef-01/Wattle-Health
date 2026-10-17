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
