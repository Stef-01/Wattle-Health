// GET ?ids=a,b → the public records of up to 20 doctors (used by Openings for saved doctors).
import { NextResponse } from "next/server";
import { getDoctor } from "@/src/data/providers";

export async function GET(request: Request) {
  const ids = (new URL(request.url).searchParams.get("ids") ?? "").split(",").map((s) => s.trim().slice(0, 200)).filter(Boolean).slice(0, 20);
  const doctors = (await Promise.all(ids.map((id) => getDoctor(id)))).filter(Boolean);
  return NextResponse.json({ doctors });
}
