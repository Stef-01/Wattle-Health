// POST → re-score any case study scored under an older category set, then fit the tree.
import { NextResponse } from "next/server";
import { activeCategories, labeller, train } from "@/src/decisions/engine";
import { denied, failure } from "@/src/decisions/http";
import { rules } from "@/src/decisions/tree";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request): Promise<Response> {
  const no = await denied(request);
  if (no) return no;
  try {
    const model = await train();
    return NextResponse.json({ model, rules: rules(model.root, labeller(await activeCategories())) });
  } catch (e) {
    return failure(e);
  }
}
