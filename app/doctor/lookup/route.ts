// GET /doctor/lookup?ids=a,b — the records behind the saved ids in wattle.saved.v1 (/saved).
import { NextResponse } from "next/server";
import { getDoctors } from "@/src/data/providers";
import { currentMode, scopeRoster } from "@/src/server/mode";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const ids = new URL(request.url).searchParams.get("ids") ?? "";
  const wanted = ids.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 50);
  if (wanted.length === 0) return NextResponse.json([]);
  // Saved doctors outside ADHD support do not come back in ADHDme mode; they return when the mode does.
  const doctors = scopeRoster(await getDoctors(), await currentMode());
  const byId = new Map(doctors.map((d) => [d.id, d]));
  return NextResponse.json(wanted.map((id) => byId.get(id)).filter((d) => d !== undefined));
}
