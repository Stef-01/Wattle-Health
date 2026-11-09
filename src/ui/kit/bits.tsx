"use client";
// Primitives added 2026-10-16 for the v3 results and profile: an initials avatar (no photos are
// held), small chips, a labelled section, and a disclosure that opens in place (Apple: show the
// common path first, one level deeper on request; Emil: transitions, never keyframes).
import type { ReactNode } from "react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight } from "./icons";
import { lockScroll, unlockScroll } from "./scroll-lock";
import { initialsFor, tintFor } from "./tint";
import { optimizablePortrait } from "@/src/ui/portrait-hosts";
export { initialsFor, tintFor } from "./tint";

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

export function Avatar({ name, size = 56, tone = "soft" }: { name: string; size?: number; tone?: "soft" | "ink" }) {
  const [bg, fg] = tintFor(name);
  return (
    <span
      aria-hidden="true"
      className={cx("inline-flex shrink-0 items-center justify-center rounded-full font-display", tone === "ink" && "bg-ink text-white")}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36), ...(tone === "soft" ? { background: bg, color: fg } : {}) }}
    >
      {initialsFor(name)}
    </span>
  );
}

/** Small chip (32 high): a condition, a hobby, a practical fact. `tone` marks the matched ones. */
export function Chip({ children, tone = "soft" }: { children: ReactNode; tone?: "soft" | "match" | "line" | "text" }) {
  if (tone === "text") return <span className="text-body leading-read text-ink [&:not(:last-child)]:after:mx-2 [&:not(:last-child)]:after:text-grey [&:not(:last-child)]:after:content-['·']">{children}</span>;
  return (
    <span
      className={cx(
        "inline-flex h-8 items-center whitespace-nowrap rounded-full px-3 text-subhead leading-none",
        tone === "match" && "bg-accent-soft text-accent",
        tone === "soft" && "bg-surface text-ink",
        tone === "line" && "border border-hairline text-grey",
      )}
    >
      {children}
    </span>
  );
}

export function Chips({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("flex flex-wrap gap-2", className)}>{children}</div>;
}

/** Labelled section: a Title 3 heading, then the content (Maps place-card sections). */
export function Labelled({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <section className={cx("flex flex-col gap-2.5", className)}>
      <h2 className="text-title3 text-ink">{label}</h2>
      {children}
    </section>
  );
}

/** Text clipped to a few lines. "More" opens the whole passage and, when given, `more` content beneath it. */
export function Clamp({ text, lines = 3, className, more }: { text: string; lines?: number; className?: string; more?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const long = text.length > lines * 52 || Boolean(more);
  return (
    <div className="flex flex-col gap-3">
      <p className={cx("", className ?? "text-body leading-read text-ink")}>
        <span className={!open && long ? "line-clamp-3" : undefined} style={!open && long ? { WebkitLineClamp: lines } : undefined}>
          {text}
        </span>
        {long ? (
          <button type="button" onClick={() => setOpen((v) => !v)} className="press-dim ml-1 text-body text-accent">
            {open ? "Less" : "More"}
          </button>
        ) : null}
      </p>
      {open && more ? <div className="rise flex flex-col gap-3">{more}</div> : null}
    </div>
  );
}

/** A row that opens its content in place; the chevron turns. With `tint` it sits in a grouped panel.
 *  Apple pass: the four near-identical panel tints are one grouped grey; grouping is by background. */
export const PANEL_TINTS = { research: "var(--color-grouped)", practical: "var(--color-grouped)", why: "var(--color-grouped)", sources: "var(--color-grouped)" } as const;

export function Disclosure({ title, sub, children, defaultOpen = false, tint }: { title: ReactNode; sub?: ReactNode; children: ReactNode; defaultOpen?: boolean; tint?: keyof typeof PANEL_TINTS }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cx(tint ? "mb-2 rounded-card px-4" : "border-b-[length:var(--hairline)] border-hairline")} style={tint ? { background: PANEL_TINTS[tint] } : undefined}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="press-soft chrome flex min-h-[52px] w-full items-center gap-3 py-3 text-left">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-body text-ink">{title}</span>
          {sub ? <span className="text-footnote text-grey">{sub}</span> : null}
        </span>
        <ChevronRight size={16} strokeWidth={2.25} className={cx("shrink-0 text-grey-3 transition-transform duration-(--duration-base) motion-reduce:transition-none", open && "rotate-90")} style={{ transitionTimingFunction: "var(--ease-out)" }} />
      </button>
      <div className="grid transition-[grid-template-rows] duration-(--duration-slow) motion-reduce:transition-none" style={{ gridTemplateRows: open ? "1fr" : "0fr", transitionTimingFunction: "var(--ease-out)" }}>
        <div className="min-h-0 overflow-hidden">{open ? <div className="rise pb-4">{children}</div> : null}</div>
      </div>
    </div>
  );
}

