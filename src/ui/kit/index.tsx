// Shared primitives. Apple pass (2026-10-23, docs/apple/PLAN.md): the Figma "Wattle" frame
// (file NEbiukDE3TyWFptwaCBhwV) rebuilt on iOS 26 system components. Every earlier export keeps its
// API so screens restyle in place; NavBar, LargeTitle, Group, Cell, GroupHeader, Segmented and Button
// are the iOS pieces new screens should compose from.
import Link from "next/link";
import { asset } from "@/src/ui/base-path";
import { Children, type CSSProperties, type ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight, Clock, Heart, Home, User } from "./icons";
import { tintFor } from "./tint";
import { Portal } from "./bits";

export * from "./icons";
export * from "./bits";
export * from "./nav";
import { NavBar } from "./nav";

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

/* ------------------------------------------------------------------ frame */

/** The phone frame. `tone="grouped"` puts the screen on systemGroupedBackground for inset-grouped lists.
 *  `padBottom` leaves room for a fixed CTA and/or the tab bar. Screens start with a 44 px nav row. */
export function Screen({ children, className, padBottom = "pb-[120px]", tone = "plain" }: { children: ReactNode; className?: string; padBottom?: string; tone?: "plain" | "grouped" }) {
  return (
    <main className={cx("frame overflow-x-clip", tone === "grouped" ? "bg-grouped" : "bg-white", className)} style={{ "--page-bg": tone === "grouped" ? "#f2f2f7" : "#ffffff" } as CSSProperties}>
      <div className={cx("frame-pad pt-2", padBottom)}>{children}</div>
    </main>
  );
}

/** A 44 px toolbar circle (iOS 26 glass). `over` = over a photo (dark glass, white glyph). */
export function Circle({ children, href, onClick, label, over = false, className }: { children: ReactNode; href?: string; onClick?: () => void; label: string; over?: boolean; className?: string }) {
  const cls = cx("press chrome inline-flex size-11 shrink-0 items-center justify-center rounded-full", over ? "glass-dark" : "glass text-ink", className);
  if (href) return <Link href={href} aria-label={label} className={cls}>{children}</Link>;
  return <button type="button" aria-label={label} onClick={onClick} className={cls}>{children}</button>;
}

/** Back circle + inline title + optional trailing text action ("Edit"). */
export function TopBar({ title, back = "/", right, rightHref, onRight }: { title?: string; back?: string; right?: string; rightHref?: string; onRight?: () => void }) {
  const action = right ? (
    rightHref ? (
      <Link href={rightHref} className="press-dim inline-flex h-11 items-center px-1 text-body text-accent">{right}</Link>
    ) : (
      <button type="button" onClick={onRight} className="press-dim inline-flex h-11 items-center px-1 text-body text-accent">{right}</button>
    )
  ) : null;
  return <NavBar back={back} title={title} right={action} />;
}

/** The screen title under the nav row: 34/41 bold. */
export function LargeTitle({ children, sub, trailing }: { children: ReactNode; sub?: ReactNode; trailing?: ReactNode }) {
  return (
    <div className="pb-2 pt-[3px]">
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-large-title text-ink">{children}</h1>
        {trailing}
      </div>
      {sub ? <p className="mt-1 text-body text-grey">{sub}</p> : null}
    </div>
  );
}

/** Vertical rhythm helper on the 4 px grid. Off-grid Figma gaps (34, 38) snap to it. */
const SNAP: Record<number, number> = { 34: 32, 38: 40 };
export function Gap({ h }: { h: 8 | 12 | 16 | 24 | 32 | 34 | 38 | 40 | 48 }) {
  return <div style={{ height: SNAP[h] ?? h }} aria-hidden="true" />;
}

/* ---------------------------------------------------------------- text */

