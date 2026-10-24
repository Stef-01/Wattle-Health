// POST {transcript, discover?} → every category scored 0..1, the tree's decision, and the
// out-of-category candidates it queued. The transcript is in the body, never the URL or a log.
import { NextResponse } from "next/server";
import { classify } from "@/src/decisions/engine";
import { body, denied, failure } from "@/src/decisions/http";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request): Promise<Response> {
  const no = await denied(request);
  if (no) return no;
  const b = await body<{ transcript: string; discover: boolean }>(request);
  if (typeof b.transcript !== "string" || !b.transcript.trim()) return NextResponse.json({ error: "transcript required" }, { status: 400 });
  try {
    return NextResponse.json(await classify(b.transcript, { discover: b.discover !== false }));
  } catch (e) {
    return failure(e);
  }
}
