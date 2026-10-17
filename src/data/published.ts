// Real Queensland doctors whose practice websites carry a personal bio, researched by hand on
// 2026-10-16 into data/enriched/personal/research-*.json. Each row names the page the words came
// from; the record carries that page as a `found` source and the personal block as `published`
// (the doctor's own published words, attributed, never a Wattle paraphrase of a review).
//
// A researched doctor who is already on the roster (same specialty, same name, Queensland) gets
// the personal block, the practice room, and any facts the roster lacked (telehealth, fee,
// referral, years). One who is not (most GPs, pain and rheumatology doctors; the roster is three
// colleges) is added as a new found record. Server only (fs).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Discipline } from "@/src/disciplines/load";
import { resolvePlace } from "@/src/geo/suburbs";
import { withPersonalLabels } from "@/src/matching/personal-labels";
import type { Gender, Location, Observed, Population, Specialty, Telehealth } from "@/src/matching/types";
import type { DoctorRecord, PersonalProfile, Room, SourceRef } from "./types";

export type ResearchedDoctor = {
  name: string;
  given: string;
  family: string;
  specialty: Specialty;
  gender: Gender | null;
  practice: { name: string; address?: string | null; suburb: string; postcode?: string | null; phone?: string | null; website?: string | null; lat?: number | null; lng?: number | null };
  telehealth?: Telehealth | null;
  referral_required?: boolean | null;
  fee_initial_dollars?: number | null;
  taking_new_patients?: boolean | null;
  languages?: string[];
  years_in_specialty?: number | null;
  conditions: string[];
  populations?: Population[];
  focus_tags?: string[];
  personal: {
    philosophy_of_care?: string | null;
    why_medicine?: string | null;
    communication_approach?: string | null;
    communication?: string[];
    lived_experience?: string | null;
    hobbies?: string[] | string | null;
    outside_medicine?: string | null;
    quotes?: { text: string; about: string }[];
  };
  source: { url: string; page_title?: string; observed_at: string; legal_basis?: string };
  personal_richness?: number;
};

type ResearchFile = { category: string; researched_at: string; doctors: ResearchedDoctor[] };

const SOURCE = "practice-website";
const ABOUT = new Set(["hobbies", "why", "approach", "lived", "other"]);

const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const list = (v: unknown): string[] | undefined => (Array.isArray(v) ? v.map(String).map((s) => s.trim()).filter(Boolean) : str(v) ? [str(v)!] : undefined);

