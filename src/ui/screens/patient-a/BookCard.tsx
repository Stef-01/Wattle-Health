"use client";
// The right-hand booking card on laptop, after the Zocdoc provider page: title, a two-way
// in-person / video toggle, and the next fortnight as day tiles (days with openings in wattle gold,
// empty days grey). Openings are DEMO data and say so; booking is a call to the practice.
import { useEffect, useMemo, useState } from "react";
import { demoOpenings, type Opening } from "@/src/data/calendar";
import type { DoctorRecord } from "@/src/data/types";
import { primaryRoom } from "@/src/ui/screens/patient-b/facts";

const DAY = 86400000;

export function BookCard({ doctor: d, telehealthOnly, referral }: { doctor: DoctorRecord; telehealthOnly: boolean; referral: boolean }) {
  const tele = d.declared?.telehealth === true && d.telehealth?.value !== "none";
  const [mode, setMode] = useState<"in-person" | "telehealth">(telehealthOnly && tele ? "telehealth" : "in-person");
  const [all, setAll] = useState<Opening[] | null>(null);
  const [start, setStart] = useState(0);
  useEffect(() => setAll(demoOpenings(d.id, tele, Date.now(), 14)), [d.id, tele]);

  const days = useMemo(() => {
    if (!all) return [];
    const t0 = new Date();
    t0.setHours(0, 0, 0, 0);
    return Array.from({ length: 14 }, (_, i) => {
      const day = t0.getTime() + i * DAY;
      const slots = all.filter((o) => o.mode === mode && o.start >= day && o.start < day + DAY);
      return { day, slots };
    });
  }, [all, mode]);
  const view = days.slice(start, start + 7);
  const room = primaryRoom(d);
  const phone = room?.phone ?? d.booking?.phone ?? null;
  const site = d.booking?.url ?? room?.website ?? null;
  const firstSlot = days.flatMap((x) => x.slots)[0] ?? null;
  const fmt = (t: number, o: Intl.DateTimeFormatOptions) => new Date(t).toLocaleDateString("en-AU", o);

  return (
    <div className="rounded-[8px] bg-white px-8 py-8 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_8px_24px_rgba(0,0,0,0.06)]">
      <p role="heading" aria-level={3} className="text-[24px] font-semibold leading-tight tracking-[-0.015em] text-ink">Openings that fit</p>
      <p className="mt-1.5 text-[15px] leading-[1.5] text-[#4a4a4a]">Times that fit your calendar. Tap to book.</p>

      {tele ? (
        <div className="mt-6 grid grid-cols-2 overflow-hidden rounded-[6px] border border-ink">
          {(["in-person", "telehealth"] as const).map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={`press h-12 text-[16px] ${m === "telehealth" ? "border-l border-ink" : ""} ${mode === m ? "bg-[#f2f2f2] font-semibold text-ink" : "text-ink"}`}>
              {mode === m ? "✓ " : ""}{m === "in-person" ? "In person" : "Video visit"}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-7 flex items-center justify-between">
        <p className="text-[16px] font-semibold text-ink">{view[0] ? `${fmt(view[0].day, { weekday: "short", day: "numeric", month: "short" })} – ${fmt(view.at(-1)!.day, { weekday: "short", day: "numeric", month: "short" })}` : "Checking…"}</p>
        <span className="flex gap-1">
          <button type="button" aria-label="Earlier days" disabled={start === 0} onClick={() => setStart(0)} className="press inline-flex size-8 items-center justify-center text-[18px] text-ink disabled:opacity-30">‹</button>
          <button type="button" aria-label="Later days" disabled={start === 7} onClick={() => setStart(7)} className="press inline-flex size-8 items-center justify-center text-[18px] text-ink disabled:opacity-30">›</button>
        </span>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1.5">
        {view.map(({ day, slots }) => {
          const on = slots.length > 0;
          return (
            <div key={day} title={on ? slots.map((o) => new Date(o.start).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })).join(", ") : undefined} className={`rounded-[4px] px-1.5 py-2 text-[13px] leading-[1.35] ${on ? "bg-[#f6d84a] text-ink" : "bg-[#efefef] text-[#9a9a9a]"}`}>
              <span className="block font-semibold">{fmt(day, { weekday: "short" })}</span>
              <span className="block">{fmt(day, { day: "numeric", month: "short" })}</span>
              <span className="mt-2 block">{on ? `${slots.length} ${slots.length === 1 ? "time" : "times"}` : "None"}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-6">
        {referral ? <p className="mb-2 text-[14px] text-[#4a4a4a]">You’ll need a GP referral first.</p> : null}
        {firstSlot ? (
          <NextFree doctor={d} when={nextFreeLabel(firstSlot.start)} mode={firstSlot.mode} referral={false} />
        ) : phone ? (
          <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="press flex h-12 w-full items-center justify-center rounded-[6px] bg-ink text-[16px] font-semibold text-white">Call {phone}</a>
        ) : site ? (
          <a href={site} target="_blank" rel="noreferrer" className="press flex h-12 w-full items-center justify-center rounded-[6px] bg-ink text-[16px] font-semibold text-white">Book on their website</a>
        ) : null}
      </div>
    </div>
  );
}

/** "Tue 21 Oct at 10:00 am" */
export function nextFreeLabel(t: number): string {
  const d = new Date(t);
  return `${d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })} at ${d.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })}`;
}

/** The bottom-of-page action: the next free time, which rings the practice to book it (demo times). */
export function NextFree({ doctor: d, when, mode, referral }: { doctor: DoctorRecord; when: string; mode: string | null; referral: boolean }) {
  const room = primaryRoom(d);
  const phone = room?.phone ?? d.booking?.phone ?? null;
  const site = d.booking?.url ?? room?.website ?? null;
  const href = phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : site ?? undefined;
  return (
    <div>
      {referral ? <p className="mb-2 text-[14px] text-[#4a4a4a]">You’ll need a GP referral first.</p> : null}
      <a href={href} target={phone ? undefined : "_blank"} rel="noreferrer" className="press flex w-full flex-col items-center justify-center rounded-[6px] bg-ink px-4 py-3.5 text-center text-white">
        <span className="text-[17px] font-semibold">Next free {when}</span>
        <span className="mt-0.5 text-[13px] text-white/75">{[mode === "telehealth" ? "Telehealth" : "In person", phone ? `call ${phone} to book` : "book on their site"].join(" · ")}</span>
      </a>
    </div>
  );
}
