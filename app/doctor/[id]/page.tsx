// P06 Profile / P11 Partial profile (Figma 226:58 / 226:366). One route; the screen branches on
// whether the doctor has a doctor-approved or illustrative personal profile.
import { notFound } from "next/navigation";
import { doctorIdFromParam } from "@/src/data/doctor-slug";
import { getDoctor, mvpDiscipline } from "@/src/data/providers";
import { Profile } from "@/src/ui/screens/patient-b/Profile";
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
  const description = words ? `“${words.slice(0, 150)}${words.length > 150 ? "…" : ""}”` : `${d.name.display}, ${d.specialty.replace(/-/g, " ")} in Queensland, on Wattle.`;
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
  return <Profile doctor={d} labels={conditionLabelMap()} />;
}
