// POST {url} → just the event times from a private iCal link (Google "Secret address in iCal format", Apple
// public calendar, Outlook published calendar). Only those hosts, https only, 2 MB cap, so this is
// not an open proxy. The link and events are not stored; the browser keeps only start/end times.
import { NextResponse } from "next/server";

const HOSTS = [/^calendar\.google\.com$/, /^p\d+-caldav\.icloud\.com$/, /^outlook\.(office365|live)\.com$/, /^outlook\.office\.com$/];

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { url?: string } | null;
  let url: URL;
  try {
    url = new URL(String(body?.url ?? "").trim().replace(/^webcal:/, "https:"));
  } catch {
    return NextResponse.json({ error: "That doesn't look like a calendar link." }, { status: 400 });
  }
  if (url.protocol !== "https:" || !HOSTS.some((h) => h.test(url.hostname))) {
    return NextResponse.json({ error: "Use a Google, Apple (iCloud) or Outlook calendar link, or upload an .ics file." }, { status: 400 });
  }
  const res = await fetch(url, { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!res?.ok) return NextResponse.json({ error: "Couldn't read that calendar. Check the link is the private iCal one." }, { status: 502 });
  const text = (await res.text()).slice(0, 2_000_000);
  if (!text.includes("BEGIN:VCALENDAR")) return NextResponse.json({ error: "That link isn't an iCal calendar." }, { status: 400 });
  // Only the lines needed for busy time go back; titles, attendees and notes never leave this function.
  const keep = text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/).filter((l) => /^(BEGIN|END):VEVENT|^DTSTART|^DTEND|^TRANSP/.test(l));
  return NextResponse.json({ ics: keep.join("\n") });
}
