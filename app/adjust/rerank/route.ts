// POST /adjust/rerank. Reranks the Layer-1 survivors of a request with the person's "what matters
// most" choices; the rerank itself is rerankWith (src/data/rerank-core.ts), pure over the roster
// and the vocabulary read from disk here.
import { NextResponse } from "next/server";
import { getDoctors, mvpDiscipline } from "@/src/data/providers";
import { RerankBadRequest, rerankWith, type RerankBody } from "@/src/data/rerank-core";
import { currentMode, scopeRoster } from "@/src/server/mode";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  let body: RerankBody;
  try {
    body = (await request.json()) as RerankBody;
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  try {
    // The same pool the search used (search-core.ts): this mode's roster, without the providers ADHDme leaves out of its navigator.
    const pool = scopeRoster(await getDoctors(), await currentMode()).filter((d) => !d.adhdme?.evidenceUnclear);
    return NextResponse.json(rerankWith(pool, mvpDiscipline(), body));
  } catch (e) {
    if (e instanceof RerankBadRequest) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
