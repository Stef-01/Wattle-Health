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

  const synced = cal ? Math.max(1, Math.round((Date.now() - cal.at) / 60000)) : 0;

  return (
    <section className="mt-6 rounded-[8px] border border-hairline">
      {cal ? (
        <div className="flex items-center gap-3 px-4 py-4">
          <ProviderIcon id={cal.source} />
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-semibold text-ink">{cal.label}</p>
            <p className="text-[14px] text-[#6b6b6b]"><span className="mr-1 inline-block size-2 rounded-full bg-[#34c759] align-middle" />Connected · free/busy only · synced {synced < 2 ? "just now" : `${synced} min ago`}</p>
          </div>
          <button type="button" onClick={() => { setOpeningsState({ calendar: null }); onChange(); }} className="press-dim text-[14px] text-accent">Disconnect</button>
        </div>
      ) : (
        <div className="px-4 py-4">
          <p className="text-[16px] font-semibold text-ink">Connect your calendar</p>
          <p className="mt-0.5 text-[14px] leading-[1.45] text-[#6b6b6b]">So we only suggest times you’re free.</p>
          <div className="mt-3 flex flex-col divide-y divide-hairline">
            {(Object.keys(PROVIDERS) as Provider[]).map((p) => (
              <button key={p} type="button" onClick={() => setAsking(p)} className="press-soft flex items-center gap-3 py-3 text-left">
                <ProviderIcon id={p} size={32} />
                <span className="flex-1 text-[16px] text-ink">{PROVIDERS[p].name}</span>
                <span className="rounded-[6px] border border-ink px-3 py-1.5 text-[14px] font-medium text-ink">Connect</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="border-t border-hairline px-4 py-3">
        <button type="button" onClick={() => setOther((v) => !v)} className="press-dim text-[14px] text-[#4a4a4a]">{other ? "Hide other ways" : "Other ways to connect"}</button>
        {other ? (
          <div className="mt-3 flex flex-col gap-3">
            <button type="button" onClick={() => file.current?.click()} className="press rounded-[6px] border border-hairline px-4 py-3 text-left text-[15px] text-ink">Upload an .ics file <span className="block text-[13px] text-grey">Exported from any calendar app</span></button>
            <input ref={file} type="file" accept=".ics,text/calendar" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const now = Date.now(); save("ics-file", f.name, parseIcs(await f.text()).filter((b) => b.end > now && b.start < now + 21 * 86400000)); } }} />
            <div className="flex gap-2">
              <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Private iCal link" className="field min-w-0 flex-1 rounded-[6px] border border-hairline px-4 py-3 text-[15px] outline-none" />
              <button type="button" disabled={!link || busy} onClick={() => void fromLink()} className="press rounded-[6px] bg-ink px-4 text-[15px] text-white disabled:opacity-40">{busy ? "Reading" : "Add"}</button>
            </div>
            {err ? <p className="text-[14px] text-danger">{err}</p> : null}
          </div>
        ) : null}
      </div>

      <Sheet open={asking !== null} onClose={() => (connecting ? null : setAsking(null))} title={asking ? `Connect ${PROVIDERS[asking].name}` : ""}>
        {asking ? (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-center gap-4 py-2">
              <span className="inline-flex size-14 items-center justify-center rounded-[14px] bg-[#f4f4f4]"><Orb size={36} /></span>
              <svg width="40" height="12" viewBox="0 0 40 12" aria-hidden="true"><path d="M2 6h36M32 1l6 5-6 5M8 1 2 6l6 5" fill="none" stroke="#9a9a9a" strokeWidth="1.5" /></svg>
              <ProviderIcon id={asking} size={56} />
            </div>
            <p className="text-center text-[17px] leading-[1.45] text-ink"><span className="font-semibold">Wattle</span> wants to access your {PROVIDERS[asking].account}</p>
            <ul className="flex flex-col gap-3 rounded-[8px] bg-[#f7f7f7] px-4 py-4 text-[15px] leading-[1.45]">
              <li className="flex gap-3"><span aria-hidden="true" className="text-[#1b1b1b]">✓</span><span className="text-ink">See when you’re busy or free in the next three weeks</span></li>
              <li className="flex gap-3"><span aria-hidden="true" className="text-[#9a9a9a]">✕</span><span className="text-[#6b6b6b]">Can’t see event titles, people, locations or notes</span></li>
              <li className="flex gap-3"><span aria-hidden="true" className="text-[#9a9a9a]">✕</span><span className="text-[#6b6b6b]">Can’t create, change or delete events</span></li>
            </ul>
            <p className="text-[13px] leading-[1.45] text-[#6b6b6b]">Busy times stay on this device. Disconnect any time in Openings.</p>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" disabled={connecting} onClick={() => setAsking(null)} className="press h-12 rounded-[6px] border border-ink text-[16px] font-medium text-ink disabled:opacity-40">Cancel</button>
              <button type="button" disabled={connecting} onClick={allow} className="press inline-flex h-12 items-center justify-center gap-2 rounded-[6px] bg-ink text-[16px] font-semibold text-white">{connecting ? <><Orb size={20} className="invert" /> Connecting</> : "Allow"}</button>
            </div>
          </div>
        ) : null}
      </Sheet>
    </section>
  );
}
