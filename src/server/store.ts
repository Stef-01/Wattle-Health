// Server-only persistence for the clinician flow. Two backends with one shape:
//   - Supabase REST (PostgREST) with SUPABASE_SERVICE_ROLE_KEY, when the env var is set;
//   - an in-memory map otherwise (src/server/memory.ts), so the UI runs locally and in CI without a key.
// No SDK: plain fetch, as src/data/providers.ts does for the published_* views.
// Imported only from "use server" modules (src/server/clinician.ts); never from client code.

//   - "inbox": no service role key but the publishable key is present (production since 2026-11-08): each
//     step calls a security-definer function (`join_claim`, `join_practice`, `join_profile`, migration 0008)
//     that writes the same tables the service role would, every row unpublished until Wattle checks the
//     register; if a call fails the step is kept in `join_submissions` (migration 0007, insert-only) and the
//     screens continue on the in-memory store.
export type Backend = "supabase" | "inbox" | "memory";

export { memFind, memInsert, memSnapshot, memUpsert } from "./memory";

export function backend(): Backend {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return "memory";
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return "supabase";
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "inbox" : "memory";
}

/** Inbox mode: call one of the join_* functions with the publishable key; throws on a refusal so the caller can fall back. */
export async function publicRpc<T>(fn: "join_claim" | "join_practice" | "join_profile", args: Record<string, unknown>): Promise<T> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("no publishable key");
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${fn}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as T;
}

/** Inbox mode fallback: one insert-only POST per step with the publishable key. Never throws into the screen. */
export async function inboxPost(kind: "claim" | "practice" | "profile", payload: Record<string, unknown>): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return false;
  try {
    const res = await fetch(`${url}/rest/v1/join_submissions`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ kind, payload }),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

type Row = Record<string, unknown>;

/* ------------------------------------------------------------- Supabase */

function env() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service role env is not set");
  return { url: url.replace(/\/$/, ""), key };
}

async function rest<T>(path: string, init: RequestInit & { prefer?: string } = {}): Promise<T> {
  const { url, key } = env();
  const headers: Record<string, string> = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (init.prefer) headers.Prefer = init.prefer;
  const res = await fetch(`${url}/rest/v1/${path}`, { ...init, headers, cache: "no-store" });
  if (!res.ok) throw new Error(`supabase ${init.method ?? "GET"} ${path.split("?")[0]}: ${res.status} ${await res.text()}`);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** `select` returns rows; filters are PostgREST query strings (already encoded). */
export async function select<T extends Row>(table: string, query: string): Promise<T[]> {
  return rest<T[]>(`${table}?${query}`);
}

export async function insert<T extends Row>(table: string, row: Row): Promise<T> {
  const rows = await rest<T[]>(table, { method: "POST", body: JSON.stringify(row), prefer: "return=representation" });
  const first = rows[0];
  if (!first) throw new Error(`insert into ${table} returned no row`);
  return first;
}

/** Upsert on a unique column set: `onConflict` is the comma-separated column list. */
export async function upsert<T extends Row>(table: string, row: Row, onConflict: string): Promise<T> {
  const rows = await rest<T[]>(`${table}?on_conflict=${onConflict}`, {
    method: "POST",
    body: JSON.stringify(row),
    prefer: "return=representation,resolution=merge-duplicates",
  });
  const first = rows[0];
  if (!first) throw new Error(`upsert into ${table} returned no row`);
  return first;
}
