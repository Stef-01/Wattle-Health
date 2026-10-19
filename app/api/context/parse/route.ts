// POST { text } → the health-context items Wattle can use. Deterministic and lexical: no model call,
// nothing stored on the server. The text stays on the person's device after this returns.
import { NextResponse } from "next/server";
import { mvpDiscipline } from "@/src/data/providers";
import { contextItems } from "@/src/data/search-core";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text : "";
  if (!text.trim()) return NextResponse.json({ items: [] });
  return NextResponse.json({ items: contextItems(text, mvpDiscipline()) }, { headers: { "cache-control": "no-store" } });
}
