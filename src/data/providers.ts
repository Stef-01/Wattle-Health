// Loads the Queensland roster for the screens. Server only (reads data/ with fs).
//
// Two routes to the same `DoctorRecord[]`: the `published_*` views in Supabase when the
// project's env vars are present (ISR, one hour), else the merged provider files in
// data/providers/*.jsonl. Everything collected from a public page is tier "found"; nothing here
// is a verification (PRD §7).

import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import "@/src/geo/national";
import { resolvePlace } from "@/src/geo/suburbs";
import { loadDiscipline, type Discipline } from "@/src/disciplines/load";
import type { Capacity, Observed, Population, Telehealth, Location } from "@/src/matching/types";

/** The three specialties the MVP lists. */
export type MvpSpecialty = "psychiatry" | "paediatrics" | "obstetrics-gynaecology";
import type { DoctorRecord, PersonalProfile, Publication, Room, SourceRef } from "./types";
import { illustrativeEnabled, loadIllustrative } from "./illustrative";
import { withPublished } from "./published";

const ROOT = process.cwd();
const SPECIALTIES: MvpSpecialty[] = ["psychiatry", "paediatrics", "obstetrics-gynaecology"];

/** The vocabulary the tags are read against: the MVP discipline when it exists, else psychiatry. */
export function mvpDiscipline(): Discipline {
  try {
    return loadDiscipline("mvp", ROOT);
  } catch {
    return loadDiscipline("psychiatry", ROOT);
  }
}

type Raw = {
  id: string;
  specialty: MvpSpecialty;
  name: string;
  credential_tier: string | null;
  tags: string[];
  languages: string[];
  telehealth: boolean | null;
  wait_time: string | null;
  taking_new_patients: boolean | null;
  locations: Array<{
    name: string | null;
    address: string | null;
    suburb: string | null;
    state: string | null;
    postcode: string | null;
    lat: number | null;
    lng: number | null;
    phone: string | null;
    website: string | null;
  }>;
  sources: Array<{ source: string; source_url: string | null; observed_at: string; legal_basis?: string }>;
};

function readJsonl<T>(file: string): T[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as T);
}

function observed<T>(value: T, src: SourceRef): Observed<T> {
  const out: Observed<T> = { value, tier: "found", source: src.source, observedAt: src.observedAt.slice(0, 10) };
  if (src.sourceUrl) out.sourceUrl = src.sourceUrl;
  return out;
}

function splitName(display: string): { given: string; family: string } {
  const parts = display
    .replace(/^(dr\.?|prof\.?|professor|a\/prof(essor)?\.?|assoc\.? prof\.?|mr|ms|mrs)\s+/i, "")
    .trim()
    .split(/\s+/);
  const family = parts.length > 1 ? parts[parts.length - 1]! : "";
  return { given: parts.slice(0, -1).join(" ") || parts[0] || display, family };
}

/** Tags → closed condition ids by cue match on word boundaries. Short cues are skipped: "add" and "flat" are not evidence. */
function conditionIds(tags: string[], discipline: Discipline): string[] {
  const out = new Set<string>();
  const text = tags.map((tag) => ` ${tag.toLowerCase()} `).join(" ");
  for (const group of discipline.conditions) {
    for (const cue of group.cues) {
      const c = cue.toLowerCase();
      if (c.length < 4) continue;
      if (new RegExp(`(^|[^a-z])${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`).test(text)) {
        out.add(group.id);
        break;
      }
    }
  }
  return [...out];
}

function populationsOf(tags: string[], specialty: MvpSpecialty): Population[] {
  const out = new Set<Population>();
  for (const tag of tags) {
    const m = /ages?\s*(\d+)\s*[-–]\s*(\d+)/i.exec(tag);
    if (m) {
      const lo = Number(m[1]);
      const hi = Number(m[2]);
      if (lo < 12) out.add("child");
      if (lo < 18 && hi >= 12) out.add("adolescent");
      if (hi >= 18 && lo < 65) out.add("adult");
      if (hi >= 65) out.add("older-adult");
    }
    const t = tag.toLowerCase();
    if (/\b(child|children|paediatric)\b/.test(t)) out.add("child");
    if (/\b(neonat|newborn|infant)/.test(t)) out.add("infant");
    if (/\b(adolescen|youth|teen)/.test(t)) out.add("adolescent");
    if (/\b(old age|older|geriatric|dementia)\b/.test(t)) out.add("older-adult");
    if (/\b(perinatal|obstetric|pregnan|antenatal|postnatal)/.test(t)) out.add("perinatal");
  }
  if (out.size === 0) {
    if (specialty === "paediatrics") out.add("child");
    else out.add("adult");
  }
  return [...out];
}

