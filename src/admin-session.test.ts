import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ADMIN_COOKIE, passwordMatches, requestAllowed, sameText, signSession, verifySession } from "./admin-session";

describe("admin session", () => {
  beforeEach(() => {
    process.env.ADMIN_PASSWORD = "correct horse";
    process.env.DECISIONS_API_KEY = "key-123";
  });
  afterEach(() => {
    delete process.env.ADMIN_PASSWORD;
    delete process.env.DECISIONS_API_KEY;
  });

  it("signs a session that verifies, and expires", async () => {
    const s = await signSession(1_000_000_000_000);
    expect(await verifySession(s.value, 1_000_000_000_000)).toBe(true);
    expect(await verifySession(s.value, 1_000_000_000_000 + 13 * 3600 * 1000)).toBe(false);
  });

  it("rejects a forged or tampered cookie", async () => {
    const s = await signSession();
    const [exp] = s.value.split(".");
    expect(await verifySession(`${Number(exp) + 9999}.${s.value.split(".")[1]}`)).toBe(false);
    expect(await verifySession("9999999999.deadbeef")).toBe(false);
    process.env.ADMIN_PASSWORD = "another password";
    expect(await verifySession(s.value)).toBe(false);
  });

  it("stays shut with no password set", async () => {
    delete process.env.ADMIN_PASSWORD;
    expect(passwordMatches("")).toBe(false);
    expect(await verifySession("1.2")).toBe(false);
  });

  it("lets a request in with the API key or a session, and nothing else", async () => {
    const s = await signSession();
    const req = (h: Record<string, string>) => new Request("https://x.test/api/decisions/categories", { headers: h });
    expect(await requestAllowed(req({ authorization: "Bearer key-123" }))).toBe(true);
    expect(await requestAllowed(req({ cookie: `${ADMIN_COOKIE}=${s.value}` }))).toBe(true);
    expect(await requestAllowed(req({ authorization: "Bearer nope" }))).toBe(false);
    expect(await requestAllowed(req({}))).toBe(false);
    expect(sameText("a", "ab")).toBe(false);
  });
});
