// Shared primitives for the Figma "Wattle" system (file NEbiukDE3TyWFptwaCBhwV).
// Every screen is a 430-wide white phone frame; on desktop it sits centred on #1b1b1b.
// Measurements come from the Rules frame (225:145) and P02/P04 design context.
import Link from "next/link";
import { asset } from "@/src/ui/base-path";
import { Children, type CSSProperties, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronRight, Clock, Heart, Home, User } from "./icons";
import { tintFor } from "./tint";
import { Portal } from "./bits";

export * from "./icons";
export * from "./bits";

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

/* ------------------------------------------------------------------ frame */

/** The phone frame. `padBottom` leaves room for a fixed CTA and/or the tab bar. */
export function Screen({ children, className, padBottom = "pb-[120px]" }: { children: ReactNode; className?: string; padBottom?: string }) {
  return (
    <main className={cx("frame overflow-x-clip bg-white", className)}>
      <div className={cx("frame-pad pt-[34px]", padBottom)}>{children}</div>
    </main>
  );
}

/** Round 44 px icon button: light on white, blurred dark over photos. */
export function Circle({ children, href, onClick, label, over = false, className }: { children: ReactNode; href?: string; onClick?: () => void; label: string; over?: boolean; className?: string }) {
  const cls = cx(
    "press inline-flex size-11 shrink-0 items-center justify-center rounded-full",
    over ? "bg-caption text-white backdrop-blur-[20px]" : "bg-surface text-charcoal",
    className,
  );
  if (href) return <Link href={href} aria-label={label} className={cls}>{children}</Link>;
  return <button type="button" aria-label={label} onClick={onClick} className={cls}>{children}</button>;
}

/** Back circle + Poppins title + optional right text action (P03 "Edit"). */
export function TopBar({ title, back = "/", right, rightHref, onRight }: { title?: string; back?: string; right?: string; rightHref?: string; onRight?: () => void }) {
  return (
    <div className="flex h-11 items-center gap-4">
      <Circle href={back} label="Back"><ArrowLeft size={20} /></Circle>
      {title ? <h1 className="text-[20px] text-charcoal">{title}</h1> : null}
      <span className="ml-auto">
        {right && rightHref ? <Link href={rightHref} className="press-dim text-[14px] font-medium text-accent">{right}</Link> : null}
        {right && !rightHref ? <button type="button" onClick={onRight} className="press-dim text-[14px] font-medium text-accent">{right}</button> : null}
      </span>
    </div>
  );
}

/** Vertical rhythm helper: gaps in the design are explicit (8, 24, 32, 38, 40). */
const SNAP: Record<number, number> = { 34: 32, 38: 40 };
/** Off-grid Figma gaps (34, 38) snap to the 8 px base. */
export function Gap({ h }: { h: 8 | 12 | 16 | 24 | 32 | 34 | 38 | 40 | 48 }) {
  return <div style={{ height: SNAP[h] ?? h }} aria-hidden="true" />;
}

/* ---------------------------------------------------------------- text */

export function Title({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-[28px] leading-[1.2] tracking-[-0.015em] text-charcoal">{children}</h1>
      {sub ? <p className="font-inter text-[20px] font-medium text-grey">{sub}</p> : null}
    </div>
  );
}

export function SectionTitle({ children, right, rightHref }: { children: ReactNode; right?: string; rightHref?: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-[20px] text-charcoal">{children}</h2>
      {right && rightHref ? <Link href={rightHref} className="press-dim text-[14px] font-medium text-accent">{right}</Link> : null}
    </div>
  );
}

/** Tab-like heading pair (P04 "Why you'll connect" / "Profile"). */
export function HeadingTabs({ items }: { items: { label: string; href?: string; active?: boolean }[] }) {
  return (
    <div className="flex items-end gap-7 font-inter font-semibold">
      {items.map((t) =>
        t.href && !t.active ? (
          <Link key={t.label} href={t.href} className="text-[16px] text-ink/60">{t.label}</Link>
        ) : (
          <span key={t.label} className={t.active ? "text-[22px] text-ink" : "text-[16px] text-ink/60"}>{t.label}</span>
        ),
      )}
    </div>
  );
}

export function Body({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("text-[18px] font-medium leading-[1.5] text-grey", className)}>{children}</p>;
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="caption text-[12px] leading-normal text-grey">{children}</p>;
}

/* --------------------------------------------------------------- pills */

/** Pill 54 r20 (small = 44). `on` = charcoal fill, white text. */
export function Pill({ children, on = false, small = false, onClick, href }: { children: ReactNode; on?: boolean; small?: boolean; onClick?: () => void; href?: string }) {
  const cls = cx(
    "press inline-flex shrink-0 items-center justify-center rounded-pill px-[21px] text-[16px] font-medium whitespace-nowrap",
    small ? "h-11 text-[14px]" : "h-[54px]",
    on ? "bg-charcoal text-white" : "bg-surface-soft text-grey",
  );
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  return <button type="button" aria-pressed={on} onClick={onClick} className={cls}>{children}</button>;
}