function capacityOf(raw: Raw): { capacity: Capacity; weeks?: number; declared: boolean } {
  if (raw.taking_new_patients === false) return { capacity: "closed", declared: true };
  const w = (raw.wait_time ?? "").toLowerCase();
  if (w.includes("not taking")) return { capacity: "closed", declared: true };
  if (w.startsWith("less than 1")) return { capacity: "open", weeks: 2, declared: true };
  if (w.startsWith("1-3")) return { capacity: "waitlist", weeks: 8, declared: true };
  if (w.startsWith("3-6")) return { capacity: "waitlist", weeks: 18, declared: true };
  if (w.startsWith("6+")) return { capacity: "waitlist", weeks: 30, declared: true };
  if (raw.taking_new_patients === true) return { capacity: "open", declared: true };
  return { capacity: "unknown", declared: false };
}

function geocode(l: Raw["locations"][number]): { lat: number | null; lng: number | null } {
  if (typeof l.lat === "number" && typeof l.lng === "number") return { lat: l.lat, lng: l.lng };
  const p = resolvePlace(`${l.suburb ?? ""} ${l.postcode ?? ""} ${l.state ?? ""}`.trim()) ?? resolvePlace(`${l.suburb ?? ""} ${l.state ?? ""}`.trim());
  return p ? { lat: p.lat, lng: p.lon } : { lat: null, lng: null };
}

function toRecord(raw: Raw, discipline: Discipline, pubs: Map<string, { publications: Publication[]; topics: string[] }>, personal: Map<string, PersonalProfile>, deep: Map<string, DeepProfile> = loadDeepProfiles()): DoctorRecord | null {
  const rooms: Room[] = raw.locations
    .filter((l) => l.suburb && l.state && !/not practi/i.test(l.suburb))
    .map((l, i) => ({
      id: `${raw.id}:${i}`,
      name: l.name,
      address: l.address,
      suburb: l.suburb!,
      state: l.state!,
      postcode: l.postcode ?? "",
      // Every state (founder 2026-10-20): a room without coordinates takes its suburb/postcode centroid.
      ...geocode(l),
      phone: l.phone && l.phone !== "0" && l.phone !== "00000000" ? l.phone : null,
      website: l.website,
    }));
  if (!rooms.length) return null;
  const sources: SourceRef[] = raw.sources.map((s) => {
    const ref: SourceRef = { source: s.source, sourceUrl: s.source_url, observedAt: s.observed_at };
    if (s.legal_basis) ref.legalBasis = s.legal_basis;
    return ref;
  });
  const primary = sources[0] ?? { source: "unknown", sourceUrl: null, observedAt: "2026-10-15" };
  const locations: Location[] = rooms
    .filter((r): r is Room & { lat: number; lng: number } => typeof r.lat === "number" && typeof r.lng === "number")
    .map((r) => {
      const loc: Location = { id: r.id, name: r.name ?? "Consulting rooms", suburb: r.suburb, state: r.state as Location["state"], postcode: r.postcode, lat: r.lat, lng: r.lng };
      if (r.phone) loc.phone = observed(r.phone, primary);
      if (r.website) loc.website = observed(r.website, primary);
      return loc;
    });
  const cap = capacityOf(raw);
  const telehealth: Telehealth = raw.telehealth === true ? "some" : "none";
  const phone = rooms.find((r) => r.phone)?.phone ?? undefined;
  const web = rooms.find((r) => r.website)?.website ?? undefined;
  const enriched = pubs.get(raw.id);
  const record: DoctorRecord = {
    id: raw.id,
    realPerson: true,
    synthetic: false,
    name: { ...splitName(raw.name), display: raw.name },
    specialty: raw.specialty,
    conditions: observed(conditionIds(raw.tags, discipline), primary),
    populations: observed(populationsOf(raw.tags, raw.specialty), primary),
    telehealth: observed(telehealth, primary),
    billing: observed("unknown", primary),
    capacity: observed(cap.capacity, primary),
    locations,
    booking: phone ? { via: "phone", phone } : web ? { via: "website", url: web } : { via: "none" },
    focusTags: observed(raw.tags, primary),
    credential: raw.credential_tier,
    declared: { telehealth: raw.telehealth !== null, capacity: cap.declared, languages: raw.languages.length > 0 },
    waitTimeText: raw.wait_time,
    rooms,
    sources,
    publications: enriched?.publications ?? [],
  };
  if (enriched && enriched.topics.length > 0) record.researchTopics = { value: enriched.topics, tier: "found", source: "openalex", observedAt: primary.observedAt.slice(0, 10) };
  // Deeply enriched profiles (pipeline/enrich/deep_profiles.py): condition ids from the source's
  // focus tags and from identifier-matched publications, so Layer 2's "clinical interests" and
  // "research" signals fire. Closed vocabulary only; never prose from a source.
  const d = deep.get(raw.id);
  if (d) {
    if (d.clinical.length > 0) record.clinicalInterests = observed(d.clinical, primary);
    if (d.research.length > 0) record.researchTopics = { value: d.research, tier: "found", source: "openalex", observedAt: d.observedAt };
  }
  if (raw.languages.length > 0) record.languages = observed(raw.languages, primary);
  if (cap.weeks !== undefined) record.waitlistWeeks = observed(cap.weeks, primary);
  if (raw.specialty === "psychiatry") record.referralRequired = observed(true, primary);
  const p = personal.get(raw.id);
  if (p) record.personal = p;
  return record;
}

