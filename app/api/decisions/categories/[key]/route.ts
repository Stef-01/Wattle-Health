// PATCH {label?, description?, active?} on a reviewed category. Vocabulary categories are edited in disciplines/mvp.yaml.
import { NextResponse } from "next/server";
import { updateCategory } from "@/src/decisions/engine";
import { body, denied, failure } from "@/src/decisions/http";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ key: string }> }): Promise<Response> {
  const no = await denied(request);
  if (no) return no;
  const { key } = await params;
  try {
    return NextResponse.json(await updateCategory(decodeURIComponent(key), await body<{ label: string; description: string; active: boolean }>(request)));
  } catch (e) {
    return failure(e);
  }
}