/** A compact two-state toggle pill for an inline filter. */
export function TogglePill({ on, onChange, children }: { on: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className={cx("press chrome hit inline-flex h-9 items-center whitespace-nowrap rounded-full px-4 text-subhead", on ? "bg-ink text-white" : "bg-surface text-ink")}>
      {children}
    </button>
  );
}

/** A small face goes through the image optimizer when its host is listed (data/portrait-hosts.json): Home's five
 *  36 px faces were pulling the practices' originals, one of them 2.2 MB, and on a 1.6 Mbps link the fonts (the
 *  LCP on every text page) queued behind them until 4 s (observed Lighthouse, 2026-11-08). Widths are from
 *  Next's default imageSizes; the rest keep the plain URL. */
const faceSrc = (url: string, size: number) => (optimizablePortrait(url) ? `/_next/image?url=${encodeURIComponent(url)}&w=${[64, 96, 128, 256].find((w) => w >= size * 2) ?? 384}&q=70` : url);

/** A round portrait that falls back to the person's initials on their tint when the photo is missing
 *  or fails to load (Apple never shows a broken-image glyph). `ring` separates overlapping faces. */
export function Face({ url, name = "", size = 36, ring = false, className }: { url?: string | null; name?: string; size?: number; ring?: boolean; className?: string }) {
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  // A server-rendered image can fail before hydration, when React's onError is not yet attached.
  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, [url]);
  const [bg, fg] = tintFor(name || "?");
  const box = cx("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full", ring && "ring-2 ring-white", className);
  if (!url || failed) {
    return (
      <span aria-hidden="true" className={box} style={{ width: size, height: size, background: bg, color: fg, fontSize: Math.round(size * 0.36), fontWeight: 600 }}>
        {name ? (ring && size <= 36 ? initialsFor(name).slice(0, 1) : initialsFor(name)) : null}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={img} src={faceSrc(url, size)} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} className={cx(box, "object-cover object-top")} style={{ width: size, height: size, background: "var(--color-shimmer)" }} />
  );
}

/** Up to three overlapping portraits for a recent-search or saved row. */
export function FaceStack({ urls, names = [], size = 30 }: { urls: string[]; names?: string[]; size?: number }) {
  if (urls.length === 0) return null;
  return (
    <span className="flex shrink-0 -space-x-2" style={{ minWidth: size + (size - 8) * 2 }}>
      {urls.slice(0, 3).map((u, i) => (
        <Face key={`${u}-${i}`} url={u} name={names[i] ?? ""} size={size} ring />
      ))}
    </span>
  );
}

/** iOS switch. A tap flips it; the knob also drags (gestures skill, 2026-11-08): it tracks the finger 1:1 across
 *  its 20 px of travel, rubber-bands past either end, and settles by position (past the middle) or by the direction
 *  of a quick flick. Keyboard (Space, Enter) goes through the click. The track colour is derived from the knob's
 *  position during the drag so the two never drift. Vertical pans stay with the page (`touch-pan-y`). */
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  const TRAVEL = 20;
  const knob = useRef<HTMLSpanElement>(null);
  const track = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ id: number; x0: number; moved: boolean; lastX: number; lastT: number; v: number } | null>(null);
  const skipClick = useRef(false);
  const settle = (next: boolean) => {
    const k = knob.current, t = track.current;
    if (k) { k.style.transition = ""; k.style.transform = next ? `translateX(${TRAVEL}px)` : "none"; }
    if (t) { t.style.transition = ""; t.style.backgroundColor = ""; }
  };
  const down = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    skipClick.current = false;
    drag.current = { id: e.pointerId, x0: e.clientX, moved: false, lastX: e.clientX, lastT: performance.now(), v: 0 };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* a synthetic event (QA) has no active pointer */ }
  };
  const move = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current, k = knob.current, t = track.current;
    if (!d || e.pointerId !== d.id || !k || !t) return;
    const dx = e.clientX - d.x0;
    if (!d.moved) { if (Math.abs(dx) < 3) return; d.moved = true; k.style.transition = "none"; t.style.transition = "none"; }
    const now = performance.now();
    if (now - d.lastT > 0) d.v = 0.6 * d.v + 0.4 * ((e.clientX - d.lastX) / (now - d.lastT));
    d.lastX = e.clientX; d.lastT = now;
    const raw = (on ? TRAVEL : 0) + dx;
    const x = raw < 0 ? raw * 0.2 : raw > TRAVEL ? TRAVEL + (raw - TRAVEL) * 0.2 : raw;
    k.style.transform = `translateX(${x}px)`;
    t.style.backgroundColor = `color-mix(in srgb, var(--color-switch) ${Math.round(Math.min(1, Math.max(0, x / TRAVEL)) * 100)}%, var(--color-surface-strong))`;
  };
  const up = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    if (!d.moved) return; // a tap: the click that follows flips it
    skipClick.current = e.type === "pointerup"; // a cancelled pointer (the page scrolled) fires no click
    const v = performance.now() - d.lastT > 80 ? 0 : d.v;
    const next = Math.abs(v) > 0.3 ? v > 0 : (on ? TRAVEL : 0) + e.clientX - d.x0 > TRAVEL / 2;
    settle(next);
    if (next !== on) onChange(next);
  };
  const click = () => {
    if (skipClick.current) { skipClick.current = false; return; }
    onChange(!on);
  };
  return (
    <button ref={track} type="button" role="switch" aria-checked={on} aria-label={label} onClick={click} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} className={cx("hit chrome relative inline-flex h-[31px] w-[51px] shrink-0 touch-pan-y items-center rounded-full transition-colors duration-(--duration-base)", on ? "bg-switch" : "bg-surface-strong")}>
      <span ref={knob} aria-hidden="true" className="absolute left-[2px] size-[27px] rounded-full bg-white shadow-knob transition-transform duration-(--duration-base) motion-reduce:transition-none" style={{ transform: on ? `translateX(${TRAVEL}px)` : "none", transitionTimingFunction: "var(--ease-out)" }} />
    </button>
  );
}

