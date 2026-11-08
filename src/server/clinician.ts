"use server";
// Server actions for the clinician onboarding flow (Figma C01–C08, app/join/**).
// Writes go to Supabase through the REST API with the service role key, or to the in-memory
// store when the key is absent (src/server/clinician-local.ts, which the static build runs in
// the browser instead of these actions; see next.config.mjs). Every action returns `backend`
// so the screens can show the local-mode banner. No model calls, no emails: the register check
// and approval are Wattle-side steps that happen after submission.
import { getDoctors } from "@/src/data/providers";
import {
  claimFields,
  createClaimLocal,
  lookupIn,
  memoryRowLocal,
  practiceFields,
  profileRow,
  publishProfileLocal,
  savePracticeLocal,
  type ClaimInput,
  type ClaimResult,
  type Lookup,
  type PracticeInput,
  type ProfileText,
} from "./clinician-local";
import { backend, inboxPost, insert, select, upsert, type Backend } from "./store";

export type { ClaimResult, Lookup, PracticeInput, ProfileText };

/** C02: look the number up in our own data first, then fall back to the typed name. */
export async function lookupDoctor(input: { ahpra: string; name: string; doctorId?: string | null }): Promise<Lookup> {
  return lookupIn(await getDoctors(), input, backend());
}

/** C02 "That's me": a provider_claims row (method ahpra+domain-email, status pending). Only the email domain is stored. */
export async function createClaim(input: ClaimInput): Promise<ClaimResult> {
  if (backend() !== "supabase") {
    const local = createClaimLocal(input);
    if (backend() === "inbox") await inboxPost("claim", { ...input, email: undefined, domain: claimFields(input).domain, localClaimId: local.claimId });
    return { ...local, backend: backend() };
  }
  const { ahpra, domain, name, given, family } = claimFields(input);

  let practitioner = (await select<{ id: string }>("practitioners", `select=id&ahpra_number=eq.${ahpra}&limit=1`))[0];
  if (!practitioner && input.doctorId) {
    practitioner = (await select<{ id: string }>("practitioners", `select=id&source_key=eq.${encodeURIComponent(input.doctorId)}&limit=1`))[0];
  }
  if (!practitioner) {
    practitioner = await insert<{ id: string }>("practitioners", {
      ahpra_number: ahpra,
      display_name: name,
      given_name: given,
      family_name: family,
      profession: "medical",
      source_key: input.doctorId,
    });
  }
  const claim = await insert<{ id: string }>("provider_claims", {
    practitioner_id: practitioner.id,
    claimant_email_domain: domain,
    method: "ahpra+domain-email",
    status: "pending",
  });
  return { claimId: claim.id, practitionerId: practitioner.id, backend: "supabase" };
}

/** C03 Continue: location + primary practitioner_role, provider_services (declared), fee as observation + field_evidence. */
export async function savePractice(input: PracticeInput): Promise<{ roleId: string; backend: Backend }> {
  if (backend() !== "supabase") {
    const local = savePracticeLocal(input);
    if (backend() === "inbox") await inboxPost("practice", { ...input, localRoleId: local.roleId });
    return { ...local, backend: backend() };
  }
  const { practice, now, expires, services, fee } = practiceFields(input);

  let location = (await select<{ id: string }>("locations", `select=id&name=eq.${encodeURIComponent(practice)}&limit=1`))[0];
  if (!location) location = await insert<{ id: string }>("locations", { name: practice, status: "unverified" });
  const role = await upsert<{ id: string }>(
    "practitioner_roles",
    { practitioner_id: input.practitionerId, location_id: location.id, primary: true, referral_required: input.referral, fee_policy: input.bulkBilling ? "bulk_bills_all" : "private" },
    "practitioner_id,location_id",
  );
  await upsert("provider_services", { practitioner_role_id: role.id, ...services }, "practitioner_role_id");
  if (fee !== null) {
    await insert("observations", { entity_type: "practitioner_role", entity_id: role.id, field: "fees", value: { label: "Initial consult", amountCents: fee }, tier: "declared", source_id: "claim", observed_at: now, expires_at: expires });
    await insert("field_evidence", { entity_type: "practitioner_role", entity_id: role.id, field: "fees", source_id: "claim", evidence_status: "documented", freshness_at: now });
  }
  return { roleId: role.id, backend: "supabase" };
}

/** C08 Publish: personal_profiles row, status 'draft', consent_at now. 'doctor-approved' is set by Wattle after the register check. */
export async function publishProfile(input: { practitionerId: string; profile: ProfileText }): Promise<{ status: "draft"; backend: Backend }> {
  if (backend() !== "supabase") {
    const local = publishProfileLocal(input);
    if (backend() === "inbox") await inboxPost("profile", { ...input });
    return { ...local, backend: backend() };
  }
  await upsert("personal_profiles", profileRow(input), "practitioner_id");
  return { status: "draft", backend: "supabase" };
}

/** Which backend the actions will write to; the screens show a banner in memory mode. */
export async function backendMode(): Promise<Backend> {
  return backend();
}

// Test seam for the in-memory path (vitest): find a stored row by predicate.
export async function memoryRow(table: string, key: string, value: unknown): Promise<Record<string, unknown> | undefined> {
  return memoryRowLocal(table, key, value);
}
