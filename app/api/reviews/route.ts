// Verified patient reviews. GET ?doctor=<id> returns approved reviews and a summary; POST stores a
// new review as 'pending' (row-level security only accepts pending inserts and only returns approved
// rows; see supabase/migrations/0005_patient_reviews.sql). Without Supabase env it runs in memory.
import { NextResponse } from "next/server";

type Review = { id: string; doctor_id: string; rating: number; body: string; visited: string; created_at: string };
const VISITED = new Set(["this-month", "this-year", "earlier"]);
const memory: (Review & { status: "pending" | "approved" })[] = [];

function env(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

function summarise(rows: Review[]) {
  const count = rows.length;
  const average = count ? Math.round((rows.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : null;
  return { count, average, highlyRecommended: count >= 3 && (average ?? 0) >= 4.5 };
}

export async function GET(request: Request) {
  const doctor = new URL(request.url).searchParams.get("doctor")?.slice(0, 200);
  if (!doctor) return NextResponse.json({ error: "doctor required" }, { status: 400 });
  const e = env();
  let rows: Review[] = [];
  if (e) {
    const res = await fetch(`${e.url}/rest/v1/published_reviews?doctor_id=eq.${encodeURIComponent(doctor)}&order=created_at.desc&limit=50`, {
      headers: { apikey: e.key, Authorization: `Bearer ${e.key}` },
      cache: "no-store",
    });
    if (res.ok) rows = (await res.json()) as Review[];
  } else {
    rows = memory.filter((r) => r.doctor_id === doctor && r.status === "approved");
  }
  return NextResponse.json({ reviews: rows, ...summarise(rows), mode: e ? "live" : "local" });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Partial<{ doctorId: string; rating: number; body: string; visited: string; sawDoctor: boolean }> | null;
  const text = typeof body?.body === "string" ? body.body.trim() : "";
  const rating = Number(body?.rating);
  if (!body?.doctorId || !Number.isInteger(rating) || rating < 1 || rating > 5 || text.length < 20 || text.length > 1000 || !VISITED.has(String(body.visited)) || body.sawDoctor !== true) {
    return NextResponse.json({ error: "A rating, 20 to 1000 characters, when you visited, and confirmation that you saw this doctor are required." }, { status: 400 });
  }
  const row = { doctor_id: body.doctorId.slice(0, 200), rating, body: text, visited: String(body.visited), saw_doctor: true };
  const e = env();
  if (e) {
    const res = await fetch(`${e.url}/rest/v1/reviews`, {
      method: "POST",
      headers: { apikey: e.key, Authorization: `Bearer ${e.key}`, "content-type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(row),
    });
    if (!res.ok) return NextResponse.json({ error: "Could not save the review just now." }, { status: 502 });
  } else {
    memory.push({ ...row, id: crypto.randomUUID(), created_at: new Date().toISOString(), status: "pending" });
  }
  return NextResponse.json({ ok: true, status: "pending" });
}
