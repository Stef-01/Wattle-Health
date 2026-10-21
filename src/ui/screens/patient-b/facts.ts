// Facts the P06–P11 screens render, each read from the record and never invented.
// No fs here: client components import this file.
import type { DoctorRecord, Publication, Room } from "@/src/data/types";
import { asList, sourceLabel } from "@/src/data/types";
import { isAllied, type Reason, type Tier } from "@/src/matching/types";

/** "Dr. Jane Smith" → "Dr Jane Smith"; a bare name gets no honorific added. */
export function drName(d: Pick<DoctorRecord, "name">): string {
  return d.name.display.replace(/^Dr\.\s*/i, "Dr ").replace(/\s+/g, " ").trim();
}

/** "Dr Smith" for headings and CTAs. Falls back to the display name when no family name is known. */
export function drShort(d: Pick<DoctorRecord, "name"> & { specialty?: string }): string {
  // Allied providers are not doctors: "Dr" only when their own display name carries it.
  if (d.specialty && isAllied(d.specialty) && !/^dr/i.test(d.name.display.trim())) return drName(d);
  return d.name.family ? `Dr ${d.name.family}` : drName(d);
}

/** Gendered pronouns only when the record declares a gender; otherwise "they". */
export function pronouns(d: Pick<DoctorRecord, "gender">): { subject: string; possessive: string; practises: string; hasnt: string } {
  const g = d.gender?.value;
  if (g === "woman") return { subject: "she", possessive: "Her", practises: "practises", hasnt: "Hasn’t" };
  if (g === "man") return { subject: "he", possessive: "His", practises: "practises", hasnt: "Hasn’t" };
  return { subject: "they", possessive: "Their", practises: "practise", hasnt: "Haven’t" };
}

/** The first room. */
export function primaryRoom(d: Pick<DoctorRecord, "rooms">) {
  return d.rooms[0] ?? null;
}

/** Region of a Queensland room by latitude: Sunshine Coast north of Caboolture, Gold Coast south of Logan, else Brisbane. */
export function regionOf(r: Pick<Room, "state" | "lat">): string {
  if (r.state !== "QLD") return r.state;
  if (r.lat !== null && r.lat > -27.0) return "Sunshine Coast";
  if (r.lat !== null && r.lat < -27.7) return "Gold Coast";
  return "Brisbane";
}

export function placeOf(d: Pick<DoctorRecord, "rooms">): string {
  const r = primaryRoom(d);
  if (!r) return "Australia";
  const city = regionOf(r);
  return r.suburb.toLowerCase() === city.toLowerCase() ? r.suburb : `${r.suburb}, ${city}`;
}

/** Declared or found fee as dollars, or null. Never estimated. */
export function feeOf(d: Pick<DoctorRecord, "fees">): string | null {
  const first = d.fees?.value?.[0];
  if (!first || !Number.isFinite(first.amountCents)) return null;
  return `$${Math.round(first.amountCents / 100)}`;
}

/** Only publications whose authorship is identifier-matched or doctor-confirmed reach the record. */
export function verifiedPublications(d: Pick<DoctorRecord, "publications">): Publication[] {
  return d.publications.filter((p) => p.verification === "identifier-matched" || p.verification === "doctor-confirmed");
}

export function papersLine(d: Pick<DoctorRecord, "publications">): string | null {
  const n = verifiedPublications(d).length;
  if (n === 0) return null;
  return n === 1 ? "1 paper" : `${n} papers`;
}

/** The doctor's closed condition ids as yaml labels; falls back to the source's own tags. */
export function conditionLabels(d: Pick<DoctorRecord, "conditions" | "focusTags">, labels: Record<string, string>): string[] {
  const ids = d.conditions.value.map((id) => labels[id] ?? id.replace(/-/g, " "));
  if (ids.length > 0) return ids;
  return d.focusTags.value;
}

/** Sentence-cased, comma-joined, lower-cased after the first item ("Endometriosis, pelvic pain"). */
export function joinLabels(items: string[], max = 3, lowerAll = false): string {
  const shown = items.slice(0, max).map((s, i) => (i === 0 && !lowerAll ? s : s.charAt(0).toLowerCase() + s.slice(1)));
  if (shown.length === 2) return `${shown[0]} and ${shown[1]}`;
  return shown.join(", ");
}

