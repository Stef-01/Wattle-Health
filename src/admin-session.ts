// Admin sign-in (2026-10-24). One shared password (ADMIN_PASSWORD) opens /admin; a signed,
// httpOnly cookie keeps the session for 12 hours. External tools use DECISIONS_API_KEY as a
// bearer token instead. Web Crypto only, so the middleware (edge) and the API routes (node)
// verify the same way. No password set: the dashboard stays shut, and says how to open it.
export const ADMIN_COOKIE = "wattle.admin";
const TTL_SECONDS = 12 * 60 * 60;

const te = new TextEncoder();

function secret(): string | null {
  return process.env.ADMIN_SESSION_SECRET?.trim() || process.env.ADMIN_PASSWORD?.trim() || null;
}

export function adminEnabled(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD?.trim());
}

async function hmac(key: string, message: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", te.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, te.encode(message)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Same length and same bytes, in time that does not depend on where they differ. */
export function sameText(a: string, b: string): boolean {
  const x = te.encode(a);
  const y = te.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export function passwordMatches(input: string): boolean {
  const pw = process.env.ADMIN_PASSWORD?.trim();
  return Boolean(pw) && sameText(input, pw!);
}

export async function signSession(now = Date.now()): Promise<{ value: string; maxAge: number }> {
  const s = secret();
  if (!s) throw new Error("ADMIN_PASSWORD is not set");
  const exp = Math.floor(now / 1000) + TTL_SECONDS;
  return { value: `${exp}.${await hmac(s, `admin|${exp}`)}`, maxAge: TTL_SECONDS };
}

export async function verifySession(value: string | undefined | null, now = Date.now()): Promise<boolean> {
  const s = secret();
  if (!s || !value) return false;
  const [exp, sig] = value.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) * 1000 < now) return false;
  return sameText(sig, await hmac(s, `admin|${exp}`));
}

function cookieFrom(header: string | null, name: string): string | null {
  const hit = (header ?? "").split(/;\s*/).find((c) => c.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
}

/** An API request is allowed when it carries the API key, or a valid admin session cookie. */
export async function requestAllowed(request: Request): Promise<boolean> {
  const key = process.env.DECISIONS_API_KEY?.trim();
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (key && bearer && sameText(bearer, key)) return true;
  return verifySession(cookieFrom(request.headers.get("cookie"), ADMIN_COOKIE));
}