export function Pills({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap gap-3">
      {Children.map(children, (c, i) => (
        <div className="rise" style={{ "--i": i } as CSSProperties}>{c}</div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- fields */

/** Field r20 2px #D2D2D2. */
export function FieldBox({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("field rounded-field border-2 border-line bg-white", className)}>{children}</div>;
}

/* -------------------------------------------------------------- rows */

/** Icon box 34 r6 #EDEDED + title/sub + chevron or meta. */
export function Row({ icon, title, sub, meta, href, onClick, chevron = true }: { icon?: ReactNode; title: ReactNode; sub?: ReactNode; meta?: ReactNode; href?: string; onClick?: () => void; chevron?: boolean }) {
  const inner = (
    <>
      {icon ? <span className="inline-flex min-h-[34px] min-w-[34px] shrink-0 items-center justify-center rounded-[6px] text-charcoal [&:not(:has(img))]:bg-surface">{icon}</span> : null}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[16px] font-medium text-charcoal">{title}</span>
        {sub ? <span className="text-[14px] text-grey">{sub}</span> : null}
      </span>
      {meta ? <span className="text-[12px] text-grey">{meta}</span> : null}
      {chevron && (href || onClick) ? <ChevronRight size={20} className="text-grey" /> : null}
    </>
  );
  const cls = "press press-soft flex w-full items-center gap-[14px] py-[14px] text-left";
  if (href) return <Link href={href} className={cls}>{inner}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{inner}</button>;
  return <div className={cls}>{inner}</div>;
}

export function Divider() {
  return <div className="h-px w-full bg-divider" />;
}

/** Check row (P07, P09): tick box 24 r6 + text + optional source link. */
export function CheckRow({ title, sub, href, checked = true }: { title: ReactNode; sub?: ReactNode; href?: string; checked?: boolean }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className={cx("mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-[6px]", checked ? "bg-surface text-charcoal" : "border border-line text-transparent")}>
        <Check size={14} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[14px] font-medium text-charcoal">{title}</span>
        {sub ? <span className="text-[12px] text-grey">{sub}</span> : null}
      </span>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" aria-label="Source" className="press text-accent">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 4h6v6" /><path d="M20 4 10 14" /><path d="M18 13v7H4V6h7" /></svg>
        </a>
      ) : null}
    </div>
  );
}

/** Stat: icon box + label (P04 "14 yrs", "Telehealth", "Referral"). */
export function Stat({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex size-[34px] items-center justify-center rounded-[6px] bg-surface text-charcoal">{icon}</span>
      <span className="text-[18px] font-medium text-grey">{children}</span>
    </span>
  );
}

/** On/Off toggle pill (C07). */
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={cx("press inline-flex h-8 w-[38px] items-center justify-center rounded-[10px] text-[12px] font-medium", on ? "bg-accent text-white" : "bg-surface text-grey")}>
      {on ? "On" : "Off"}
    </button>
  );
}

