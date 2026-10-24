import { NextResponse } from "next/server";
import { removeCase } from "@/src/decisions/engine";
import { denied } from "@/src/decisions/http";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const no = await denied(request);
  if (no) return no;
  await removeCase((await params).id);
  return NextResponse.json({ ok: true });
}
