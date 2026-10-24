// GET → the review queue: pending first, most often raised first.
import { NextResponse } from "next/server";
import { listCandidates } from "@/src/decisions/engine";
import { denied } from "@/src/decisions/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const no = await denied(request);
  if (no) return no;
  const status = new URL(request.url).searchParams.get("status");
  const all = await listCandidates();
  return NextResponse.json(status ? all.filter((c) => c.status === status) : all);
}
