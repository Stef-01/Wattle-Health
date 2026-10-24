// GET → the case studies the tree trains on. POST {title, text, decision, source?, sourceRef?} or
// an array of them: added, or updated in place when the title or source ref matches.
import { NextResponse } from "next/server";
import { addCases, listCases } from "@/src/decisions/engine";
import { denied, failure } from "@/src/decisions/http";
import type { CaseStudy } from "@/src/decisions/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const no = await denied(request);
  if (no) return no;
  return NextResponse.json(await listCases());
}

export async function POST(request: Request): Promise<Response> {
  const no = await denied(request);
  if (no) return no;
  const raw = (await request.json().catch(() => null)) as unknown;
  const items = (Array.isArray(raw) ? raw : raw ? [raw] : []) as { title?: string; text?: string; decision?: string; source?: CaseStudy["source"]; sourceRef?: string }[];
  const valid = items.filter((c) => typeof c.text === "string" && typeof c.decision === "string").map((c) => ({ title: c.title ?? "", text: c.text!, decision: c.decision!, ...(c.source ? { source: c.source } : {}), ...(c.sourceRef ? { sourceRef: c.sourceRef } : {}) }));
  if (!valid.length) return NextResponse.json({ error: "each case needs text and decision" }, { status: 400 });
  try {
    return NextResponse.json(await addCases(valid));
  } catch (e) {
    return failure(e);
  }
}