/** Progress bar (C05–C07): charcoal fill over #EDEDED. */
export function Progress({ step, of }: { step: number; of: number }) {
  return (
    <div className="h-0.5 w-full bg-surface" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={of}>
      <div className="bar-fill h-full w-full bg-charcoal" style={{ transform: `scaleX(${step / of})` }} />
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

/** Photo card r25.5 with blurred caption. No photo = #D9D9D9 with initials. */
export function PhotoCard({ name, place, fee, photo, height = 460, caption = true, topLeft, topRight, href, children }: { name: string; place?: string; fee?: string; photo?: string | null; height?: number; caption?: boolean; topLeft?: ReactNode; topRight?: ReactNode; href?: string; children?: ReactNode }) {
  const body = (
    <div className="relative w-full overflow-hidden rounded-[30px] shadow-photo" style={{ height, background: photo ? "#e9e9e9" : tintFor(name)[0] }}>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" referrerPolicy="no-referrer" className="absolute inset-0 size-full object-cover object-top" />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center font-display text-[64px]" style={{ color: tintFor(name)[1] }}>{initialsOf(name)}</span>
      )}
      {topLeft ? <div className="absolute left-[21px] top-[18px]">{topLeft}</div> : null}
      {topRight ? <div className="absolute right-[21px] top-[18px]">{topRight}</div> : null}
      {caption ? (
        <div className="absolute inset-x-[21px] bottom-[21px] flex items-center gap-2.5 rounded-[15px] bg-caption px-4 py-[18px] text-white backdrop-blur-[20px] shadow-[0_5px_4.5px_rgba(0,0,0,0.1)]">
          <span className="flex min-w-0 flex-1 flex-col gap-2.5">
            <span className="truncate font-inter text-[24px] font-semibold">{name}</span>
            {place ? (
              <span className="caption inline-flex items-center gap-1.5 text-[18px] font-medium text-caption-text">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10Z" /><circle cx="12" cy="11" r="2.2" /></svg>
                <span className="truncate">{place}</span>
              </span>
            ) : null}
          </span>
          {fee ? (
            <span className="flex flex-col items-end gap-1.5">
              <span className="caption text-[16px] font-medium text-caption-text">Fee</span>
              <span className="text-[24px] font-medium">{fee}</span>
            </span>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );
  return href ? <Link href={href} className="press press-soft block">{body}</Link> : body;
}

/* ----------------------------------------------------------------- cta */

/** CTA 373x66 r20 #1B1B1B, fixed to the frame bottom. `arrow` shows the trailing arrow. */
export function Cta({ children, href, onClick, type = "button", arrow = true, icon, disabled, fixed = true, secondary, note }: { children: ReactNode; href?: string; onClick?: () => void; type?: "button" | "submit"; arrow?: boolean; icon?: ReactNode; disabled?: boolean; fixed?: boolean; secondary?: ReactNode; note?: ReactNode }) {
  const cls = cx(
    "press flex h-[66px] w-full items-center justify-center gap-5 rounded-cta text-[20px] font-medium",
    disabled ? "bg-surface text-grey" : "bg-ink text-white shadow-cta",
  );
  const inner = (
    <>
      {children}
      {icon ?? (arrow ? <ArrowRight size={22} /> : null)}
    </>
  );
  const button = href ? (
    <Link href={href} className={cls} aria-disabled={disabled}>{inner}</Link>
  ) : (
    <button type={type} onClick={onClick} disabled={disabled} className={cls}>{inner}</button>
  );
  if (!fixed) return button;
  return (
    <div className="dock frame-fixed pointer-events-none bottom-0 z-20 bg-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-12 h-12 bg-gradient-to-b from-white/0 to-white" />
      {note ? <p className="frame-pad caption pointer-events-auto pb-2 text-center text-[12px] text-grey">{note}</p> : null}
      <div className="frame-pad pointer-events-auto flex items-center gap-3 pb-[26px] pt-2">
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

/** Bottom tab bar: four 23 px icons, red 8 px dot under the active one. */
export function TabBar({ active }: { active: (typeof TABS)[number]["href"] }) {
  return (
    <nav aria-label="Primary" className="frame-fixed pointer-events-none bottom-0 z-30">
      <div className="material pointer-events-auto flex items-start justify-around px-4 pt-2" style={{ height: "var(--nav-h, 88px)" }}>
        {TABS.map(({ href, label, Icon }) => (
          <Link key={href} href={href} aria-current={active === href ? "page" : undefined} className={cx("press flex min-w-16 flex-col items-center gap-1 py-1", active === href ? "text-ink" : "text-[#8a8a8a]")}>
            <Icon size={23} />
            <span className={cx("text-[11px] leading-none", active === href ? "font-semibold" : "font-medium")}>{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

/* ---------------------------------------------------- patient-b additions (P06–P11) */
// New exports only. Measured from P06 226:58, P07 226:132, P09 226:257 and P10 226:308.

/** A downloaded Figma icon from public/figma/b, at its exported size. */
export function FigmaIcon({ name, size, className }: { name: string; size: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={asset(`/figma/b/${name}.svg`)} alt="" width={size} height={size} aria-hidden="true" className={cx("block shrink-0", className)} />;
}

/** Row with a 34 r6 icon box, 16/14 text and an 18 px external-link to the source (P07 Research, P09 reasons). */
export function SourceRow({ icon, title, sub, href }: { icon: ReactNode; title: ReactNode; sub?: ReactNode; href?: string | null }) {
  return (
    <div className="flex w-full items-center gap-[14px] py-[14px]">
      <span className="inline-flex size-[34px] shrink-0 items-center justify-center rounded-[6px] bg-surface text-charcoal">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[16px] font-medium leading-normal text-charcoal">{title}</span>
        {sub ? <span className="text-[14px] leading-normal text-grey">{sub}</span> : null}
      </span>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" aria-label="Source" className="press shrink-0 text-accent">
          <FigmaIcon name="external" size={18} />
        </a>
      ) : null}
    </div>
  );
}

/** Check item in a wrapping grid (P07 Conditions): 34 r6 box with tick + 16 px label. */
export function CheckItem({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-flex size-[34px] shrink-0 items-center justify-center rounded-[6px] bg-surface"><FigmaIcon name="check" size={17} /></span>
      <span className="flex flex-col">
        <span className="text-[16px] font-medium leading-normal text-grey">{children}</span>
        {sub ? <span className="text-[12px] leading-normal text-grey">{sub}</span> : null}
      </span>
    </span>
  );
}

/** The 70 px white fade above a fixed CTA (P06/P07 228:15). */
export function Fade() {
  return <div aria-hidden="true" className="frame-fixed pointer-events-none bottom-[118px] z-10 h-[70px] bg-gradient-to-b from-white/0 to-white" />;
}

