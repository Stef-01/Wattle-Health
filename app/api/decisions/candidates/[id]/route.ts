// PATCH {action: "approve" | "reject" | "update", label?, description?, group?}. The human
// validation step, for /admin and for an external validator alike: approve turns the candidate
// into a category the classifier outputs from the next transcript on.
import { NextResponse } from "next/server";
import { reviewCandidate } from "@/src/decisions/engine";
import { body, denied, failure } from "@/src/decisions/http";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const no = await denied(request);
  if (no) return no;
  const { id } = await params;
  const b = await body<{ action: "approve" | "reject" | "update"; label: string; description: string; group: string }>(request);
  if (b.action !== "approve" && b.action !== "reject" && b.action !== "update") return NextResponse.json({ error: "action must be approve, reject or update" }, { status: 400 });
  try {
    return NextResponse.json(await reviewCandidate(id, { action: b.action, ...(b.label !== undefined ? { label: b.label } : {}), ...(b.description !== undefined ? { description: b.description } : {}), ...(b.group !== undefined ? { group: b.group } : {}) }));
  } catch (e) {
    return failure(e);
  }
}