/** Renders children at the end of <body>, so fixed overlays escape transformed (animated) ancestors. */
export function Portal({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready ? createPortal(children, document.body) : null;
}

/** Bottom sheet over the frame: grabber, centred inline title, a glass close circle (iOS 26). */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  // Stay mounted for the exit so the sheet leaves the way it came (down), instead of vanishing.
  const [shown, setShown] = useState(open);
  const [last, setLast] = useState<ReactNode>(children);
  const panel = useRef<HTMLDivElement>(null); // moves: the transform lives here and nowhere else
  const body = useRef<HTMLDivElement>(null); // scrolls: the one scroll container inside the panel
  const scrim = useRef<HTMLButtonElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (open) { setShown(true); return; }
    const t = window.setTimeout(() => setShown(false), 320);
    return () => window.clearTimeout(t);
  }, [open]);
  useEffect(() => { if (open) setLast(children); }, [open, children]);
  // Apple's modal behaviour (REA, docs/apple/REA.md): the page behind stays still, Escape and the browser's
  // back close the sheet, focus moves into it and returns to the control that opened it; Tab stays inside.
  useEffect(() => {
    if (!open || !shown) return;
    const el = panel.current;
    const scroller = body.current;
    const opener = document.activeElement as HTMLElement | null;
    lockScroll(scroller);
    el?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close.current(); return; }
      if (e.key !== "Tab" || !el) return;
      const items = [...el.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      if (items.length === 0) return;
      const first = items[0]!, lastItem = items[items.length - 1]!;
      if (e.shiftKey && (document.activeElement === first || document.activeElement === el)) { e.preventDefault(); lastItem.focus(); }
      else if (!e.shiftKey && document.activeElement === lastItem) { e.preventDefault(); first.focus(); }
    };
    const onPop = () => close.current();
    window.addEventListener("keydown", onKey);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", onPop);
      unlockScroll(scroller);
      opener?.focus?.({ preventScroll: true });
    };
  }, [open, shown]);
  // The gesture (gestures skill, emilkowalski/skills, 2026-11-08). Two phases: while the finger is down the panel
  // IS the finger (direct transform writes, no state per move, transition off); on release physics finishes it.
  //  - Starts from the grabber row at once, or from the content once it has moved 6 px down with the body scrolled
  //    to the top (Vaul's rule); a move up or a scrolled body is a scroll, not a drag. Controls never start one.
  //  - Catches the panel mid-flight: pointer-down during the entrance or a dismissal reads the current transform
  //    and continues from there, so the user can grab a closing sheet and pull it back (interruptibility).
  //  - Above the top it rubber-bands at a fifth of the distance; the scrim's opacity is derived from the same
  //    drag distance so the two never drift.
  //  - Dismisses past 25 % of the height or on a release faster than 0.4 px/ms (the last ~80 ms, not the average
  //    over the gesture); the exit carries that speed, a hard fling leaves faster than a slow pull. Otherwise it
  //    snaps back quickly on the iOS drawer curve; no overshoot anywhere (the design system's motion rule).
  //  - onClose fires when the exit finishes, not when the finger lifts, which is what makes the catch possible.
  type Drag = { id: number; y0: number; base: number; lastY: number; lastT: number; v: number; armed: boolean };
  const drag = useRef<Drag | null>(null);
  const leaving = useRef<number | null>(null);
  const reduce = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const currentY = (el: HTMLElement) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m42;
  const arm = (d: Drag, target: HTMLElement, pointerId: number) => {
    const el = panel.current;
    if (!el) return;
    if (leaving.current !== null) { window.clearTimeout(leaving.current); leaving.current = null; }
    d.base = Math.max(0, currentY(el));
    d.armed = true;
    try { target.setPointerCapture(pointerId); } catch { /* a synthetic event (QA) has no active pointer */ }
    el.style.transition = "none";
    el.style.transform = `translateY(${d.base}px)`;
    if (scrim.current) { scrim.current.style.transition = "none"; scrim.current.style.opacity = String(Math.max(0, 1 - d.base / el.offsetHeight)); }
  };
  const onDown = (e: React.PointerEvent<HTMLDivElement>, handle: boolean) => {
    if (e.button !== 0 || drag.current) return;
    if ((e.target as Element).closest("button, a, input, textarea, select, [role=switch], [data-no-drag]")) return;
    const t = performance.now();
    const d: Drag = { id: e.pointerId, y0: e.clientY, base: 0, lastY: e.clientY, lastT: t, v: 0, armed: false };
    drag.current = d;
    if (handle) arm(d, e.currentTarget, e.pointerId);
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = panel.current;
    if (!d || !el || e.pointerId !== d.id) return;
    const raw = e.clientY - d.y0;
    if (!d.armed) {
      if ((body.current?.scrollTop ?? 0) > 0 || raw < -4) { drag.current = null; return; }
      if (raw < 6) return;
      arm(d, e.currentTarget, e.pointerId);
    }
    const t = performance.now();
    if (t - d.lastT > 0) d.v = 0.6 * d.v + 0.4 * ((e.clientY - d.lastY) / (t - d.lastT));
    d.lastY = e.clientY; d.lastT = t;
    const y = d.base + raw;
    const dy = y >= 0 ? y : y * 0.2;
    el.style.transform = `translateY(${dy}px)`;
    if (scrim.current) scrim.current.style.opacity = String(Math.max(0, 1 - Math.max(0, dy) / el.offsetHeight));
  };
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = panel.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    if (!d.armed || !el) return;
    const h = el.offsetHeight;
    const dy = Math.max(0, d.base + e.clientY - d.y0);
    const stale = performance.now() - d.lastT > 80; // the finger stopped before lifting: no fling
    const v = stale ? 0 : d.v;
    const quick = reduce();
    if (dy > h * 0.25 || (dy > 10 && v > 0.4)) {
      // Leave at the speed of the release: the remaining distance over the velocity, within 120 to 220 ms.
      const ms = quick ? 150 : Math.round(Math.min(220, Math.max(120, (h - dy) / Math.max(v, 2.5))));
      el.style.transition = `transform ${ms}ms var(--ease-out)`;
      el.style.transform = "translateY(100%)";
      if (scrim.current) { scrim.current.style.transition = `opacity ${ms}ms ease`; scrim.current.style.opacity = "0"; }
      leaving.current = window.setTimeout(() => { leaving.current = null; close.current(); }, ms);
    } else {
      el.style.transition = `transform var(${quick ? "--duration-fast" : "--duration-slow"}) var(--ease-drawer)`;
      el.style.transform = "translateY(0)";
      if (scrim.current) { scrim.current.style.transition = ""; scrim.current.style.opacity = ""; }
    }
  };
  if (!open && !shown) return null;
  return (
    <Portal>
    <div className={cx("frame-fixed inset-y-0 z-50", !open && "sheet-closing pointer-events-none")} role="dialog" aria-modal="true" aria-label={title}>
      <button ref={scrim} type="button" aria-label="Close" tabIndex={-1} onClick={onClose} className="sheet-scrim absolute inset-0 bg-black/30" />
      <div ref={panel} tabIndex={-1} className="sheet-panel frame-pad absolute inset-x-0 bottom-0 flex max-h-[92dvh] touch-none flex-col rounded-t-sheet bg-white pt-[5px] outline-none">
        <div className="chrome -mx-4 flex touch-none cursor-grab flex-col gap-1 px-4 pb-4 active:cursor-grabbing" onPointerDown={(e) => onDown(e, true)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <span aria-hidden="true" className="mx-auto h-[5px] w-9 shrink-0 rounded-full bg-grabber" />
          <div className="grid grid-cols-[44px_1fr_44px] items-center gap-2">
            <span />
            <h2 className="truncate text-center text-headline text-ink">{title}</h2>
            <button type="button" aria-label="Close" onClick={onClose} className="press inline-flex size-11 items-center justify-center rounded-full bg-surface text-ink">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M2 2l10 10M12 2 2 12" /></svg>
            </button>
          </div>
        </div>
        <div ref={body} className="sheet-body -mx-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4" style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }} onPointerDown={(e) => onDown(e, false)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          {open ? children : last}
        </div>
      </div>
    </div>
    </Portal>
  );
}
