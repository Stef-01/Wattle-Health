"use client";
// Calendar connection, styled like a real app connector (founder 2026-10-19: "make calendar
// functionality look real"). Pick Google, Apple or Outlook; a permission sheet shows exactly what
// Wattle gets (free/busy only, never titles, people or notes); Allow connects. Provider OAuth is not
// wired yet, so a provider connection reads a representative week; the .ics file and private iCal
// link under "Other ways" read the person's real calendar today.
import { useRef, useState } from "react";
import { demoBusy, parseIcs } from "@/src/data/calendar";
import { Sheet } from "@/src/ui/kit";
import { Orb } from "@/src/ui/kit/Orb";
import { setOpeningsState, type OpeningsState } from "@/src/ui/openings";

export const PROVIDERS = {
  google: { name: "Google Calendar", account: "Google account" },
  apple: { name: "Apple Calendar", account: "iCloud" },
  outlook: { name: "Outlook Calendar", account: "Microsoft account" },
} as const;
type Provider = keyof typeof PROVIDERS;

export function ProviderIcon({ id, size = 36 }: { id: string; size?: number }) {
  if (id === "google")
    return (
      <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden="true">
        <rect x="2" y="2" width="32" height="32" rx="7" fill="#fff" stroke="#e3e3e3" />
        <path d="M2 9a7 7 0 0 1 7-7h18a7 7 0 0 1 7 7v2H2z" fill="#4285f4" />
        <text x="18" y="28" textAnchor="middle" fontSize="13" fontWeight="700" fill="#4285f4" fontFamily="Arial, sans-serif">31</text>
      </svg>
    );
  if (id === "apple")
    return (
      <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden="true">
        <rect x="2" y="2" width="32" height="32" rx="7" fill="#fff" stroke="#e3e3e3" />
        <text x="18" y="13" textAnchor="middle" fontSize="7" fontWeight="700" fill="#ff3b30" fontFamily="-apple-system, Arial, sans-serif">MON</text>
        <text x="18" y="29" textAnchor="middle" fontSize="15" fill="#1b1b1b" fontFamily="-apple-system, Arial, sans-serif">20</text>
      </svg>
    );
  if (id === "outlook")
    return (
      <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden="true">
        <rect x="2" y="2" width="32" height="32" rx="7" fill="#0f6cbd" />
        <rect x="8" y="10" width="13" height="16" rx="2" fill="#fff" />
        <circle cx="14.5" cy="18" r="3.6" fill="none" stroke="#0f6cbd" strokeWidth="2" />
        <path d="M22 13h7v10h-7" fill="none" stroke="#fff" strokeWidth="1.6" />
      </svg>
    );
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden="true">
      <rect x="2" y="2" width="32" height="32" rx="7" fill="#f4f4f4" stroke="#e3e3e3" />
      <path d="M11 14h14M11 19h14M11 24h9" stroke="#1b1b1b" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function CalendarConnect({ state, onChange }: { state: OpeningsState | null; onChange: () => void }) {
  const [asking, setAsking] = useState<Provider | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [other, setOther] = useState(false);
  const [link, setLink] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const cal = state?.calendar;

  function save(source: string, label: string, busyBlocks: { start: number; end: number }[]) {
    setOpeningsState({ calendar: { source: source as never, label, busy: busyBlocks, at: Date.now() } });
    setErr("");
    onChange();
  }

  function allow() {
    if (!asking) return;
    setConnecting(true);
    window.setTimeout(() => {
      save(asking, PROVIDERS[asking].name, demoBusy(Date.now()));
      setConnecting(false);
      setAsking(null);
    }, 1400);
  }

  async function fromLink() {
    setBusy(true);
    const res = await fetch("/api/calendar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: link }) }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { ics?: string; error?: string } | null;
    setBusy(false);
    if (!res?.ok || !data?.ics) return setErr(data?.error ?? "Couldn't read that calendar.");
    const now = Date.now();
    save("ics-link", new URL(link.replace(/^webcal:/, "https:")).hostname.replace(/^www\./, ""), parseIcs(data.ics).filter((b) => b.end > now && b.start < now + 21 * 86400000));
    setLink("");
  }

  return (
    <section className="mt-6">
      {cal ? (
        <div className="flex items-center gap-3 py-2">
          <ProviderIcon id={cal.source} size={32} />
          <p className="flex-1 text-[16px] font-medium text-ink">{cal.label}</p>
          <span className="mr-2 inline-flex items-center gap-1.5 text-[14px] text-[#6b6b6b]"><span className="size-1.5 rounded-full bg-ink" />Connected</span>
          <button type="button" aria-label="Disconnect" onClick={() => { setOpeningsState({ calendar: null }); onChange(); }} className="press-dim p-1"><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M1 1l10 10M11 1 1 11" stroke="#9a9a9a" strokeWidth="1.6" strokeLinecap="round" /></svg></button>
        </div>
      ) : (
        <>
          <p className="text-[17px] font-semibold text-ink">Connect a calendar</p>
          <div className="mt-1 flex flex-col">
            {(Object.keys(PROVIDERS) as Provider[]).map((p) => (
              <button key={p} type="button" onClick={() => setAsking(p)} className="press-soft flex items-center gap-3 py-2.5 text-left">
                <ProviderIcon id={p} size={32} />
                <span className="flex-1 text-[16px] text-ink">{PROVIDERS[p].name.replace(" Calendar", "")}</span>
                <svg width="8" height="14" viewBox="0 0 8 14" aria-hidden="true"><path d="M1 1l6 6-6 6" fill="none" stroke="#c4c4c4" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            ))}
            <button type="button" onClick={() => setOther((v) => !v)} className="press-dim self-start py-2 text-[14px] text-[#9a9a9a]">{other ? "Hide" : "Use a link or .ics"}</button>
          </div>
          {other ? (
            <div className="mt-1 flex gap-2">
              <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="iCal link" className="field min-w-0 flex-1 rounded-full bg-[#f4f4f4] px-4 py-2.5 text-[15px] outline-none" />
              <button type="button" disabled={!link || busy} onClick={() => void fromLink()} className="press rounded-full bg-ink px-4 text-[15px] text-white disabled:opacity-30">{busy ? "…" : "Add"}</button>
              <button type="button" aria-label="Upload .ics" onClick={() => file.current?.click()} className="press rounded-full bg-[#f4f4f4] px-4 text-[15px] text-ink">.ics</button>
              <input ref={file} type="file" accept=".ics,text/calendar" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const now = Date.now(); save("ics-file", f.name, parseIcs(await f.text()).filter((b) => b.end > now && b.start < now + 21 * 86400000)); } }} />
            </div>
          ) : null}
          {err ? <p className="mt-2 text-[14px] text-danger">{err}</p> : null}
        </>
      )}

      <Sheet open={asking !== null} onClose={() => (connecting ? null : setAsking(null))} title="">
        {asking ? (
          <div className="flex flex-col items-center gap-4 pb-2 text-center">
            <ProviderIcon id={asking} size={64} />
            <p className="text-[20px] font-semibold text-ink">{PROVIDERS[asking].name}</p>
            <p className="text-[15px] text-[#6b6b6b]">Free and busy times only.</p>
            <button type="button" disabled={connecting} onClick={allow} className="press mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink text-[16px] font-semibold text-white">{connecting ? <><Orb size={18} className="invert" /> Connecting</> : "Connect"}</button>
          </div>
        ) : null}
      </Sheet>
    </section>
  );
}
