// The type bridge between Wattle's `Doctor` (src/matching/types.ts, PRD §7) and the ported
// ADHD.ME `Clinician` (src/matching/clinician.ts). Written for the port on 2026-10-15; nothing
// here existed in ADHD.ME, whose roster was authored directly in the `Clinician` shape.
//
// THE MINIMAL THING. Every field the ranker reads is mapped; every declaration keeps the tier
// it was observed at (`tierOf` reads it back for the evidence rows). Nothing is inferred from a
// name, a portrait or an address: a doctor with no gender observation is "not-declared", not a
// man; a doctor with no language observation speaks English because that is the Australian
// register assumption, not a claim about them.

import type { Clinician } from "./clinician";
import { isAllied, type Doctor, type Evidence, type Tier } from "./types";
import type { NeedSignal } from "./needs";
import { PROFESSION_FOR_SPECIALTY } from "./support/professions";
import type { SuburbPoint } from "@/src/geo/suburbs";

/** Accepting new patients: open books, or a waitlist there is still a door to knock on. */
function accepting(doctor: Doctor): boolean {
  const capacity = doctor.capacity.value;
  return capacity === "open" || capacity === "waitlist" || capacity === "unknown";
}

function points(doctor: Doctor): SuburbPoint[] {
  return doctor.locations
    .filter((location) => !location.telehealthOnly)
    .map((location) => ({ suburb: location.suburb, postcode: location.postcode, lat: location.lat, lon: location.lng }));
}

function booking(doctor: Doctor): Clinician["booking"] {
  const { via, url, phone, note } = doctor.booking;
  if (via === "platform" && url) return { via: "platform", platform: platformName(url), url };
  if (via === "website" && url) return { via: "practice", url, note: note ?? "Booked through the practice." };
  if (via === "phone" && phone) return { via: "practice", url: `tel:${phone}`, note: note ?? "Booked by phone through the practice." };
  return { via: "none", note: note ?? (doctor.synthetic ? "Example profile. There is nobody to book." : "No booking route is listed.") };
}

/** The platform's own name from its host, so the handoff names where the reader is going. */
function platformName(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const label = host.split(".")[0] ?? host;
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    return "the booking platform";
  }
}

export function toClinician(doctor: Doctor): Clinician {
  const physical = doctor.locations.filter((location) => !location.telehealthOnly);
  const primary = physical[0] ?? doctor.locations[0];
  const telehealth = doctor.telehealth.value;
  const languages = doctor.languages?.value ?? doctor.register?.languages?.value ?? ["English"];
  const careAreas = doctor.conditions.value;
  const careAreasSometimes = doctor.conditionsSometimes?.value;
  const billing = doctor.billing.value;
  const practicalSignals: string[] = [];
  if (billing === "bulk-bills") practicalSignals.push("Bulk billing");
  if (billing === "bulk-bills-concession") practicalSignals.push("Bulk billing with a concession card");
  if (billing === "gap") practicalSignals.push("Gap fee");
  if (billing === "private") practicalSignals.push("Private fee");

  const clinician: Clinician = {
    id: doctor.id,
    doctorId: doctor.id,
    name: doctor.name.display,
    shortName: isAllied(doctor.specialty) && !/^dr/i.test(doctor.name.display.trim()) ? doctor.name.display : `Dr ${doctor.name.family}`,
    profession: PROFESSION_FOR_SPECIALTY[doctor.specialty] ?? "gp",
    gender: doctor.gender?.value ?? "not-declared",
    suburb: primary?.suburb ?? "",
    reach: telehealth === "only" ? "By telehealth" : telehealth === "none" ? "Practice appointments" : "Practice appointments and telehealth",
    practice: primary?.name ?? "",
    booking: booking(doctor),
    acceptingNewPatients: accepting(doctor),
    matchLine: "",
    practicalSignals,
    languages: languages.includes("English") ? languages : ["English", ...languages],
    careAreas,
    manner: doctor.manner?.value ?? [],
    wheelchairAccessible: doctor.locations.some((location) => location.wheelchair?.value === true),
    appointmentLength: "",
    synthetic: doctor.synthetic,
  };
  if (doctor.capacity.value !== "unknown") clinician.capacityDeclaredAt = doctor.capacity.observedAt;
  if (careAreasSometimes && careAreasSometimes.length > 0) clinician.careAreasSometimes = [...careAreasSometimes];
  if (physical.length > 1) clinician.alsoConsultsAt = physical.slice(1).map((location) => location.suburb);
  const consultingPoints = points(doctor);
  if (consultingPoints.length > 0) clinician.consultingPoints = consultingPoints;
  if (telehealth === "first-appointment" || telehealth === "only") clinician.telehealthFirstAppointment = true;
  if (telehealth === "only") clinician.telehealthOnly = true;
  return clinician;
}

/** The evidence kind and the tier of the declaration behind one matched facet. */
export function evidenceFor(doctor: Doctor, facet: NeedSignal["facet"]): Pick<Evidence, "kind" | "tier"> {
  switch (facet.kind) {
    case "care": {
      const sometimes = doctor.conditionsSometimes;
      const tier: Tier = sometimes && sometimes.value.includes(facet.area) && !doctor.conditions.value.includes(facet.area)
        ? sometimes.tier
        : doctor.conditions.tier;
      return { kind: "condition", tier };
    }
    case "manner":
      return { kind: "manner", tier: doctor.manner?.tier ?? "declared" };
    case "language":
      return { kind: "constraint", tier: doctor.languages?.tier ?? doctor.register?.languages?.tier ?? "declared" };
    case "preference": {
      const tier: Tier =
        facet.preference === "woman-gp" || facet.preference === "man-gp"
          ? doctor.gender?.tier ?? "declared"
          : facet.preference === "telehealth-first"
            ? doctor.telehealth.tier
            : facet.preference === "bulk-billing"
              ? doctor.billing.tier
              : doctor.manner?.tier ?? "declared";
      return { kind: "constraint", tier };
    }
  }
}