export function Title({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return <LargeTitle sub={sub}>{children}</LargeTitle>;
}

/** A content section heading (App Store, Music): Title 3, semibold. */
export function SectionTitle({ children, right, rightHref }: { children: ReactNode; right?: string; rightHref?: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <h2 className="text-title3 text-ink">{children}</h2>
      {right && rightHref ? <Link href={rightHref} className="press-dim text-body text-accent">{right}</Link> : null}
    </div>
  );
}

/** Tab-like heading pair, kept for older screens. */
export function HeadingTabs({ items }: { items: { label: string; href?: string; active?: boolean }[] }) {
  return (
    <div className="flex items-end gap-6">
      {items.map((t) =>
        t.href && !t.active ? (
          <Link key={t.label} href={t.href} className="text-body text-grey">{t.label}</Link>
        ) : (
          <span key={t.label} className={t.active ? "text-title2 text-ink" : "text-body text-grey"}>{t.label}</span>
        ),
      )}
    </div>
  );
}

export function Body({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("text-body leading-read text-grey", className)}>{children}</p>;
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="text-footnote text-grey">{children}</p>;
}

/* --------------------------------------------------------------- pills */

/** A choice capsule (44 tall). `on` = filled in ink, white text. */
export function Pill({ children, on = false, small = false, onClick, href }: { children: ReactNode; on?: boolean; small?: boolean; onClick?: () => void; href?: string }) {
  const cls = cx(
    "press chrome inline-flex h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-full",
    small ? "px-4 text-subhead" : "px-5 text-body",
    on ? "bg-ink text-white" : "bg-surface text-ink",
  );
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  return <button type="button" aria-pressed={on} onClick={onClick} className={cls}>{children}</button>;
}

export function Pills({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Children.map(children, (c, i) => (
        <div className="rise" style={{ "--i": i } as CSSProperties}>{c}</div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- fields */

/** A filled field (no border): tertiary fill, 12 px corners, the tint ring on focus. */
export function FieldBox({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("field rounded-field border border-line bg-white", className)}>{children}</div>;
}

/* -------------------------------------------------------------- rows */

/** A plain-list row: optional icon well, title 17, subtitle 15 secondary, chevron when it navigates. */
export function Row({ icon, title, sub, meta, href, onClick, chevron = true }: { icon?: ReactNode; title: ReactNode; sub?: ReactNode; meta?: ReactNode; href?: string; onClick?: () => void; chevron?: boolean }) {
  const inner = (
    <>
      {icon ? <span className="inline-flex size-[30px] shrink-0 items-center justify-center rounded-[8px] text-ink [&:not(:has(img))]:bg-surface">{icon}</span> : null}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-body text-ink">{title}</span>
        {sub ? <span className="text-subhead text-grey">{sub}</span> : null}
      </span>
      {meta ? <span className="text-subhead text-grey">{meta}</span> : null}
      {chevron && (href || onClick) ? <ChevronRight size={16} strokeWidth={2.25} className="shrink-0 text-grey-3" /> : null}
    </>
  );
  const cls = "press-soft chrome flex min-h-[52px] w-full items-center gap-3 py-2.5 text-left";
  if (href) return <Link href={href} className={cls} onClick={onClick}>{inner}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{inner}</button>;
  return <div className={cls}>{inner}</div>;
}

/** A hairline separator. `inset` starts it at the text column of an icon row. */
export function Divider({ inset = false }: { inset?: boolean }) {
  return <div aria-hidden="true" className={cx("hairline w-full", inset && "ml-[42px] w-auto")} />;
}

/* ------------------------------------------------------- grouped lists */

/** An inset-grouped section (iOS 26): 26 px continuous-looking corners, white on the grouped page
 *  (or the grouped grey on a white page), rows separated by hairlines from the text column. */
export function Group({ children, tone = "cell", className, sep = 16 }: { children: ReactNode; tone?: "cell" | "soft" | "plain"; className?: string; sep?: number }) {
  return (
    <div className={cx("ios-group overflow-hidden", tone === "plain" ? "" : "rounded-card", tone === "cell" ? "bg-cell" : tone === "soft" ? "bg-surface-soft" : "", className)} style={{ "--sep": `${sep}px` } as CSSProperties}>
      {children}
    </div>
  );
}

/** Section header above a group: 17 semibold in secondary label (iOS 26 Settings), on the text column. */
export function GroupHeader({ children, trailing }: { children: ReactNode; trailing?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between px-4 pb-[7px] pt-7">
      <h2 className="text-headline text-grey">{children}</h2>
      {trailing}
    </div>
  );
}

/** Footnote under a group. */
export function GroupFooter({ children }: { children: ReactNode }) {
  return <p className="px-4 pt-2 text-footnote text-grey">{children}</p>;
}

/** One row of a Group: 52 tall, 16 padding, highlight on touch. `accessory` "chevron" only when it
 *  navigates (HIG); "check" for the selected option; any node (a Switch) otherwise. */
export function Cell({ icon, bare = false, title, sub, value, href, onClick, accessory, tint = false, external = false, role, selected, attrs }: {
  icon?: ReactNode;
  /** The icon sits without a well (a face or a face stack). */
  bare?: boolean;
  title: ReactNode;
  sub?: ReactNode;
  value?: ReactNode;
  href?: string;
  onClick?: () => void;
  accessory?: "chevron" | "check" | "none" | ReactNode;
  tint?: boolean;
  external?: boolean;
  role?: "radio";
  selected?: boolean;
  attrs?: Record<`data-${string}`, string | number>;
}) {
  const acc = accessory ?? (href && !external ? "chevron" : "none");
  const inner = (
    <>
      {icon ? <span className={cx("inline-flex shrink-0 items-center justify-center text-ink", bare ? "min-w-[30px]" : "size-[30px] rounded-[8px] bg-surface")}>{icon}</span> : null}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 py-[15px]">
        <span className={cx("text-body", tint ? "text-accent" : "text-ink")}>{title}</span>
        {sub ? <span className="text-subhead text-grey">{sub}</span> : null}
      </span>
      {value ? <span className="shrink-0 text-body text-grey">{value}</span> : null}
      {acc === "chevron" ? <ChevronRight size={16} strokeWidth={2.25} className="shrink-0 text-grey-3" /> : null}
      {acc === "check" ? <Check size={20} strokeWidth={2.25} className={cx("shrink-0 text-accent", !selected && "invisible")} /> : null}
      {acc !== "chevron" && acc !== "check" && acc !== "none" ? acc : null}
    </>
  );
  const cls = "chrome flex min-h-[52px] w-full items-center gap-3 px-4 text-left";
  if (href) return <Link href={href} className={cx("cell", cls)} onClick={onClick} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>{inner}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={cx("cell", cls)} role={role} aria-checked={role ? Boolean(selected) : undefined} {...attrs}>{inner}</button>;
  return <div className={cls}>{inner}</div>;
}

/** iOS segmented control: a filled track with a raised white thumb on the selected segment. */
export function Segmented<T extends string>({ items, value, onChange, label }: { items: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="chrome grid h-9 rounded-full bg-surface p-[2px]" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((it) => {
        const on = it.value === value;
        return (
          <button key={it.value} type="button" role="radio" aria-checked={on} onClick={() => onChange(it.value)} className={cx("hit truncate rounded-full px-2 text-subhead transition-[background-color,box-shadow] duration-200", on ? "bg-white font-semibold text-ink shadow-[0_3px_8px_rgba(0,0,0,0.12),0_3px_1px_rgba(0,0,0,0.04)]" : "text-ink")}>
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

/** Capsule buttons (iOS 26). `filled` is the one prominent action per view; `gray` is bordered;
 *  `plain` is tint text. Large 50, medium 44, small 34 (with a 44 hit area kept by its row). */
export function Button({ children, href, onClick, kind = "filled", size = "large", type = "button", disabled, full = false, icon, className, external = false }: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  kind?: "filled" | "gray" | "plain";
  size?: "large" | "medium" | "small";
  type?: "button" | "submit";
  disabled?: boolean;
  full?: boolean;
  icon?: ReactNode;
  className?: string;
  external?: boolean;
}) {
  const cls = cx(
    "press chrome inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full disabled:opacity-[.32] aria-disabled:opacity-[.32]",
    size === "large" && "h-[50px] px-6 text-headline",
    size === "medium" && "h-11 px-5 text-headline",
    size === "small" && "hit h-[34px] px-3.5 text-subhead font-semibold",
    kind === "filled" && "bg-ink text-white",
    kind === "gray" && "bg-surface text-ink",
    kind === "plain" && "px-1 text-accent",
    full && "w-full",
    className,
  );
  const inner = (
    <>
      {icon}
      {children}
    </>
  );
  if (href) return <Link href={href} onClick={onClick} className={cls} aria-disabled={disabled} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>{inner}</Link>;
  return <button type={type} onClick={onClick} disabled={disabled} className={cls}>{inner}</button>;
}

/** Check row: tick box + text + optional source link. */
export function CheckRow({ title, sub, href, checked = true }: { title: ReactNode; sub?: ReactNode; href?: string; checked?: boolean }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className={cx("mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-[8px]", checked ? "bg-surface text-ink" : "border border-line text-transparent")}>
        <Check size={14} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-subhead font-semibold text-ink">{title}</span>
        {sub ? <span className="text-footnote text-grey">{sub}</span> : null}
      </span>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" aria-label="Source" className="press-dim inline-flex size-11 items-center justify-center text-accent">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 4h6v6" /><path d="M20 4 10 14" /><path d="M18 13v7H4V6h7" /></svg>
        </a>
      ) : null}
    </div>
  );
}

/** Stat: icon well + label. */
export function Stat({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex size-[30px] items-center justify-center rounded-[8px] bg-surface text-ink">{icon}</span>
      <span className="text-body text-grey">{children}</span>
    </span>
  );
}

/** iOS switch: 51 × 31, green when on, a white knob that slides. */
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={cx("hit chrome relative inline-flex h-[31px] w-[51px] shrink-0 items-center rounded-full transition-colors duration-200", on ? "bg-switch" : "bg-[rgba(120,120,128,0.16)]")}>
      <span aria-hidden="true" className="absolute left-[2px] size-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_3px_1px_rgba(0,0,0,0.06)] transition-transform duration-200" style={{ transform: on ? "translateX(20px)" : "none", transitionTimingFunction: "var(--ease-out)" }} />
    </button>
  );
}

/** Progress: a 4 px capsule, ink fill over the tertiary fill. */
export function Progress({ step, of }: { step: number; of: number }) {
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-surface" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={of}>
      <div className="bar-fill h-full w-full rounded-full bg-ink" style={{ transform: `scaleX(${step / of})` }} />
    </div>
  );
}

/* --------------------------------------------------------------- photo */

export function initialsOf(name: string): string {
  return name
    .replace(/^(dr|a\/prof|prof|associate professor|professor)\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/** Photo card with a dimmed caption. No photo = the doctor's tint with initials. */
export function PhotoCard({ name, place, fee, photo, height = 460, caption = true, topLeft, topRight, href, children }: { name: string; place?: string; fee?: string; photo?: string | null; height?: number; caption?: boolean; topLeft?: ReactNode; topRight?: ReactNode; href?: string; children?: ReactNode }) {
  const body = (
    <div className="relative w-full overflow-hidden rounded-card" style={{ height, background: photo ? "#ececee" : tintFor(name)[0] }}>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" referrerPolicy="no-referrer" className="absolute inset-0 size-full object-cover object-top" />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center font-display text-[64px]" style={{ color: tintFor(name)[1] }}>{initialsOf(name)}</span>
      )}
      {topLeft ? <div className="absolute left-4 top-4">{topLeft}</div> : null}
      {topRight ? <div className="absolute right-4 top-4">{topRight}</div> : null}
      {caption ? (
        <div className="glass-dark absolute inset-x-4 bottom-4 flex items-center gap-2.5 rounded-control px-4 py-3">
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-headline">{name}</span>
            {place ? <span className="truncate text-subhead text-caption-text">{place}</span> : null}
          </span>
          {fee ? (
            <span className="flex flex-col items-end">
              <span className="text-footnote text-caption-text">Fee</span>
              <span className="text-headline">{fee}</span>
            </span>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );
  return href ? <Link href={href} className="press-soft block">{body}</Link> : body;
}

/* ----------------------------------------------------------------- cta */

/** The primary action: a 50 px capsule in ink, docked to the frame bottom unless `fixed={false}`.
 *  No trailing arrow by default (Apple's buttons say what they do and stop). */
export function Cta({ children, href, onClick, type = "button", arrow = false, icon, disabled, fixed = true, secondary, note }: { children: ReactNode; href?: string; onClick?: () => void; type?: "button" | "submit"; arrow?: boolean; icon?: ReactNode; disabled?: boolean; fixed?: boolean; secondary?: ReactNode; note?: ReactNode }) {
  const button = (
    <Button href={href} onClick={onClick} type={type} disabled={disabled} full icon={undefined}>
      {children}
      {icon ?? (arrow ? <ChevronRight size={18} strokeWidth={2.25} /> : null)}
    </Button>
  );
  if (!fixed) return button;
  return (
    <div className="dock frame-fixed pointer-events-none bottom-0 z-20">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -top-6 bg-gradient-to-b from-white/0 via-white/90 via-30% to-white" />
      {note ? <p className="frame-pad pointer-events-auto relative pb-2 text-center text-footnote text-grey">{note}</p> : null}
      <div className="frame-pad pointer-events-auto relative flex items-center gap-3 pt-2" style={{ paddingBottom: "var(--dock-pb)" }}>
        {secondary}
        {button}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- tabbar */

const TABS = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/recent", label: "Recent", Icon: Clock },
  { href: "/saved", label: "Saved", Icon: Heart },
  { href: "/me", label: "Profile", Icon: User },
] as const;

/** iOS 26 tab bar: a floating glass capsule, 62 tall, 21 from the sides and bottom; one-word 11 pt labels;
 *  the selected tab sits on a filled lens; content dissolves under a bottom scroll edge. */
export function TabBar({ active }: { active: (typeof TABS)[number]["href"] }) {
  return (
    <nav aria-label="Primary" className="chrome frame-fixed pointer-events-none bottom-0 z-30 px-[21px]" style={{ paddingBottom: "var(--tab-gap)" }}>
      <div aria-hidden="true" className="scroll-edge-bottom pointer-events-none absolute inset-x-0 bottom-0 h-[calc(100%+28px)]" />
      <div className="glass pointer-events-auto relative grid h-[62px] grid-cols-4 items-stretch rounded-full p-1">
        {TABS.map(({ href, label, Icon }) => {
          const on = active === href;
          return (
            <Link key={href} href={href} aria-current={on ? "page" : undefined} className={cx("press flex flex-col items-center justify-center gap-0.5 rounded-full", on ? "bg-surface text-ink" : "text-grey")}>
              <Icon size={24} strokeWidth={on ? 2.1 : 1.75} fill={on && label !== "Recent" ? "currentColor" : "none"} />
              <span className="text-caption2 font-semibold">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/* ---------------------------------------------------- patient-b additions (P06–P11) */

/** A downloaded Figma icon from public/figma/b, at its exported size. */
export function FigmaIcon({ name, size, className }: { name: string; size: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={asset(`/figma/b/${name}.svg`)} alt="" width={size} height={size} aria-hidden="true" className={cx("block shrink-0", className)} />;
}

/** Row with an icon well, 17/15 text and a link to the source (P07 Research, P09 reasons). */
export function SourceRow({ icon, title, sub, href }: { icon: ReactNode; title: ReactNode; sub?: ReactNode; href?: string | null }) {
  return (
    <div className="flex min-h-[52px] w-full items-center gap-3 py-2.5">
      <span className="inline-flex size-[30px] shrink-0 items-center justify-center rounded-[8px] bg-surface text-ink">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-body text-ink">{title}</span>
        {sub ? <span className="text-subhead text-grey">{sub}</span> : null}
      </span>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" aria-label="Source" className="press-dim inline-flex size-11 shrink-0 items-center justify-center text-accent">
          <FigmaIcon name="external" size={18} />
        </a>
      ) : null}
    </div>
  );
}

/** Check item in a wrapping grid (P07 Conditions). */
export function CheckItem({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-flex size-[30px] shrink-0 items-center justify-center rounded-[8px] bg-surface"><FigmaIcon name="check" size={16} /></span>
      <span className="flex flex-col">
        <span className="text-body text-ink">{children}</span>
        {sub ? <span className="text-footnote text-grey">{sub}</span> : null}
      </span>
    </span>
  );
}

/** The white fade above a fixed CTA. */
export function Fade() {
  return <div aria-hidden="true" className="frame-fixed pointer-events-none bottom-[118px] z-10 h-[70px] bg-gradient-to-b from-white/0 to-white" />;
}
