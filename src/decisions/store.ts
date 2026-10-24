// Server-only persistence for the decisions loop: one collection of JSON documents per kind
// (categories, candidates, cases, models, runs). Three backends, picked once per process:
//   supabase  SUPABASE_SERVICE_ROLE_KEY is set: table public.decision_docs (migration 0006)
//   file      local development: data/decisions/.local/store.json (gitignored; case studies stay off git)
//   memory    anywhere else (a Vercel deploy without the key): alive for the process only
// Plain fetch to PostgREST, as src/server/store.ts does. Never imported by client code.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export type DecisionsBackend = "supabase" | "file" | "memory";
export type Collection = "categories" | "candidates" | "cases" | "models" | "runs";

type Doc = { id: string };

const FILE = path.join(process.cwd(), "data", "decisions", ".local", "store.json");

export function decisionsBackend(): DecisionsBackend {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return "supabase";
  if (!process.env.VERCEL && process.env.DECISIONS_STORE !== "memory") return "file";
  return "memory";
}

/* ------------------------------------------------------------- memory and file */

let mem: Record<Collection, Record<string, Doc>> | null = null;

function loadMem(): Record<Collection, Record<string, Doc>> {
  if (mem) return mem;
  const empty = { categories: {}, candidates: {}, cases: {}, models: {}, runs: {} } as Record<Collection, Record<string, Doc>>;
  mem = empty;
  if (decisionsBackend() === "file" && existsSync(FILE)) {
    try {
      mem = { ...empty, ...(JSON.parse(readFileSync(FILE, "utf8")) as Record<Collection, Record<string, Doc>>) };
    } catch {
      mem = empty;
    }
  }
  return mem;
}

function flush(): void {
  if (decisionsBackend() !== "file" || !mem) return;
  mkdirSync(path.dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(mem, null, 1), "utf8");
}

/* ------------------------------------------------------------- supabase */

async function rest<T>(query: string, init: RequestInit & { prefer?: string } = {}): Promise<T> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const headers: Record<string, string> = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json" };
  if (init.prefer) headers.Prefer = init.prefer;
  const res = await fetch(`${url}/rest/v1/decision_docs${query}`, { ...init, headers, cache: "no-store" });
  if (!res.ok) throw new Error(`decision_docs ${init.method ?? "GET"}: ${res.status} ${await res.text()}`);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

const enc = encodeURIComponent;

/* ------------------------------------------------------------- the interface */

export async function list<T extends Doc>(collection: Collection): Promise<T[]> {
  if (decisionsBackend() === "supabase") {
    const rows = await rest<{ data: T }[]>(`?select=data&collection=eq.${enc(collection)}&order=updated_at.desc`);
    return rows.map((r) => r.data);
  }
  return Object.values(loadMem()[collection]) as T[];
}

export async function get<T extends Doc>(collection: Collection, id: string): Promise<T | null> {
  if (decisionsBackend() === "supabase") {
    const rows = await rest<{ data: T }[]>(`?select=data&collection=eq.${enc(collection)}&id=eq.${enc(id)}`);
    return rows[0]?.data ?? null;
  }
  return (loadMem()[collection][id] as T | undefined) ?? null;
}

export async function put<T extends Doc>(collection: Collection, doc: T): Promise<T> {
  if (decisionsBackend() === "supabase") {
    await rest(`?on_conflict=collection,id`, {
      method: "POST",
      body: JSON.stringify({ collection, id: doc.id, data: doc, updated_at: new Date().toISOString() }),
      prefer: "resolution=merge-duplicates,return=minimal",
    });
    return doc;
  }
  loadMem()[collection][doc.id] = doc;
  flush();
  return doc;
}

export async function remove(collection: Collection, id: string): Promise<void> {
  if (decisionsBackend() === "supabase") {
    await rest(`?collection=eq.${enc(collection)}&id=eq.${enc(id)}`, { method: "DELETE", prefer: "return=minimal" });
    return;
  }
  delete loadMem()[collection][id];
  flush();
}

export function newId(prefix: string): string {
  return `${prefix}_${globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}
