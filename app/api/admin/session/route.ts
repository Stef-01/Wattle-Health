// POST {password} signs in to /admin; DELETE signs out. The password is ADMIN_PASSWORD.
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminEnabled, passwordMatches, signSession } from "@/src/admin-session";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (!adminEnabled()) return NextResponse.json({ error: "Admin is off: set ADMIN_PASSWORD in the environment." }, { status: 503 });
  const { password } = (await request.json().catch(() => ({}))) as { password?: string };
  if (typeof password !== "string" || !passwordMatches(password)) {
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "That password isn’t right." }, { status: 401 });
  }
  const s = await signSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, s.value, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: s.maxAge });
  return res;
}

export async function DELETE(): Promise<Response> {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
