// GET → the current tree, its rules in words, and which parameters it relies on.
import { NextResponse } from "next/server";
import { activeCategories, currentModel, labeller, scoredWithKey } from "@/src/decisions/engine";
import { denied } from "@/src/decisions/http";
import { rules } from "@/src/decisions/tree";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const no = await denied(request);
  if (no) return no;
  const model = await currentModel();
  if (!model) return NextResponse.json({ model: null });
  const categories = await activeCategories();
  return NextResponse.json({ model, rules: rules(model.root, labeller(categories)), stale: model.scoredWith !== scoredWithKey(categories) });
}
