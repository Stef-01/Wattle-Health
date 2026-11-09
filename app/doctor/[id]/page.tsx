// P06 Profile / P11 Partial profile (Figma 226:58 / 226:366). One route; the screen branches on
// whether the doctor has a doctor-approved or illustrative personal profile.
import { notFound } from "next/navigation";
import { preconnect, preload } from "react-dom";
import { optimizablePortrait } from "@/src/ui/portrait-hosts";
import { doctorIdFromParam } from "@/src/data/doctor-slug";
import { getDoctor, mvpDiscipline } from "@/src/data/providers";
import { highlightsFor } from "@/src/data/highlights";
import type { Card } from "@/src/data/search-types";
import { DoctorPage as DoctorPageView } from "@/src/ui/screens/patient-b/DoctorPage";
import { doctorParams } from "./params";

export const revalidate = 3600;

export async function generateStaticParams() {
  return doctorParams();
}

function conditionLabelMap(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of mvpDiscipline().conditions) out[c.id] = c.label;
  return out;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await getDoctor(doctorIdFromParam(id));
  if (!d) return { title: "Doctor · Wattle" };
  const words = d.personal?.philosophyOfCare ?? d.personal?.philosophy ?? d.personal?.communicationApproach ?? null;
  const description = words ? `“${words.slice(0, 150)}${words.length > 150 ? "…" : ""}”` : `${d.name.display}, ${d.specialty.replace(/-/g, " ")} in ${d.rooms[0]?.suburb ?? "Australia"}, on Wattle.`;
  return {
    title: `${d.name.display} · Wattle`,
    description,
    openGraph: { title: d.name.display, description, ...(d.photo ? { images: [{ url: d.photo.url }] } : {}) },
  };
}

export default async function DoctorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await getDoctor(doctorIdFromParam(id));
  if (!d) notFound();
  // The portrait is the page's largest paint and lives on the practice's own origin. Without a hint the
  // browser only finds it after hydration (Lighthouse 2026-11-08: 2.6 s load delay on a 70 KB image that
  // transfers in 88 ms); preloading it from the static HTML starts the fetch with the document.
  // A listed host goes through the image optimizer, and next/image's `priority` writes its own preload.
  if (d.photo?.url && !optimizablePortrait(d.photo.url)) {
    preconnect(new URL(d.photo.url).origin);
    preload(d.photo.url, { as: "image", fetchPriority: "high" });
  }
  const labels = conditionLabelMap();
  const card: Card = { doctor: d, headline: "", score: 0, clinicalFit: { band: "listed", reasons: [] }, humanFit: { score: 0, reasons: [], basis: "none" }, evidence: [], missed: [], highlights: highlightsFor(d, undefined, labels) };
  return <DoctorPageView card={card} labels={labels} />;
}
