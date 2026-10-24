// POST {notes} → draft case studies pulled from meeting notes (Granola or pasted). Drafts only:
// a person checks them, then saves them through POST /api/decisions/cases.
import { NextResponse } from "next/server";
import { extractCases } from "@/src/decisions/engine";
import { body, denied, failure } from "@/src/decisions/http";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request): Promise<Response> {
  const no = await denied(request);
  if (no) return no;
  const b = await body<{ notes: string }>(request);
  if (typeof b.notes !== "string" || !b.notes.trim()) return NextResponse.json({ error: "notes required" }, { status: 400 });
  try {
    return NextResponse.json({ cases: await extractCases(b.notes) });
  } catch (e) {
    return failure(e);
  }
}