type RawPublication = {
  provider_id: string;
  authorship_verified?: string;
  research_topics?: string[];
  topics?: string[];
  works?: Array<{ title?: string; year?: number | null; venue?: string | null; doi?: string | null; url?: string | null; source_url?: string | null }>;
};

function loadPublications(): Map<string, { publications: Publication[]; topics: string[] }> {
  const dir = path.join(ROOT, "data", "enriched", "publications");
  const out = new Map<string, { publications: Publication[]; topics: string[] }>();
  if (!existsSync(dir)) return out;
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".jsonl")).sort()) {
    for (const row of readJsonl<RawPublication>(path.join(dir, file))) {
      const verified = row.authorship_verified ?? "unverified";
      if (verified === "unverified") continue;
      const verification: Publication["verification"] = verified === "doctor-confirmed" ? "doctor-confirmed" : "identifier-matched";
      const publications: Publication[] = (row.works ?? [])
        .filter((w) => w.title)
        .slice(0, 5)
        .map((w) => ({
          title: w.title!,
          year: w.year ?? null,
          venue: w.venue ?? null,
          doi: w.doi ?? null,
          url: w.doi ? `https://doi.org/${w.doi.replace(/^https?:\/\/doi\.org\//, "")}` : (w.url ?? w.source_url ?? null),
          verification,
        }));
      out.set(row.provider_id, { publications, topics: row.research_topics ?? row.topics ?? [] });
    }
  }
  return out;
}

type DeepProfile = { clinical: string[]; research: string[]; observedAt: string };

type RawDeep = { generated_at?: string; doctors?: Array<{ id: string; clinical_interest_ids?: string[]; research_topic_ids?: string[] }> };

let deepCache: Map<string, DeepProfile> | null = null;

/** data/enriched/deep_profiles.json → id → closed condition ids. Empty when the file is absent. */
function loadDeepProfiles(): Map<string, DeepProfile> {
  if (deepCache) return deepCache;
  const out = new Map<string, DeepProfile>();
  const file = path.join(ROOT, "data", "enriched", "deep_profiles.json");
  if (existsSync(file)) {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as RawDeep;
    const observedAt = (parsed.generated_at ?? "2026-10-15").slice(0, 10);
    for (const row of parsed.doctors ?? []) {
      out.set(row.id, { clinical: row.clinical_interest_ids ?? [], research: row.research_topic_ids ?? [], observedAt });
    }
  }
  deepCache = out;
  return out;
}

type RawPersonal = { provider_id: string; status: string } & Record<string, unknown>;

function personalFrom(row: Record<string, unknown>, status: PersonalProfile["status"]): PersonalProfile {
  const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v : undefined);
  const list = (v: unknown): string[] | undefined => (Array.isArray(v) ? v.map(String).filter(Boolean) : str(v) ? [str(v)!] : undefined);
  const stat: PersonalProfile["status"] = status;
  const p: PersonalProfile = { status: stat };
  const philosophy = str(row.philosophy) ?? str(row.philosophy_of_care);
  const whyMedicine = str(row.whyMedicine) ?? str(row.why_medicine);
  const purpose = str(row.purpose) ?? str(row.professional_purpose);
  const enjoysServing = list(row.enjoysServing ?? row.enjoys_serving);
  const communication = list(row.communication ?? row.communication_approach);
  const livedExperience = list(row.livedExperience ?? row.lived_experience);
  const hobbies = list(row.hobbies ?? row.outside_medicine);
  const labels = list(row.labels);
  if (philosophy) p.philosophy = philosophy;
  if (whyMedicine) p.whyMedicine = whyMedicine;
  if (purpose) p.purpose = purpose;
  if (enjoysServing) p.enjoysServing = enjoysServing;
  if (communication) p.communication = communication;
  if (livedExperience) p.livedExperience = livedExperience;
  if (hobbies) p.hobbies = hobbies;
  if (labels) p.labels = labels;
  return p;
}

