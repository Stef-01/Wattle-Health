// GET /api/gpt/search?sentence=…&suburb=… for a custom GPT Action (spec at /api/openapi.json).
import { NextResponse } from "next/server";
import { agentSearch } from "@/src/data/agent-search";

export async function GET(request: Request) {
  const u = new URL(request.url);
  const sentence = u.searchParams.get("sentence") ?? "";
  if (!sentence.trim()) return NextResponse.json({ error: "sentence required" }, { status: 400 });
  return NextResponse.json(await agentSearch(sentence, u.searchParams.get("suburb") ?? undefined));
}
