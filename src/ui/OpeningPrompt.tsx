"use client";
import { track } from "@vercel/analytics";
import { Brand } from "@/src/ui/brand";
// The proactive prompt (founder 2026-10-19): "an appointment for X has just opened up, you are free,
// would you like to book a follow-up?" Shown as a notification-style card when a saved doctor you're
// watching has a new time that fits your calendar. Book → a confirmation and it lands in Openings as
// booked; Not now → it won't ask about that time again.
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { checkOpenings, getOpeningsState, notifyFresh, promptDue, pushOn, setOpeningsState, savedDoctorIds, type FitOpening } from "./openings";
import { nextFreeLabel } from "./screens/patient-a/BookCard";
import { Orb } from "./kit/Orb";
import { celebrate } from "./celebrate";
import { Face } from "./kit";

export function OpeningPrompt() {
  const path = usePathname();
  const [o, setO] = useState<FitOpening | null>(null);
  const [state, setState] = useState<"ask" | "booking" | "booked">("ask");
  const [leaving, setLeaving] = useState(false);
  // The card the gesture moves and the drag in progress (refs, not state: nothing re-renders per move). Declared here,
  // above the early return: a hook after `if (!o) return null` is React error 310 once the prompt appears.
  const card = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; y0: number; base: number; lastY: number; lastT: number; v: number } | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  useEffect(() => {
    if (path?.startsWith("/team") || path?.startsWith("/narrow")) return;
    let alive = true;
    const run = async () => {
      if (!savedDoctorIds().length) return;
      const s = getOpeningsState();
      // Never before a calendar is connected (founder 2026-10-20).
      if (!s.calendar) return;
      // Arriving from a tapped push notification: show that opening to book.
      const tapped = new URLSearchParams(window.location.search).get("opening");
      if (!tapped) {
        // Push on: the alert goes to the home screen, never an in-app pop-up.
        if (pushOn(s)) return void notifyFresh();
        // Push off: in-app, at most once every three days.
        if (!promptDue(s)) return;
      }
      const { fit } = await checkOpenings().catch(() => ({ fit: [] as FitOpening[] }));
      const skip = new Set([...(s.dismissed ?? []), ...(s.booked ?? []).map((b) => b.id)]);
      const first = tapped ? fit.find((x) => x.id === tapped) ?? fit.find((x) => !skip.has(x.id)) : fit.find((x) => !skip.has(x.id));
      if (alive && first) {
        setOpeningsState({ lastPromptAt: Date.now() });
        setO(first);
        setState("ask");
      }
    };
    const t = window.setTimeout(run, 2500);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [path]);

  if (!o) return null;
  const name = o.doctor.name.display;
  const when = nextFreeLabel(o.start);
  // Leave upward, the edge it arrived from, then unmount.
  const close = () => { setLeaving(true); window.setTimeout(() => { setO(null); setLeaving(false); }, 240); };

  function notNow() {
    const s = getOpeningsState();
    setOpeningsState({ dismissed: [...(s.dismissed ?? []), o!.id] });
    close();
  }
  function book() {
    setState("booking");
    track("followup_booked");
    window.setTimeout(() => {
      const s = getOpeningsState();
      setOpeningsState({ booked: [...(s.booked ?? []), { id: o!.id, doctorId: o!.doctorId, start: o!.start, mode: o!.mode }] });
      setState("booked");
      celebrate(20);
    }, 1200);
  }

  // Swipe up to dismiss (gestures skill, 2026-11-08): the card arrived from the top edge, so it leaves the same way.
  // While the finger is down it tracks 1:1 upward and rubber-bands downward, fading with its own travel; on release
  // it goes past a third of its height or on a flick, carrying the release speed, else snaps back. The gesture means
  // "not now" while asking, "done" once booked, nothing while booking. The entrance is a transition (`toast-in`), not
  // a keyframe, so a finger can catch the card mid-arrival and continue from where it is.
  const fade = (el: HTMLElement, y: number) => String(Math.max(0, 1 + Math.min(0, y) / (el.offsetHeight + 16)));
  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = card.current;
    if (e.button !== 0 || !el || state === "booking" || leaving || (e.target as Element).closest("button, a")) return;
    const base = Math.min(0, new DOMMatrixReadOnly(getComputedStyle(el).transform).m42);
    drag.current = { id: e.pointerId, y0: e.clientY, base, lastY: e.clientY, lastT: performance.now(), v: 0 };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* a synthetic event (QA) has no active pointer */ }
    el.style.transition = "none";
    el.style.transform = `translateY(${base}px)`;
    el.style.opacity = fade(el, base);
  };
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current, el = card.current;
    if (!d || !el || e.pointerId !== d.id) return;
    const now = performance.now();
    if (now - d.lastT > 0) d.v = 0.6 * d.v + 0.4 * ((e.clientY - d.lastY) / (now - d.lastT));
    d.lastY = e.clientY; d.lastT = now;
    const y = d.base + e.clientY - d.y0;
    const dy = y <= 0 ? y : y * 0.2;
    el.style.transform = `translateY(${dy}px)`;
    el.style.opacity = fade(el, dy);
  };
  const up = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current, el = card.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    if (!el) return;
    const h = el.offsetHeight + 16;
    const y = Math.min(0, d.base + e.clientY - d.y0);
    const v = performance.now() - d.lastT > 80 ? 0 : d.v;
    if (-y > h / 3 || (-y > 8 && v < -0.4)) {
      const ms = Math.round(Math.min(220, Math.max(120, (h + y) / Math.max(-v, 2.5))));
      el.style.transition = `transform ${ms}ms var(--ease-out), opacity ${ms}ms ease`;
      el.style.transform = `translateY(${-h}px)`;
      el.style.opacity = "0";
      const done = state === "booked" ? close : notNow;
      window.setTimeout(done, ms);
    } else {
      el.style.transition = "transform var(--duration-slow) var(--ease-drawer), opacity var(--duration-base) ease";
      el.style.transform = "translateY(0)";
      el.style.opacity = "1";
    }
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex justify-center px-3">
      <div ref={card} role="dialog" aria-label="Appointment opening" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} className={`${leaving ? "toast-out" : "toast-in"} glass chrome pointer-events-auto w-full max-w-[400px] touch-none rounded-card p-4`}>
        <div className="flex items-center gap-2 text-footnote text-grey">
          <span className="inline-flex size-5 items-center justify-center rounded-icon bg-surface-soft"><Orb size={14} /></span>
          <span><Brand /></span>
          <span className="ml-auto">now</span>
        </div>
        {state === "booked" ? (
          <div className="rise mt-2">
            <p className="flex items-center gap-2 text-body font-semibold text-ink"><svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" className="tick shrink-0"><circle cx="11" cy="11" r="11" fill="var(--color-ink)" /><path d="M6.5 11.5l3 3 6-6.5" fill="none" stroke="var(--color-cell)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>Booked with {name}</p>
            <p className="mt-0.5 text-subhead leading-read text-grey">{when}{o.mode === "telehealth" ? ", by video" : ""}. It’s in your calendar and in Openings.</p>
            <button type="button" onClick={close} className="press mt-3 h-11 w-full rounded-full bg-surface text-subhead font-semibold text-ink">Done</button>
          </div>
        ) : (
          <div className="mt-2 flex gap-3">
            <Face url={o.doctor.photo?.url} name={o.doctor.name.display} size={44} />
            <div className="min-w-0 flex-1">
              <p className="text-body font-semibold text-ink">{name} has an opening</p>
              <p className="mt-0.5 text-subhead leading-read text-grey">{when}. You’re free. Book a follow-up?</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={notNow} disabled={state === "booking"} className="press h-11 rounded-full bg-surface text-subhead font-semibold text-ink">Not now</button>
                <button type="button" onClick={book} disabled={state === "booking"} className="press inline-flex h-11 items-center justify-center gap-2 rounded-full bg-ink text-subhead font-semibold text-white">{state === "booking" ? "Booking…" : "Book follow-up"}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