function loadPersonal(): Map<string, PersonalProfile> {
  const dir = path.join(ROOT, "data", "enriched", "personal");
  const out = new Map<string, PersonalProfile>();
  if (!existsSync(dir)) return out;
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".jsonl")).sort()) {
    for (const row of readJsonl<RawPersonal>(path.join(dir, file))) {
      if (row.status !== "doctor-approved" && row.status !== "illustrative") continue;
      out.set(row.provider_id, personalFrom(row, row.status));
    }
  }
  return out;
}

let cache: DoctorRecord[] | null = null;

/** The file-backed roster exactly as getDoctors() serves it without Supabase. */
export function buildRoster(): DoctorRecord[] {
  return withIllustrative(withPublished(fromJsonl(), mvpDiscipline()));
}

function fromJsonl(): DoctorRecord[] {
  const discipline = mvpDiscipline();
  const pubs = loadPublications();
  const personal = loadPersonal();
  const deep = loadDeepProfiles();
  const out: DoctorRecord[] = [];
  for (const specialty of SPECIALTIES) {
    for (const raw of readJsonl<Raw>(path.join(ROOT, "data", "providers", `${specialty}.jsonl`))) {
      const record = toRecord(raw, discipline, pubs, personal, deep);
      if (record) out.push(record);
    }
  }
  return out;
}

/** The fictional illustrative profiles, when the environment includes them (see illustrative.ts). */
function withIllustrative(doctors: DoctorRecord[]): DoctorRecord[] {
  if (!illustrativeEnabled()) return doctors;
  const ids = new Set(doctors.map((d) => d.id));
  return [...doctors, ...loadIllustrative(mvpDiscipline(), ROOT).filter((d) => !ids.has(d.id))];
}

// ---------------------------------------------------------------- Supabase (published_* views)

function supabaseEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

