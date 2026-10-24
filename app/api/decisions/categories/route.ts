// GET → every category the classifier can output: the yaml vocabulary plus reviewed ones.
import { NextResponse } from "next/server";
import { allCategories, categoriesHash } from "@/src/decisions/engine";
import { denied } from "@/src/decisions/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const no = await denied(request);
  if (no) return no;
  const categories = await allCategories();
  return NextResponse.json({ hash: categoriesHash(categories.filter((c) => c.active)), categories });
}
