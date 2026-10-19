// POST /api/match. The sentence travels in the body, never the URL, and is not logged.
import { NextResponse } from "next/server";
import { runSearch, type SearchRequest } from "@/src/data/search";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  let body: Partial<SearchRequest>;
  try {
    body = (await request.json()) as Partial<SearchRequest>;
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (typeof body.sentence !== "string" || !body.sentence.trim()) {
    return NextResponse.json({ error: "sentence required" }, { status: 400 });
  }
  const req: SearchRequest = { sentence: body.sentence };
  if (typeof body.suburb === "string") req.suburb = body.suburb;
  if (body.weights && typeof body.weights === "object") req.weights = body.weights;
  if (Array.isArray(body.removed)) req.removed = body.removed.filter((r): r is string => typeof r === "string");
  if (Array.isArray(body.exclude)) req.exclude = body.exclude.filter((r): r is string => typeof r === "string").slice(0, 6);
  return NextResponse.json(await runSearch(req));
}