async function view<T>(env: { url: string; key: string }, name: string, query = "select=*"): Promise<T[]> {
  const res = await fetch(`${env.url}/rest/v1/${name}?${query}`, {
    headers: { apikey: env.key, Authorization: `Bearer ${env.key}` },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`${name}: ${res.status}`);
  return (await res.json()) as T[];
}

/**
 * The views carry the same facts in a different shape (practitioner + services + clinical focus
 * + publications + personal profile). Only Queensland rows survive. Any failure falls back to the
 * files so the screens never go empty because a view changed.
 */
async function fromSupabase(env: { url: string; key: string }): Promise<DoctorRecord[] | null> {
  try {
    type P = { id: string; display_name: string; specialties: string[] | null; registration_status: string; register_url: string | null; ahpra_number: string | null; register_checked_at: string | null; synthetic: boolean };
    type S = { practitioner_id: string; location_id: string | null; telehealth: boolean | null; languages: string[] | null; wait_time_text: string | null; accepting_new_patients: string | null; tier: string; source_id: string | null; source_url: string | null; declared_at: string | null };
    type F = { practitioner_id: string; slug: string; label: string; tier: string; source_url: string | null; observed_at: string };
    type Pub = { practitioner_id: string; title: string; doi: string | null; year: number | null; venue: string | null; authorship_verified: string; source_url: string | null };
    type Per = { practitioner_id: string; status: "doctor-approved" | "illustrative"; philosophy_of_care: string | null; why_medicine: string | null; professional_purpose: string | null; communication_approach: string | null; lived_experience: string | null; hobbies: string | null; outside_medicine: string | null; approved_at: string | null };
    type Obs = { entity_type: string; entity_id: string; attribute: string; value: unknown; tier: string; source: string | null; observed_at: string };
    const [practitioners, services, focus, pubs, personal, observations] = await Promise.all([
      view<P>(env, "published_practitioners"),
      view<S>(env, "published_services"),
      view<F>(env, "published_clinical_focus"),
      view<Pub>(env, "published_publications", "select=*&authorship_verified=neq.unverified"),
      view<Per>(env, "published_personal_profiles"),
      view<Obs>(env, "published_observations", "select=*&entity_type=eq.practitioner&attribute=in.(locations,state)"),
    ]);
    const by = <T extends { practitioner_id: string }>(rows: T[]) => {
      const m = new Map<string, T[]>();
      for (const r of rows) m.set(r.practitioner_id, [...(m.get(r.practitioner_id) ?? []), r]);
      return m;
    };
    const sBy = by(services), fBy = by(focus), pBy = by(pubs), perBy = by(personal);
    const obsBy = new Map<string, Obs[]>();
    for (const o of observations) obsBy.set(o.entity_id, [...(obsBy.get(o.entity_id) ?? []), o]);
    const out: DoctorRecord[] = [];
    for (const p of practitioners) {
      if (p.synthetic) continue;
      const specialty = (p.specialties ?? []).find((s): s is MvpSpecialty => (SPECIALTIES as string[]).includes(s));
      if (!specialty) continue;
      const rows = obsBy.get(p.id) ?? [];
      const locRow = rows.find((o) => o.attribute === "locations");
      const rawRooms = Array.isArray(locRow?.value) ? (locRow!.value as Raw["locations"]) : [];
      const stateRow = rows.find((o) => o.attribute === "state");
      if (!rawRooms.length && !stateRow) continue;
      const svc = sBy.get(p.id)?.[0];
      const src: SourceRef = { source: svc?.source_id ?? "supabase", sourceUrl: svc?.source_url ?? null, observedAt: svc?.declared_at ?? p.register_checked_at ?? "2026-10-15" };
      const tags = (fBy.get(p.id) ?? []).map((f) => f.label);
      const raw: Raw = {
        id: p.id, specialty, name: p.display_name, credential_tier: null, tags,
        languages: svc?.languages ?? [], telehealth: svc?.telehealth ?? null, wait_time: svc?.wait_time_text ?? null,
        taking_new_patients: svc?.accepting_new_patients === "yes" ? true : svc?.accepting_new_patients === "no" ? false : null,
        locations: rawRooms, sources: [{ source: src.source, source_url: src.sourceUrl, observed_at: src.observedAt }],
      };
      const perMap = new Map<string, PersonalProfile>();
      const per = perBy.get(p.id)?.[0];
      if (per) perMap.set(p.id, personalFrom(per as unknown as Record<string, unknown>, per.status));
      const pubMap = new Map<string, { publications: Publication[]; topics: string[] }>();
      const pr = pBy.get(p.id) ?? [];
      if (pr.length) {
        pubMap.set(p.id, {
          topics: [],
          publications: pr.slice(0, 5).map((w) => ({
            title: w.title, year: w.year, venue: w.venue, doi: w.doi,
            url: w.doi ? `https://doi.org/${w.doi}` : w.source_url,
            verification: w.authorship_verified === "doctor-confirmed" ? "doctor-confirmed" : "identifier-matched",
          })),
        });
      }
      const record = toRecord(raw, mvpDiscipline(), pubMap, perMap);
      if (!record) continue;
      if (p.registration_status === "registered" && p.ahpra_number && p.register_url) {
        const reg: SourceRef = { source: "ahpra", sourceUrl: p.register_url, observedAt: p.register_checked_at ?? src.observedAt };
        record.register = {
          ahpraNumber: { ...observed(p.ahpra_number, reg), tier: "register" },
          status: { ...observed("registered" as const, reg), tier: "register" },
          conditionsApply: { ...observed(false, reg), tier: "register" },
          registerUrl: p.register_url,
        };
      }
      out.push(record);
    }
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

/** Every real doctor with a Queensland room, plus the labelled illustrative examples when enabled. Cached per server process. */
export async function getDoctors(): Promise<DoctorRecord[]> {
  const env = supabaseEnv();
  if (env) {
    const rows = await fromSupabase(env);
    if (rows) return withIllustrative(withPublished(rows, mvpDiscipline()));
  }
  if (!cache) cache = buildRoster();
  return cache;
}

export async function getDoctor(id: string): Promise<DoctorRecord | null> {
  const doctors = await getDoctors();
  return doctors.find((d) => d.id === id) ?? null;
}

/** Counts for the About screen and the QA notes. */
export async function rosterCounts(): Promise<Record<MvpSpecialty, number> & { total: number }> {
  const doctors = await getDoctors();
  const counts = { psychiatry: 0, paediatrics: 0, "obstetrics-gynaecology": 0, total: doctors.length };
  for (const d of doctors) if (d.specialty in counts) counts[d.specialty as MvpSpecialty] += 1;
  return counts;
}
