// Healthspan matching (2026-10-19). Ranks doctors whose own published words show prevention or
// healthspan work (personal.healthspan) against what the patient chose: the areas that matter to
// them, the device they wear, and whether they want extended bloodwork read with them. Deterministic.
import type { DoctorRecord } from "./types";
import type { Device } from "./healthspan";

export type HealthspanAsk = { areas: string[]; device: Device; bloodwork: boolean; telehealth: boolean };
export type HealthspanMatch = { doctor: DoctorRecord; score: number; reasons: string[]; evidence: string };

const AREA_LABEL: Record<string, string> = { heart: "heart health", fitness: "fitness", metabolic: "metabolic health", sleep: "sleep", brain: "brain health", hormones: "hormones and menopause", strength: "muscle and bone" };
const DEVICE_LABEL: Record<Device, string> = { none: "", apple: "Apple Watch", oura: "Oura", whoop: "Whoop", garmin: "Garmin", cgm: "glucose monitor" };

export function matchHealthspan(doctors: DoctorRecord[], ask: HealthspanAsk): HealthspanMatch[] {
  const out: HealthspanMatch[] = [];
  for (const d of doctors) {
    const h = d.personal?.status === "published" || d.personal?.status === "doctor-approved" ? d.personal.healthspan : undefined;
    if (!h) continue;
    const reasons: string[] = [];
    let score = 1;
    const shared = ask.areas.filter((a) => h.areas.includes(a));
    if (shared.length) {
      score += shared.length * 2;
      const names = shared.map((a) => AREA_LABEL[a] ?? a);
      reasons.push(`Works on ${names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0]}`);
    }
    const wantsDevice = ask.device !== "none";
    const deviceOk = ask.device === "cgm" ? h.opensTo.includes("cgm") || h.opensTo.includes("wearables") : h.opensTo.includes("wearables");
    if (wantsDevice && deviceOk) {
      score += 4;
      reasons.push(`Welcomes your ${DEVICE_LABEL[ask.device]} data`);
    }
    if (ask.bloodwork && h.opensTo.includes("biomarkers")) {
      score += 3;
      reasons.push("Reads extended bloodwork with you");
    }
    const tele = d.declared?.telehealth === true && d.telehealth?.value !== "none";
    if (ask.telehealth && tele) {
      score += 1;
      reasons.push("Telehealth");
    }
    out.push({ doctor: d, score, reasons, evidence: h.evidence });
  }
  return out.sort((a, b) => b.score - a.score || a.doctor.id.localeCompare(b.doctor.id));
}
