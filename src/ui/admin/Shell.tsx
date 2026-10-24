// The admin frame: title, the four sections, and sign out. Team surface (not a patient screen),
// built from the same kit and tokens; noindex on every page.
import Link from "next/link";
import type { ReactNode } from "react";
import { Screen } from "@/src/ui/kit";
import { SignOut } from "./client";

const SECTIONS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/review", label: "Review" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/cases", label: "Case studies" },
] as const;

export function AdminShell({ active, title, sub, children }: { active: (typeof SECTIONS)[number]["href"]; title: string; sub?: ReactNode; children: ReactNode }) {
  return (
    <Screen className="frame-wide" padBottom="pb-16">
      <div className="flex min-h-11 items-center justify-between pt-2">
        <span className="text-headline text-ink">Wattle admin</span>
        <SignOut />
      </div>
      <nav aria-label="Admin sections" className="chrome mt-2 grid h-9 rounded-full bg-surface p-[2px]" style={{ gridTemplateColumns: `repeat(${SECTIONS.length}, minmax(0, 1fr))` }}>
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} aria-current={s.href === active ? "page" : undefined} className={`hit flex items-center justify-center truncate rounded-full px-1 text-footnote text-ink ${s.href === active ? "bg-white font-semibold shadow-[0_3px_8px_rgba(0,0,0,0.12),0_3px_1px_rgba(0,0,0,0.04)]" : ""}`}>
            {s.label}
          </Link>
        ))}
      </nav>
      <h1 className="mt-6 text-large-title text-ink">{title}</h1>
      {sub ? <p className="mt-1 text-subhead text-grey">{sub}</p> : null}
      <div className="mt-6">{children}</div>
    </Screen>
  );
}

export { ScoreBar, Stat } from "./bits";
