// Shared by every /api/decisions route: the access check and the error shape.
import { NextResponse } from "next/server";
import { requestAllowed } from "@/src/admin-session";
import { DecisionsUnavailable } from "./openai";

export async function denied(request: Request): Promise<Response | null> {
  return (await requestAllowed(request)) ? null : NextResponse.json({ error: "unauthorised: sign in at /admin or send Authorization: Bearer <DECISIONS_API_KEY>" }, { status: 401 });
}

export function failure(e: unknown): Response {
  const message = e instanceof Error ? e.message : "failed";
  return NextResponse.json({ error: message }, { status: e instanceof DecisionsUnavailable ? 503 : 400 });
}

export async function body<T>(request: Request): Promise<Partial<T>> {
  try {
    return (await request.json()) as Partial<T>;
  } catch {
    return {};
  }
}
