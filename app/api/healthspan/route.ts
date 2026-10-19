// POST {areas, device, bloodwork, telehealth} → the three best healthspan doctors, each with the
// reasons it matched and the doctor's own sentence that shows this kind of work.
import { NextResponse } from "next/server";
import { DEVICES } from "@/src/data/healthspan";
import { matchHealthspan } from "@/src/data/healthspan-match";
import { getDoctors } from "@/src/data/providers";

export async function POST(request: Request) {
  const b = (await request.json().catch(() => ({}))) as Partial<{ areas: string[]; device: string; bloodwork: boolean; telehealth: boolean }>;
  const device = DEVICES.find((d) => d.id === b.device)?.id ?? "none";
  const areas = Array.isArray(b.areas) ? b.areas.map(String).slice(0, 7) : [];
  const all = matchHealthspan(await getDoctors(), { areas, device, bloodwork: b.bloodwork === true, telehealth: b.telehealth === true });
  return NextResponse.json({ matches: all.slice(0, 3), total: all.length });
}
