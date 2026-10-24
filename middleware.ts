// ?mode=adhdme / ?mode=wattle on any page sets the mode cookie (src/mode.ts), so a link can open the
// app in ADHDme mode. The parameter is dropped from the URL once the cookie is set.
import { NextResponse, type NextRequest } from "next/server";
import { hiddenIn, MODE_COOKIE, defaultMode, parseMode } from "@/src/mode";
import { ADMIN_COOKIE, verifySession } from "@/src/admin-session";

export async function middleware(request: NextRequest) {
  const url = request.nextUrl;
  // /admin is behind ADMIN_PASSWORD (src/admin-session.ts); the API routes check for themselves.
  if (url.pathname.startsWith("/admin") && url.pathname !== "/admin/login" && !(await verifySession(request.cookies.get(ADMIN_COOKIE)?.value))) {
    const login = url.clone();
    login.pathname = "/admin/login";
    login.search = `?next=${encodeURIComponent(url.pathname)}`;
    return NextResponse.redirect(login);
  }
  const asked = parseMode(url.searchParams.get("mode"));
  const mode = asked ?? parseMode(request.cookies.get(MODE_COOKIE)?.value) ?? defaultMode();
  // A surface that is not about ADHD support does not exist in ADHDme mode.
  if (hiddenIn(mode, url.pathname)) {
    const home = url.clone();
    home.pathname = url.pathname.startsWith("/me") ? "/me" : "/";
    home.search = "";
    const res = NextResponse.redirect(home);
    if (asked) res.cookies.set(MODE_COOKIE, asked, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    return res;
  }
  if (!asked) return NextResponse.next();
  const clean = url.clone();
  clean.searchParams.delete("mode");
  const res = NextResponse.redirect(clean);
  res.cookies.set(MODE_COOKIE, asked, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return res;
}

export const config = { matcher: ["/((?!api|_next|.*\\..*).*)"] };