/** "Dr Jane Example" / "Prof. J. Example" → "jane example". */
export function nameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/^(dr\.?|prof\.?|professor|a\/prof(essor)?\.?|assoc\.? prof\.?|mr|ms|mrs)\s+/, "")
    .replace(/[^a-z\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type Portrait = { name: string; specialty?: string; source_url: string; photo_url: string | null; alt?: string | null };

/** data/enriched/personal/portraits.json: practice-site portraits by doctor, keyed on name. */
export function readPortraits(root = process.cwd()): Map<string, Portrait> {
  const file = path.join(root, "data", "enriched", "personal", "portraits.json");
  const out = new Map<string, Portrait>();
  if (!existsSync(file)) return out;
  const parsed = JSON.parse(readFileSync(file, "utf8")) as { portraits?: Portrait[] };
  for (const p of parsed.portraits ?? []) if (p.photo_url && /^https?:\/\//.test(p.photo_url)) out.set(nameKey(p.name), p);
  return out;
}

export function readResearch(root = process.cwd()): ResearchedDoctor[] {
  const dir = path.join(root, "data", "enriched", "personal");
  if (!existsSync(dir)) return [];
  const out: ResearchedDoctor[] = [];
  for (const file of readdirSync(dir).filter((f) => /^research-.*\.json$/.test(f)).sort()) {
    const parsed = JSON.parse(readFileSync(path.join(dir, file), "utf8")) as ResearchFile;
    for (const d of parsed.doctors ?? []) {
      if (!d.source?.url || !d.name || !d.specialty) continue;
      if (d.taking_new_patients === false) continue;
      out.push({ ...d, source: { ...d.source, observed_at: d.source.observed_at || parsed.researched_at } });
    }
  }
  return out;
}

function personalOf(d: ResearchedDoctor): PersonalProfile {
  const raw = d.personal ?? {};
  const p: PersonalProfile = { status: "published", sourceUrl: d.source.url, sourceName: d.practice.name || d.source.page_title || "practice website", observedAt: d.source.observed_at.slice(0, 10) };
  const philosophy = str(raw.philosophy_of_care);
  const whyMedicine = str(raw.why_medicine);
  const approach = str(raw.communication_approach);
  const communication = list(raw.communication);
  const lived = str(raw.lived_experience);
  const hobbies = list(raw.hobbies);
  const outside = str(raw.outside_medicine);
  if (philosophy) p.philosophyOfCare = philosophy;
  if (whyMedicine) p.whyMedicine = whyMedicine;
  if (approach) p.communicationApproach = approach;
  if (communication?.length) p.communication = communication;
  if (lived) p.livedExperience = lived;
  if (hobbies?.length) p.hobbies = hobbies;
  if (outside) p.outsideMedicine = outside;
  const quotes = (raw.quotes ?? [])
    .filter((q) => str(q.text))
    .map((q) => ({ text: q.text.trim(), about: (ABOUT.has(q.about) ? q.about : "other") as NonNullable<PersonalProfile["quotes"]>[number]["about"] }));
  if (quotes.length) p.quotes = quotes;
  return p;
}

function sourceOf(d: ResearchedDoctor): SourceRef {
  return {
    source: SOURCE,
    sourceUrl: d.source.url,
    observedAt: d.source.observed_at,
    legalBasis: d.source.legal_basis ?? "facts and the doctor's own published words from their practice website; short quotations attributed; no images copied",
  };
}

function found<T>(value: T, src: SourceRef): Observed<T> {
  const out: Observed<T> = { value, tier: "found", source: src.source, observedAt: src.observedAt.slice(0, 10) };
  if (src.sourceUrl) out.sourceUrl = src.sourceUrl;
  return out;
}

function roomOf(d: ResearchedDoctor, id: string): Room {
  const pr = d.practice;
  const point = typeof pr.lat === "number" && typeof pr.lng === "number" ? { lat: pr.lat, lng: pr.lng } : (() => {
    const p = resolvePlace(pr.postcode ? `${pr.suburb} ${pr.postcode}` : pr.suburb) ?? resolvePlace(pr.suburb);
    return p ? { lat: p.lat, lng: p.lon } : { lat: null, lng: null };
  })();
  return { id, name: pr.name || null, address: pr.address ?? null, suburb: pr.suburb, state: "QLD", postcode: pr.postcode ?? "", lat: point.lat, lng: point.lng, phone: pr.phone ?? null, website: pr.website ?? null };
}

function locationOf(room: Room, src: SourceRef, telehealthOnly: boolean): Location | null {
  if (room.lat === null || room.lng === null) return null;
  const loc: Location = { id: room.id, name: room.name ?? "Consulting rooms", suburb: room.suburb, state: "QLD", postcode: room.postcode, lat: room.lat, lng: room.lng };
  if (room.phone) loc.phone = found(room.phone, src);
  if (room.website) loc.website = found(room.website, src);
  if (telehealthOnly) loc.telehealthOnly = true;
  return loc;
}

/** Facts the page states, written onto a record (new or existing) only where the record has none. */
function applyFacts(record: DoctorRecord, d: ResearchedDoctor, src: SourceRef, discipline: Discipline): void {
  const known = new Set(discipline.conditions.map((c) => c.id));
  const conditions = (d.conditions ?? []).filter((c) => known.has(c));
  const merged = Array.from(new Set([...record.conditions.value, ...conditions]));
  if (merged.length > record.conditions.value.length) record.conditions = found(merged, src);
  // The page's stated areas of interest are documented clinical interests from a permitted
  // source (the doctor's own site), so Layer 2 reads them like the OpenAlex-derived ones.
  if (conditions.length > 0) {
    const existing = Array.isArray(record.clinicalInterests) ? record.clinicalInterests : (record.clinicalInterests?.value ?? []);
    const interests = Array.from(new Set([...existing, ...conditions]));
    record.clinicalInterests = found(interests, src);
  }
  if (d.populations?.length && record.populations.value.length === 0) record.populations = found(d.populations, src);
  if (d.telehealth && (!record.declared.telehealth || record.telehealth.value === "none")) {
    record.telehealth = found(d.telehealth, src);
    record.declared.telehealth = true;
  }
  if (typeof d.referral_required === "boolean" && !record.referralRequired) record.referralRequired = found(d.referral_required, src);
  if (typeof d.fee_initial_dollars === "number" && !record.fees) record.fees = found([{ label: "Initial consultation", amountCents: Math.round(d.fee_initial_dollars * 100) }], src);
  if (typeof d.years_in_specialty === "number" && !record.yearsInSpecialty) record.yearsInSpecialty = found(d.years_in_specialty, src);
  if (d.gender && !record.gender) record.gender = found(d.gender, src);
  if (d.languages?.length && !record.languages) {
    record.languages = found(d.languages, src);
    record.declared.languages = true;
  }
  if (d.taking_new_patients === true && record.capacity.value === "unknown") {
    record.capacity = found("open", src);
    record.declared.capacity = true;
  }
  if (d.focus_tags?.length) record.focusTags = found(Array.from(new Set([...record.focusTags.value, ...d.focus_tags])), src);
  const scope = (d.focus_tags ?? []).find((t) => / only$/i.test(t.trim()) && !/^not /i.test(t));
  if (scope) record.scopeNote = `Sees ${scope.replace(/\s+only$/i, "")} only`;
  const mannerIds = new Set(discipline.manner.map((m) => m.id));
  const manner = (d.personal?.communication ?? []).filter((id) => mannerIds.has(id));
  if (manner.length > 0 && !record.manner) record.manner = found(manner, src);
}

function newRecord(d: ResearchedDoctor, discipline: Discipline): DoctorRecord {
  const id = `${d.specialty}:${nameKey(d.name).replace(/[^a-z]+/g, "-")}`;
  const src = sourceOf(d);
  const room = roomOf(d, `${id}:0`);
  const loc = locationOf(room, src, d.telehealth === "only");
  const record: DoctorRecord = {
    id,
    realPerson: true,
    synthetic: false,
    name: { given: d.given, family: d.family, display: d.name },
    specialty: d.specialty,
    conditions: found([], src),
    populations: found(d.populations ?? ["adult"], src),
    telehealth: found(d.telehealth ?? "none", src),
    billing: found("unknown", src),
    capacity: found("unknown", src),
    locations: loc ? [loc] : [],
    booking: room.phone ? { via: "phone", phone: room.phone } : room.website ? { via: "website", url: room.website } : { via: "none" },
    focusTags: found([], src),
    credential: null,
    declared: { telehealth: Boolean(d.telehealth), capacity: false, languages: false },
    waitTimeText: null,
    rooms: [room],
    sources: [src],
    publications: [],
  };
  applyFacts(record, d, src, discipline);
  return record;
}

/**
 * Merge the researched doctors into a roster: attach to the existing record when one matches,
 * else append. Every result carries `personal.status: "published"` with its source URL, and the
 * Layer-2 labels derived from the published words.
 */
export function withPublished(doctors: DoctorRecord[], discipline: Discipline, researched: ResearchedDoctor[] = readResearch(), portraits: Map<string, Portrait> = readPortraits()): DoctorRecord[] {
  if (researched.length === 0) return doctors;
  const photoFor = (r: ResearchedDoctor) => {
    const p = portraits.get(nameKey(r.name));
    return p?.photo_url ? { url: p.photo_url, sourceUrl: p.source_url, ...(p.alt ? { alt: p.alt } : {}) } : undefined;
  };
  const byKey = new Map<string, DoctorRecord>();
  for (const d of doctors) byKey.set(`${d.specialty}|${nameKey(d.name.display)}`, d);
  const out = doctors.slice();
  const added = new Set<string>();
  for (const r of researched) {
    const key = `${r.specialty}|${nameKey(r.name)}`;
    const src = sourceOf(r);
    let record = byKey.get(key);
    if (record) {
      const idx = out.indexOf(record);
      record = { ...record, declared: { ...record.declared }, sources: [...record.sources, src] };
      const geocoded = record.rooms.some((room) => room.state === "QLD" && room.lat !== null && room.lng !== null);
      if (!geocoded || !record.rooms.some((room) => room.website)) {
        const room = roomOf(r, `${record.id}:w`);
        record.rooms = [room, ...record.rooms];
        const loc = locationOf(room, src, r.telehealth === "only");
        if (loc) record.locations = [loc, ...record.locations];
      }
      applyFacts(record, r, src, discipline);
      record.personal = personalOf(r);
      const photo = photoFor(r);
      if (photo) record.photo = photo;
      out[idx] = withPersonalLabels(record, discipline) as DoctorRecord;
      byKey.set(key, out[idx]!);
    } else {
      const fresh = newRecord(r, discipline);
      if (added.has(fresh.id) || byKey.has(key)) continue;
      fresh.personal = personalOf(r);
      const photo = photoFor(r);
      if (photo) fresh.photo = photo;
      const labelled = withPersonalLabels(fresh, discipline) as DoctorRecord;
      out.push(labelled);
      byKey.set(key, labelled);
      added.add(fresh.id);
    }
  }
  return out;
}
