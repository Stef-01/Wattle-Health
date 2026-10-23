"use client";
// Pieces the C01–C08 screens share that the kit does not carry (step titles, the filled field, the
// small capsule, the 4 px progress bar, the step header); Apple pass 2026-10-23. Icons are the Figma assets in public/figma/c.
import Link from "next/link";
import { asset } from "@/src/ui/base-path";
import type { ReactNode } from "react";
import { ChevronLeft, Circle } from "@/src/ui/kit";

export const ASSET = asset("/figma/c");

/** A Figma SVG at its own size. */
export function Asset({ name, size, className }: { name: string; size: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`${ASSET}/${name}.svg`} width={size} height={size} alt="" aria-hidden="true" className={className} />;
}

/** Back circle + spacer + right text: "1 of 4", "Log in". */
export function StepHeader({ back, right, rightHref }: { back: string; right?: string; rightHref?: string }) {
  return (
    <div className="flex h-11 items-center gap-4">
      <Circle href={back} label="Back"><ChevronLeft size={22} strokeWidth={2} /></Circle>
      <span className="flex-1" />
      {right ? (
        rightHref ? (
          <Link href={rightHref} className="press-dim inline-flex h-11 items-center px-1 text-body text-accent">{right}</Link>
        ) : (
          <span className="tnum text-subhead text-grey">{right}</span>
        )
      ) : null}
    </div>
  );
}

/** Step title: Title 1 bold, optional secondary subtitle (Apple pass; was Roboto Medium 30). */
export function StepTitle({ children, sub, size = 30 }: { children: ReactNode; sub?: ReactNode; size?: 30 | 26 }) {
  void size;
  return (
    <div className="flex flex-col">
      <h1 className="text-title1 text-ink">{children}</h1>
      {sub ? <p className="mt-1.5 text-body text-grey">{sub}</p> : null}
    </div>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <p className="mb-2 text-subhead text-grey">{children}</p>;
}

export function Note({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={["text-subhead text-grey", className].filter(Boolean).join(" ")}>{children}</p>;
}

/** Field 58 r20 2px #D2D2D2, pl 31 pr 24, optional 2x32 divider + 24 icon on the right. */
export function Field({ value, onChange, placeholder, icon, type = "text", name, inputMode, autoComplete, prefix }: { value: string; onChange: (v: string) => void; placeholder?: string; icon?: ReactNode; type?: string; name: string; inputMode?: "text" | "email" | "decimal"; autoComplete?: string; prefix?: string }) {
  return (
    <label className="field flex h-[52px] w-full items-center gap-3 rounded-field bg-surface px-4">
      {prefix ? <span className="text-body text-charcoal">{prefix}</span> : null}
      <input
        name={name}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={["min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-grey", prefix && "-ml-[10px]"].filter(Boolean).join(" ")}
      />
      {icon ? (
        <>
          <span className="h-6 w-px shrink-0 bg-hairline" aria-hidden="true" />
          <span className="inline-flex size-6 shrink-0 items-center justify-center">{icon}</span>
        </>
      ) : null}
    </label>
  );
}

/** Small pill 44 r14 px16 text 14 (C06 Keep/Edit/Say it again, C07 On/Off). */
export function SmallPill({ children, on, onClick, label, role }: { children: ReactNode; on: boolean; onClick?: () => void; label?: string; role?: "switch" }) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={role === "switch" ? on : undefined}
      aria-pressed={role ? undefined : on}
      aria-label={label}
      onClick={onClick}
      className={["press inline-flex h-11 shrink-0 items-center justify-center rounded-full px-4 text-subhead whitespace-nowrap", on ? "bg-ink font-semibold text-white" : "bg-surface text-ink"].join(" ")}
    >
      {children}
    </button>
  );
}

/** 4 px progress bar, r2, charcoal over #EDEDED. */
export function StepProgress({ step, of }: { step: number; of: number }) {
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-surface" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={of}>
      <div className="h-full rounded-full bg-ink" style={{ width: `${Math.min(100, (step / of) * 100)}%` }} />
    </div>
  );
}

/** Local-mode banner: shown when the server actions write to memory, not Supabase. */
export function DevBanner({ backend }: { backend?: "supabase" | "memory" }) {
  if (backend !== "memory") return null;
  return (
    <p role="status" className="pointer-events-none absolute inset-x-7 top-2 text-center text-footnote leading-none text-grey">
      Local mode: no Supabase key, nothing is saved.
    </p>
  );
}

export function Loading() {
  return <div className="min-h-[200px]" aria-busy="true" />;
}
