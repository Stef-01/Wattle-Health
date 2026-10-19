"use client";
// Primitives added 2026-10-16 for the v3 results and profile: an initials avatar (no photos are
// held), small chips, a labelled section, and a disclosure that opens in place (Apple: show the
// common path first, one level deeper on request; Emil: transitions, never keyframes).
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
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
      className={cx("inline-flex shrink-0 items-center justify-center rounded-full font-display font-medium tracking-[-0.01em]", tone === "ink" && "bg-ink text-white")}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36), ...(tone === "soft" ? { background: bg, color: fg } : {}) }}
    >
      {initialsFor(name)}
    </span>
  );
}

/** Small chip (32 high): a condition, a hobby, a practical fact. `tone` marks the matched ones. */
export function Chip({ children, tone = "soft" }: { children: ReactNode; tone?: "soft" | "match" | "line" | "text" }) {
  if (tone === "text") return <span className="text-[16px] leading-[1.5] text-charcoal [&:not(:last-child)]:after:mx-2 [&:not(:last-child)]:after:text-grey [&:not(:last-child)]:after:content-['·']">{children}</span>;
  return (
    <span
      className={cx(
        "inline-flex h-8 items-center whitespace-nowrap rounded-full px-3 text-[13px] font-medium leading-none",
        tone === "match" && "bg-accent-soft text-accent",
        tone === "soft" && "bg-surface text-charcoal",
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

/** Labelled section: a 12 px caption label, then the content. Keeps facts flat and scannable. */
export function Labelled({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <section className={cx("flex flex-col gap-2.5", className)}>
      <h2 className="text-[18px] text-ink">{label}</h2>
      {children}
    </section>
  );
}

/** Text clipped to a few lines with an inline "More" when it is longer. */
/** Text clipped to a few lines. "More" opens the whole passage and, when given, `more` content beneath it. */
export function Clamp({ text, lines = 3, className, more }: { text: string; lines?: number; className?: string; more?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const long = text.length > lines * 52 || Boolean(more);
  return (
    <div className="flex flex-col gap-3">
      <p className={cx("", className ?? "text-[17px] leading-[1.5] text-charcoal")}>
        <span className={!open && long ? "line-clamp-3" : undefined} style={!open && long ? { WebkitLineClamp: lines } : undefined}>
          {text}
        </span>
        {long ? (
          <button type="button" onClick={() => setOpen((v) => !v)} className="press-dim ml-1 text-[15px] font-medium text-accent">
            {open ? "Less" : "More"}
          </button>
        ) : null}
      </p>
      {open && more ? <div className="rise flex flex-col gap-3">{more}</div> : null}
    </div>
  );
}

/** A row that opens its content in place. Summary is one line; the chevron turns. */
/** Subtle panel tints, one per kind of drill-down, so the eye can tell them apart without colour shouting. */
export const PANEL_TINTS = { research: "#f6f7fa", practical: "#f8f6f3", why: "#f5f8f6", sources: "#f7f7f7" } as const;

export function Disclosure({ title, sub, children, defaultOpen = false, tint }: { title: ReactNode; sub?: ReactNode; children: ReactNode; defaultOpen?: boolean; tint?: keyof typeof PANEL_TINTS }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cx(tint ? "mb-2 rounded-[8px] px-4" : "border-b border-divider")} style={tint ? { background: PANEL_TINTS[tint] } : undefined}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="press press-soft flex w-full items-center gap-3 py-4 text-left">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[16px] font-medium text-charcoal">{title}</span>
          {sub ? <span className="text-[13px] text-grey">{sub}</span> : null}
        </span>
        <ChevronRight size={18} className={cx("shrink-0 text-grey transition-transform duration-200", open && "rotate-90")} style={{ transitionTimingFunction: "var(--ease-out)" }} />
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
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className={cx("press inline-flex h-9 items-center whitespace-nowrap rounded-full px-4 text-[14px] font-medium", on ? "bg-ink text-white" : "bg-surface-soft text-grey")}>
      {children}
    </button>
  );
}

/** Up to three overlapping portraits, 32 px, for a recent-search row. */
export function FaceStack({ urls, size = 32 }: { urls: string[]; size?: number }) {
  if (urls.length === 0) return null;
  return (
    <span className="flex shrink-0 -space-x-2">
      {urls.slice(0, 3).map((u, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={`${u}-${i}`} src={u} alt="" referrerPolicy="no-referrer" className="rounded-full border-2 border-white object-cover object-top" style={{ width: size, height: size, background: "#e9e9e9" }} />
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
