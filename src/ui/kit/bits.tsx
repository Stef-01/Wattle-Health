"use client";
// Primitives added 2026-10-16 for the v3 results and profile: an initials avatar (no photos are
// held), small chips, a labelled section, and a disclosure that opens in place (Apple: show the
// common path first, one level deeper on request; Emil: transitions, never keyframes).
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight } from "./icons";
import { initialsFor, tintFor } from "./tint";
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
export const PANEL_TINTS = { research: "#f2f2f7", practical: "#f2f2f7", why: "#f2f2f7", sources: "#f2f2f7" } as const;

export function Disclosure({ title, sub, children, defaultOpen = false, tint }: { title: ReactNode; sub?: ReactNode; children: ReactNode; defaultOpen?: boolean; tint?: keyof typeof PANEL_TINTS }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cx(tint ? "mb-2 rounded-card px-4" : "border-b-[length:var(--hairline)] border-hairline")} style={tint ? { background: PANEL_TINTS[tint] } : undefined}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="press-soft flex min-h-[52px] w-full items-center gap-3 py-3 text-left">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-body text-ink">{title}</span>
          {sub ? <span className="text-footnote text-grey">{sub}</span> : null}
        </span>
        <ChevronRight size={16} strokeWidth={2.25} className={cx("shrink-0 text-grey-3 transition-transform duration-200", open && "rotate-90")} style={{ transitionTimingFunction: "var(--ease-out)" }} />
      </button>
      <div className="grid transition-[grid-template-rows] duration-300" style={{ gridTemplateRows: open ? "1fr" : "0fr", transitionTimingFunction: "var(--ease-out)" }}>
        <div className="min-h-0 overflow-hidden">{open ? <div className="rise pb-4">{children}</div> : null}</div>
      </div>
    </div>
  );
}

/** A compact two-state toggle pill for an inline filter. */
export function TogglePill({ on, onChange, children }: { on: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className={cx("press inline-flex h-9 items-center whitespace-nowrap rounded-full px-4 text-subhead", on ? "bg-ink font-semibold text-white" : "bg-surface text-ink")}>
      {children}
    </button>
  );
}

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
    <img ref={img} src={url} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} className={cx(box, "object-cover object-top")} style={{ width: size, height: size, background: "#ececee" }} />
  );
}

/** Up to three overlapping portraits for a recent-search or saved row. */
export function FaceStack({ urls, names = [], size = 30 }: { urls: string[]; names?: string[]; size?: number }) {
  if (urls.length === 0) return null;
  return (
    <span className="flex shrink-0 -space-x-2">
      {urls.slice(0, 3).map((u, i) => (
        <Face key={`${u}-${i}`} url={u} name={names[i] ?? ""} size={size} ring />
      ))}
    </span>
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
  useEffect(() => {
    if (open) { setShown(true); return; }
    const t = window.setTimeout(() => setShown(false), 240);
    return () => window.clearTimeout(t);
  }, [open]);
  useEffect(() => { if (open) setLast(children); }, [open, children]);
  if (!open && !shown) return null;
  return (
    <Portal>
    <div className={cx("frame-fixed inset-y-0 z-50", !open && "sheet-closing pointer-events-none")} role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" onClick={onClose} className="sheet-scrim absolute inset-0 bg-black/30" />
      <div className="sheet-panel frame-pad absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col gap-4 overflow-y-auto overscroll-contain rounded-t-[32px] bg-white pt-[5px]" style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
        <span aria-hidden="true" className="mx-auto h-[5px] w-9 shrink-0 rounded-full bg-[#c7c7cc]" />
        <div className="chrome grid grid-cols-[44px_1fr_44px] items-center gap-2">
          <span />
          <h2 className="truncate text-center text-headline text-ink">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="press inline-flex size-11 items-center justify-center rounded-full bg-surface text-ink">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M2 2l10 10M12 2 2 12" /></svg>
          </button>
        </div>
        {open ? children : last}
      </div>
    </div>
    </Portal>
  );
}
