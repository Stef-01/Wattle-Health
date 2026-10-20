"use client";
import { CalendarConnect } from "./CalendarConnect";
// Me › Openings (2026-10-18, demo MVP). Watches the doctors you saved, reads when you're free from
// your calendar, and shows the openings that fit, soonest first, with a notification when a new one
// appears. Openings are DEMO data (real practice availability is a later stage) and say so.
import { useEffect, useRef, useState } from "react";
import { icsFor, parseIcs, WINDOWS, type Window } from "@/src/data/calendar";
import type { DoctorRecord } from "@/src/data/types";
import { ArrowLeft, Check, Circle, Screen, Toggle } from "@/src/ui/kit";
import { checkOpenings, getOpeningsState, setOpeningsState, type FitOpening, type OpeningsState } from "@/src/ui/openings";
import { drName, placeOf, primaryRoom } from "./facts";

const dayKey = (t: number) => new Date(t).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });
const timeOf = (t: number) => new Date(t).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });

function download(o: FitOpening) {
  const room = primaryRoom(o.doctor);
  const where = o.mode === "telehealth" ? "Telehealth" : [room?.name, room?.address, room?.suburb].filter(Boolean).join(", ");
  const blob = new Blob([icsFor(o, `${drName(o.doctor)} (hold, call to book)`, where)], { type: "text/calendar" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "wattle-opening.ics";
  a.click();
  URL.revokeObjectURL(a.href);
}

export function Openings() {
  const [s, setS] = useState<OpeningsState | null>(null);
  const [fit, setFit] = useState<FitOpening[] | null>(null);
  const [doctors, setDoctors] = useState<DoctorRecord[]>([]);
  const [newIds, setNewIds] = useState<string[]>([]);
  const [link, setLink] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  async function refresh() {
    const st = getOpeningsState();
    setS(st);
    const r = await checkOpenings();
    setFit(r.fit);
    setDoctors(r.doctors);
    setNewIds(r.fresh.map((o) => o.id));
    setOpeningsState({ seen: [...new Set([...st.seen, ...r.fit.map((o) => o.id)])] });
  }
  useEffect(() => {
    void refresh();
  }, []);

  function connect(source: "ics-file" | "ics-link" | "demo", label: string, text?: string) {
    const now = Date.now();
    const parsed = text ? parseIcs(text).filter((b) => b.end > now && b.start < now + 21 * 86400000) : [];
    setOpeningsState({ calendar: source === "demo" ? null : { source, label, busy: parsed, at: now } });
    setErr("");
    void refresh();
  }

  async function fromLink() {
    setBusy(true);
    const res = await fetch("/api/calendar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: link }) }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { ics?: string; error?: string } | null;
    setBusy(false);
    if (!res?.ok || !data?.ics) return setErr(data?.error ?? "Couldn't read that calendar.");
    connect("ics-link", new URL(link.replace(/^webcal:/, "https:")).hostname.replace(/^www\./, ""), data.ics);
    setLink("");
  }

  async function setNotify(on: boolean) {
    if (on && typeof Notification !== "undefined" && Notification.permission !== "granted") {
      const p = await Notification.requestPermission();
      if (p !== "granted") return setErr("Notifications are blocked for this site in your browser settings.");
    }
    setS(setOpeningsState({ notify: on }));
  }

  function toggleWindow(w: Window) {
    const cur = s?.windows ?? [];
    const next = cur.includes(w) ? cur.filter((x) => x !== w) : [...cur, w];
    setOpeningsState({ windows: next });
    void refresh();
  }

  const days = new Map<string, FitOpening[]>();
  for (const o of fit ?? []) days.set(dayKey(o.start), [...(days.get(dayKey(o.start)) ?? []), o]);
  const cal = s?.calendar;

  return (
    <Screen padBottom="pb-[120px]">
      <div className="flex h-11 items-center gap-4">
        <Circle href="/me" label="Back"><ArrowLeft size={20} /></Circle>
        <h1 className="display text-[22px] text-ink">Openings</h1>
      </div>
      <p className="mt-5 text-[16px] leading-[1.5] text-charcoal">Times that fit your calendar, from doctors you saved.</p>

      <CalendarConnect state={s} onChange={() => void refresh()} />

      <div className="mt-5">
        <p className="text-[17px] font-semibold text-ink">When suits you</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(WINDOWS) as Window[]).map((w) => {
            const on = s?.windows.includes(w) ?? true;
            return (
              <button key={w} type="button" aria-pressed={on} onClick={() => toggleWindow(w)} className={`press rounded-full px-4 py-2 text-[15px] ${on ? "bg-ink text-white" : "bg-[#f4f4f4] text-[#6b6b6b]"}`}>
                {WINDOWS[w].label.split(",")[0]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <span className="text-[17px] font-semibold text-ink">Notify me</span>
        <Toggle on={s?.notify ?? false} onChange={(v) => void setNotify(v)} label="Notify me about new openings" />
      </div>
      {err ? <p className="mt-2 text-[14px] text-danger">{err}</p> : null}

      <h2 className="mt-8 text-[22px] text-ink">{fit === null ? "Checking…" : fit.length ? `${fit.length} ${fit.length === 1 ? "time fits" : "times fit"} your next two weeks` : doctors.length ? "Nothing fits yet" : "Save a doctor to watch them"}</h2>
      {fit && fit.length === 0 ? (
        <p className="mt-2 text-[15px] leading-[1.5] text-grey">{doctors.length ? "Turn on more times above to see more." : "Tap the heart on a pick to see their openings here."}</p>
      ) : null}
      {doctors.length ? <p className="mt-1 text-[14px] text-grey">Watching {doctors.map((d) => drName(d)).join(", ")}</p> : null}

      <div className="mt-5 flex flex-col gap-6">
        {[...days.entries()].map(([day, list]) => (
          <section key={day}>
            <h3 className="text-[15px] text-ink">{day}</h3>
            <div className="mt-2 flex flex-col gap-3">
              {list.map((o) => {
                const room = primaryRoom(o.doctor);
                const phone = room?.phone ?? o.doctor.booking?.phone ?? null;
                return (
                  <article key={o.id} className="rise flex gap-4 rounded-[8px] border border-hairline p-3">
                    {o.doctor.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={o.doctor.photo.url} alt="" referrerPolicy="no-referrer" className="size-14 shrink-0 rounded-full object-cover object-top" />
                    ) : <span className="size-14 shrink-0 rounded-full bg-[#f4f4f4]" />}
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-x-2 text-[17px] text-ink">
                        <span className="whitespace-nowrap font-semibold">{timeOf(o.start)}</span>
                        <span className="truncate text-[13px] text-grey">{o.mode === "telehealth" ? "Telehealth" : placeOf(o.doctor)}</span>
                        {newIds.includes(o.id) ? <span className="rounded-full bg-[#1b1b1b] px-2 py-0.5 text-[12px] text-white">New</span> : null}
                      </p>
                      <p className="truncate text-[15px] text-charcoal">{drName(o.doctor)}</p>
                      <div className="mt-1.5 flex gap-4 text-[14px]">
                        {phone ? <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="text-accent">Call to book</a> : null}
                        <button type="button" onClick={() => download(o)} className="text-accent">Add to calendar</button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </Screen>
  );
}