/** Source ids that have no entry in SOURCE_LABELS read as a name, not a slug ("healthscope" → "Healthscope"). */
export function niceSource(source: string): string {
  const known = sourceLabel(source);
  if (known !== source) return known;
  return source.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const TIER_WORD: Record<Tier, string> = { register: "register", declared: "declared", found: "found" };

export interface SourceNote {
  text: string;
  href: string | null;
}

/** "RANZCOG, found 2026-10-15" for a tier badge on one line. */
export function sourceNote(source: string, tier: Tier, date: string | undefined, href?: string | null): SourceNote {
  const day = (date ?? "").slice(0, 10);
  return { text: `${niceSource(source)}, ${TIER_WORD[tier]}${day ? ` ${day}` : ""}`, href: href ?? null };
}

export function personalStatusLabel(d: Pick<DoctorRecord, "personal" | "name"> & { specialty?: string }): string | null {
  const p = d.personal;
  if (!p || p.status === "draft") return null;
  if (p.status === "doctor-approved") return `Approved by ${drShort(d)}${p.approvedAt ? ` ${p.approvedAt.slice(0, 10)}` : ""}`;
  if (p.status === "published") return `${drShort(d)}’s own words, ${p.sourceName ?? "practice website"}${p.observedAt ? `, ${p.observedAt.slice(0, 10)}` : ""}`;
  return "Illustrative example, not this doctor’s words";
}

/** "Polycystic ovary syndrome" → "polycystic ovary syndrome"; "ADHD" and "IVF" keep their capitals. */
function lowerLabel(label: string): string {
  return label
    .split(" ")
    .map((w) => (/^[A-Z0-9]{2,}$/.test(w) || /^.+[A-Z]/.test(w) ? w : w.toLowerCase()))
    .join(" ");
}

/**
 * The engine's reason text in the Figma's closed phrasing (P06, P07, P09):
 * "Declares X as a condition they see" → "Lists x as a condition they see",
 * "Declares X as a primary interest" → "Lists x as a primary interest"; anything else is sentence-cased.
 */
const ACRONYMS = ["ADHD", "ME/CFS", "POTS", "IBS", "OCD", "PTSD", "FND", "PCOS", "COVID-19", "EDS"];
/** Restores capitals the engine lowered ("adhd" → "ADHD"). */
function recase(text: string): string {
  let out = text;
  for (const a of ACRONYMS) out = out.replace(new RegExp(`(^|[^a-z])${a.toLowerCase().replace(/[/-]/g, "\\$&")}(?![a-z])`, "g"), `$1${a}`);
  return out;
}

export function humanReason(reason: string): string {
  const m = /^Declares (.+) as a (condition they see|primary interest)$/.exec(reason.trim());
  if (m) return recase(`Lists ${lowerLabel(m[1] ?? "")} as a ${m[2]}`);
  const t = reason.trim();
  return recase(t.charAt(0).toUpperCase() + t.slice(1));
}

/** Where a reason's evidence lives on the record, as a one-line source note. */
export function sourceForReason(d: DoctorRecord, reason: Reason): SourceNote {
  const f = reason.field;
  const primary = d.sources[0];
  if (f.startsWith("personal")) {
    const label = personalStatusLabel(d) ?? "No personal profile yet";
    return { text: label, href: null };
  }
  if (f === "researchTopics" || f === "publications") {
    const pubs = verifiedPublications(d);
    const years = pubs.map((p) => p.year).filter((y): y is number => typeof y === "number");
    const span = years.length ? (Math.min(...years) === Math.max(...years) ? `${years[0]}` : `${Math.min(...years)} to ${Math.max(...years)}`) : "";
    return { text: `OpenAlex, identifier-matched${span ? ` ${span}` : ""}`, href: pubs[0]?.url ?? null };
  }
  if (f === "conditions" || f === "clinicalInterests" || f === "focusTags" || f === "conditionsSometimes") {
    const o = d.conditions;
    return sourceNote(o.source, reason.tier ?? o.tier, o.observedAt, o.sourceUrl);
  }
  if (f === "manner" && d.manner) return sourceNote(d.manner.source, d.manner.tier, d.manner.observedAt, d.manner.sourceUrl);
  if (f === "approaches" && d.approaches) return sourceNote(d.approaches.source, d.approaches.tier, d.approaches.observedAt, d.approaches.sourceUrl);
  if (f === "telehealth") return sourceNote(d.telehealth.source, d.telehealth.tier, d.telehealth.observedAt, d.telehealth.sourceUrl);
  if (f === "populations") return sourceNote(d.populations.source, d.populations.tier, d.populations.observedAt, d.populations.sourceUrl);
  if (f === "register" || f === "specialty") {
    if (d.register) return sourceNote("ahpra", "register", d.register.status.observedAt, d.register.registerUrl);
  }
  if (primary) return sourceNote(primary.source, reason.tier ?? "found", primary.observedAt, primary.sourceUrl);
  return { text: "Source not recorded", href: null };
}

/** Practice contact facts from the rooms: phone and website, each with where it came from. */
export function contactOf(d: DoctorRecord): { phone: string | null; website: string | null; room: string | null } {
  const withPhone = d.rooms.find((r) => r.phone);
  const withSite = d.rooms.find((r) => r.website);
  const room = primaryRoom(d);
  return {
    phone: withPhone?.phone ?? d.booking.phone ?? null,
    website: withSite?.website ?? d.booking.url ?? null,
    room: room ? [room.name, room.suburb].filter(Boolean).join(", ") : null,
  };
}

/* ------------------------------------------------------ profile v3 (2026-10-16) */

/** Plain-English title for a specialty, as patients say it. Pain medicine is an Ahpra specialty. */
export const SPECIALTY_TITLE: Record<string, string> = {
  psychiatry: "Psychiatrist",
  paediatrics: "Paediatrician",
  "obstetrics-gynaecology": "Gynaecologist",
  "general-practice": "GP",
  "pain-medicine": "Pain medicine physician",
  rheumatology: "Rheumatologist",
  psychology: "Psychologist",
  "occupational-therapy": "Occupational therapist",
  "allied-health": "Allied health",
};
export const specialtyTitle = (s: string): string => SPECIALTY_TITLE[s] ?? s.replace(/-/g, " ");

/** The title a card or profile shows: the provider's own `profession` ("Clinical psychologist", "ADHD coach") when the record has one, else the specialty title. */
export const providerTitle = (d: { specialty: string; profession?: string }): string => d.profession?.trim() || specialtyTitle(d.specialty);

/** The personal block a screen may show: anything but a draft. */
export function personalOf(d: Pick<DoctorRecord, "personal">): NonNullable<DoctorRecord["personal"]> | null {
  return d.personal && d.personal.status !== "draft" ? d.personal : null;
}

/** First-person-ish words: one quote under `max` words, preferring what they say about why or how, then the philosophy. */
export function quoteOf(d: Pick<DoctorRecord, "personal">, max = 28): { text: string; about: string } | null {
  const p = personalOf(d);
  if (!p) return null;
  const words = (t: string) => t.trim().split(/\s+/).length;
  const order = ["approach", "why", "lived", "other"];
  const quotes = (p.quotes ?? []).filter((q) => words(q.text) <= max && q.about !== "hobbies").sort((a, b) => order.indexOf(a.about) - order.indexOf(b.about));
  if (quotes[0]) return quotes[0];
  const fallback = p.philosophyOfCare ?? p.philosophy ?? p.communicationApproach ?? p.whyMedicine ?? null;
  if (fallback) return { text: clip(fallback, 150), about: "approach" };
  const hobby = (p.quotes ?? []).find((q) => q.about === "hobbies" && words(q.text) <= max);
  return hobby ?? null;
}

/** Clip on a word boundary, so a cut never lands mid-word. */
export function clip(text: string, chars: number): string {
  if (text.length <= chars) return text;
  const head = text.slice(0, chars - 1);
  const cut = head.lastIndexOf(" ") > chars * 0.6 ? head.slice(0, head.lastIndexOf(" ")) : head;
  return `${cut.replace(/[,;:\s]+$/, "")}…`;
}

/** A human_fit id as a label ("lgbtq-affirming" → "LGBTQ+ affirming"). */
export function styleLabel(id: string): string {
  const special: Record<string, string> = { "lgbtq-affirming": "LGBTQ+ affirming", "evidence-based": "Evidence-based", "research-active": "Research active", "trauma-informed": "Trauma-informed", "neurodiversity-affirming": "Neurodiversity-affirming", "culturally-safe": "Culturally safe", "long-appointments": "Longer appointments", "lived-experience": "Lived experience" };
  const s = special[id] ?? id.replace(/-/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Hobbies as short chips (first clause of each, under 5 words where possible). */
export function hobbyChips(d: Pick<DoctorRecord, "personal">, max = 4): string[] {
  const p = personalOf(d);
  if (!p) return [];
  return asList(p.hobbies)
    .map((h) => h.split(/[,(;]/)[0]!.trim())
    .filter(Boolean)
    .map((h) => (h.split(/\s+/).length > 8 ? `${h.split(/\s+/).slice(0, 7).join(" ")}…` : h))
    .slice(0, max);
}

/** "Open to new patients", "Telehealth", "$280" and "Referral needed", only what the record states. */
export function practicalChips(d: DoctorRecord): string[] {
  const out: string[] = [];
  if (d.scopeNote) out.push(d.scopeNote);
  if (d.declared.capacity && d.capacity.value === "open") out.push("Open to new patients");
  if (d.declared.capacity && d.capacity.value === "waitlist") out.push(d.waitlistWeeks ? `${d.waitlistWeeks.value}-week wait` : "Waitlist");
  if (d.declared.telehealth && d.telehealth.value !== "none") out.push(d.telehealth.value === "only" ? "Telehealth only" : "Telehealth");
  const fee = feeOf(d);
  if (fee) out.push(`${fee} first visit`);
  if (d.referralRequired?.value === true) out.push("Referral needed");
  return out;
}

export const yearsLine = (d: DoctorRecord): string | null => (typeof d.yearsInSpecialty?.value === "number" ? `${d.yearsInSpecialty.value} yrs` : null);

/** Where the words came from, for the profile footer. */
export function wordsSource(d: Pick<DoctorRecord, "personal" | "name"> & { specialty?: string }): { text: string; href: string | null } | null {
  const p = personalOf(d);
  if (!p) return null;
  if (p.status === "published") return { text: `${drShort(d)}’s own words, from ${p.sourceName ?? "their practice website"}, ${p.observedAt ?? ""}`.trim(), href: p.sourceUrl ?? null };
  if (p.status === "doctor-approved") return { text: `Written and approved by ${drShort(d)}${p.approvedAt ? `, ${p.approvedAt.slice(0, 10)}` : ""}`, href: null };
  return { text: "Illustrative example. Not a real doctor’s words.", href: null };
}

/** "a, b and c" in lower case where the label allows it. */
export function listSentence(items: string[]): string {
  const ls = items.map((x, i) => (i === 0 ? x : x.charAt(0).toLowerCase() + x.slice(1)));
  if (ls.length <= 1) return ls[0] ?? "";
  if (ls.some((x) => / and /.test(x))) return ls.join(", ");
  return `${ls.slice(0, -1).join(", ")} and ${ls[ls.length - 1]}`;
}

/** Hobbies as one sentence: "Running, Pilates and time with her three children." */
export function hobbySentence(d: Pick<DoctorRecord, "personal">): string | null {
  const p = personalOf(d);
  if (!p) return null;
  const chips = hobbyChips(d, 5);
  const outside = p.outsideMedicine ?? null;
  if (chips.length === 0) return outside;
  const list = listSentence(chips);
  const first = `${list.charAt(0).toUpperCase()}${list.slice(1)}.`;
  return outside ? `${first} ${outside}` : first;
}

/** A concrete sentence about how they work, in their words; null when only abstract labels exist. */
export function approachSentence(d: Pick<DoctorRecord, "personal">): string | null {
  const p = personalOf(d);
  if (!p) return null;
  const quote = (p.quotes ?? []).find((q) => q.about === "approach");
  if (quote) return quote.text;
  return p.communicationApproach ?? null;
}
