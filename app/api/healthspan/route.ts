// POST {areas, device, bloodwork, telehealth} → the three best healthspan doctors, each with the
// reasons it matched and the doctor's own sentence that shows this kind of work.
import { NextResponse } from "next/server";
import { DEVICES } from "@/src/data/healthspan";
import { matchHealthspan } from "@/src/data/healthspan-match";
import { getDoctors } from "@/src/data/providers";
import { currentMode } from "@/src/server/mode";

export async function POST(request: Request) {
  // Healthspan is not ADHD support: in ADHDme mode it does not exist (src/mode.ts).
  if ((await currentMode()) === "adhdme") return NextResponse.json({ matches: [], total: 0 }, { status: 404 });
  const b = (await request.json().catch(() => ({}))) as Partial<{ areas: string[]; device: string; bloodwork: boolean; telehealth: boolean }>;
  const device = DEVICES.find((d) => d.id === b.device)?.id ?? "none";
  const areas = Array.isArray(b.areas) ? b.areas.map(String).slice(0, 7) : [];
  const all = matchHealthspan(await getDoctors(), { areas, device, bloodwork: b.bloodwork === true, telehealth: b.telehealth === true });
  return NextResponse.json({ matches: all.slice(0, 3), total: all.length });
}
