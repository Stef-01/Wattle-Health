// The clinician onboarding flow over the in-memory store (src/server/memory.ts), pure over the
// roster it is handed. src/server/clinician.ts ("use server") runs this when no service key is
// set; the static build runs it in the browser through src/server/clinician-static.ts. The
// Supabase writes live only in clinician.ts. No model calls, no emails.
import type { DoctorRecord } from "@/src/data/types";
import { memFind, memInsert, memUpsert } from "./memory";

export type Backend = "supabase" | "inbox" | "memory";

const AHPRA = /^[A-Z]{3}[0-9]{10}$/;
const DOMAIN = /^[a-z0-9.-]+\.[a-z]{2,}$/;

const SPECIALTY_LABEL: Record<string, string> = {
  psychiatry: "psychiatry",
  paediatrics: "paediatrics and child health",
  "obstetrics-gynaecology": "obstetrics and gynaecology",
};

export function normaliseAhpra(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

export function isAhpra(normalised: string): boolean {
  return AHPRA.test(normalised);
}

export function normaliseName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/^(dr|a\/prof|prof|associate professor|professor)\.?\s+/, "")
    .replace(/[^a-z\s'-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function displayName(raw: string): string {
  const n = raw.trim().replace(/\s+/g, " ");
  return /^dr\b/i.test(n) ? n.replace(/^dr\.?\s*/i, "Dr ") : `Dr ${n}`;
}

export interface Lookup {
  /** True when the number or name matched one of our own records. */
  found: boolean;
  /** Our record id (src/data/providers.ts) when found; carried as practitioners.source_key. */
  doctorId: string | null;
  name: string;
  specialtyLine: string;
  /** We hold register-tier data for this person (Ahpra number, status and conditions flag). */
  registerChecked: boolean;
  registered: boolean;
  conditions: boolean;
  backend: Backend;
}

/** C02: look the number up in our own data first, then fall back to the typed name. */
export function lookupIn(doctors: readonly DoctorRecord[], input: { ahpra: string; name: string; doctorId?: string | null }, backend: Backend): Lookup {
  const ahpra = normaliseAhpra(input.ahpra);
  const name = normaliseName(input.name);

  const byId = input.doctorId ? doctors.find((d) => d.id === input.doctorId) : undefined;
  const byNumber = byId ?? (AHPRA.test(ahpra) ? doctors.find((d) => d.register?.ahpraNumber.value === ahpra) : undefined);
  const byName =
    byNumber ??
    (name
      ? doctors.find((d) => normaliseName(d.name.display) === name || normaliseName(`${d.name.given} ${d.name.family}`) === name)
      : undefined);
  const d = byNumber ?? byName;

  if (!d) {
    return {
      found: false,
      doctorId: null,
      name: displayName(input.name),
      specialtyLine: "Not in our directory yet",
      registerChecked: false,
      registered: false,
      conditions: false,
      backend,
    };
  }
  const label = SPECIALTY_LABEL[d.specialty] ?? d.specialty;
  const registerChecked = Boolean(d.register) && d.register?.ahpraNumber.tier === "register";
  const registered = d.register?.status.value === "registered";
  return {
    found: true,
    doctorId: d.id,
    name: d.name.display,
    // "Specialist" only once the Ahpra specialty is register-tier (CLAUDE.md copy rule).
    specialtyLine: registerChecked ? `Specialist, ${label}` : `Listed under ${label}`,
    registerChecked,
    registered,
    conditions: d.register?.conditionsApply.value ?? false,
    backend,
  };
}

export interface ClaimResult {
  claimId: string;
  practitionerId: string;
  backend: Backend;
}

export interface ClaimInput {
  ahpra: string;
  name: string;
  email: string;
  doctorId: string | null;
}

/** The validated, normalised claim fields both backends write. Throws the message the screen shows. */
export function claimFields(input: ClaimInput): { ahpra: string; domain: string; name: string; given: string | null; family: string | null } {
  const ahpra = normaliseAhpra(input.ahpra);
  if (!AHPRA.test(ahpra)) throw new Error("AHPRA number must be three letters and ten digits, e.g. MED0001234567");
  const domain = input.email.trim().toLowerCase().split("@")[1] ?? "";
  if (!DOMAIN.test(domain)) throw new Error("Enter your practice email so we can match its domain");
  const name = displayName(input.name);
  const parts = name.replace(/^Dr\s+/, "").split(" ");
  const given = parts.slice(0, -1).join(" ") || null;
  const family = parts.at(-1) ?? null;
  return { ahpra, domain, name, given, family };
}

/** C02 "That's me": a provider_claims row (method ahpra+domain-email, status pending). Only the email domain is stored. */
export function createClaimLocal(input: ClaimInput): ClaimResult {
  const { ahpra, domain, name, given, family } = claimFields(input);
  const p = memUpsert<{ id: string }>("practitioners", { ahpra_number: ahpra, display_name: name, given_name: given, family_name: family, profession: "medical", source_key: input.doctorId }, ["ahpra_number"]);
  const c = memInsert<{ id: string }>("provider_claims", { practitioner_id: p.id, claimant_email_domain: domain, method: "ahpra+domain-email", status: "pending" });
  return { claimId: c.id, practitionerId: p.id, backend: "memory" };
}

export interface PracticeInput {
  practitionerId: string;
  practice: string;
  feeDollars: number | null;
  telehealth: boolean;
  referral: boolean;
  bulkBilling: boolean;
}

/** The declared services row and fee both backends write (fee in cents, or null). */
export function practiceFields(input: PracticeInput): { practice: string; now: string; expires: string; services: Record<string, unknown>; fee: number | null } {
  const practice = input.practice.trim();
  if (!practice) throw new Error("Enter where you practise");
  const now = new Date().toISOString();
  const expires = new Date(Date.now() + 90 * 86400_000).toISOString();
  const services = {
    telehealth: input.telehealth ? "some" : "none",
    bulk_billing: input.bulkBilling ? "all" : "none",
    referral_required: input.referral,
    tier: "declared",
    source_id: "claim",
    declared_at: now,
    updated_at: now,
  };
  const fee = input.feeDollars !== null && Number.isFinite(input.feeDollars) ? Math.round(input.feeDollars * 100) : null;
  return { practice, now, expires, services, fee };
}

/** C03 Continue: location + primary practitioner_role, provider_services (declared), fee as observation + field_evidence. */
export function savePracticeLocal(input: PracticeInput): { roleId: string; backend: Backend } {
  const { practice, now, expires, services, fee } = practiceFields(input);
  const loc = memUpsert<{ id: string }>("locations", { name: practice, status: "unverified" }, ["name"]);
  const role = memUpsert<{ id: string }>("practitioner_roles", { practitioner_id: input.practitionerId, location_id: loc.id, primary: true, referral_required: input.referral, fee_policy: input.bulkBilling ? "bulk_bills_all" : "private" }, ["practitioner_id", "location_id"]);
  memUpsert("provider_services", { practitioner_role_id: role.id, ...services }, ["practitioner_role_id"]);
  if (fee !== null) {
    memInsert("observations", { entity_type: "practitioner_role", entity_id: role.id, field: "fees", value: { label: "Initial consult", amountCents: fee }, tier: "declared", source_id: "claim", observed_at: now, expires_at: expires });
    memInsert("field_evidence", { entity_type: "practitioner_role", entity_id: role.id, field: "fees", source_id: "claim", evidence_status: "documented", freshness_at: now });
  }
  return { roleId: role.id, backend: "memory" };
}

/** Columns of personal_profiles the interview fills (0002 + clinical_interests from 0004). */
export interface ProfileText {
  clinical_interests?: string | null;
  communication_approach?: string | null;
  enjoys_serving?: string | null;
  why_medicine?: string | null;
  professional_purpose?: string | null;
  lived_experience?: string | null;
  outside_medicine?: string | null;
  favourite_book?: string | null;
}

/** The personal_profiles row both backends write: status 'draft', consent_at now. */
export function profileRow(input: { practitionerId: string; profile: ProfileText }): Record<string, unknown> {
  const now = new Date().toISOString();
  const clean = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);
  const lived = clean(input.profile.lived_experience);
  return {
    practitioner_id: input.practitionerId,
    clinical_interests: clean(input.profile.clinical_interests),
    communication_approach: clean(input.profile.communication_approach),
    enjoys_serving: clean(input.profile.enjoys_serving),
    why_medicine: clean(input.profile.why_medicine),
    professional_purpose: clean(input.profile.professional_purpose),
    lived_experience: lived,
    lived_experience_opt_in: lived !== null,
    outside_medicine: clean(input.profile.outside_medicine),
    favourite_book: clean(input.profile.favourite_book),
    status: "draft",
    consent_at: now,
    updated_at: now,
  };
}

/** C08 Publish: personal_profiles row, status 'draft'. 'doctor-approved' is set by Wattle after the register check. */
export function publishProfileLocal(input: { practitionerId: string; profile: ProfileText }): { status: "draft"; backend: Backend } {
  memUpsert("personal_profiles", profileRow(input), ["practitioner_id"]);
  return { status: "draft", backend: "memory" };
}

// Test seam for the in-memory path (vitest): find a stored row by predicate.
export function memoryRowLocal(table: string, key: string, value: unknown): Record<string, unknown> | undefined {
  return memFind(table, (r) => r[key] === value);
}
