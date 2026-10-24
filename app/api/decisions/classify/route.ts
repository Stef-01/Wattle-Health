// POST {transcript, discover?, redact?} → every category scored 0..1, the tree's decision, and the
// out-of-category candidates it queued. The transcript is in the body, never the URL or a log, and
// is redacted before it leaves (src/decisions/redact.ts). `redact: false` is the redaction eval's
// baseline and needs the API key, not an /admin session.
import { NextResponse } from "next/server";
import { classify } from "@/src/decisions/engine";
import { body, denied, failure } from "@/src/decisions/http";

function bearer(request: Request): boolean {
  const key = process.env.DECISIONS_API_KEY?.trim();
  return Boolean(key) && request.headers.get("authorization") === `Bearer ${key}`;
}

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request): Promise<Response> {
  const no = await denied(request);
  if (no) return no;
  const b = await body<{ transcript: string; discover: boolean; redact: boolean }>(request);
  if (typeof b.transcript !== "string" || !b.transcript.trim()) return NextResponse.json({ error: "transcript required" }, { status: 400 });
  try {
    return NextResponse.json(await classify(b.transcript, { discover: b.discover !== false, redact: b.redact === false && bearer(request) ? false : true }));
  } catch (e) {
    return failure(e);
  }
}
