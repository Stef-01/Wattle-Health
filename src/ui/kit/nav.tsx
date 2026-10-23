"use client";
// The pinned iOS navigation bar and the sticking rule it uses (Apple pass 2026-10-23; behaviour from Apple's
// own web code via REA, docs/apple/REA.md). Kept in its own client module so the rest of the kit stays usable
// from server components.
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "./icons";

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

/** The 44 px glass back circle used by NavBar (same look as the kit's Circle). */
function BackCircle({ href, onClick }: { href?: string; onClick?: () => void }) {
  const cls = "press chrome glass inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink";
  if (href) return <Link href={href} aria-label="Back" className={cls}><ChevronLeft size={22} strokeWidth={2} /></Link>;
  return <button type="button" aria-label="Back" onClick={onClick} className={cls}><ChevronLeft size={22} strokeWidth={2} /></button>;
}

/** Whether a pinned bar has content passing under it: Apple's rule (REA, swift-docc-render module 9065) is
 *  `isSticking = intersectionRatio !== 1` on a sentinel at the bar's resting place, ignoring overscroll.
 *  `ready` turns transitions on only after 8 frames, so the bar never animates on first paint. */
export function useSticking<T extends HTMLElement>() {
  const sentinel = useRef<T>(null);
  const [sticking, setSticking] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (window.scrollY < 0 || !e) return;
      setSticking(e.intersectionRatio !== 1);
    }, { threshold: [0, 1] });
    io.observe(el);
    let frames = 0;
    let raf = 0;
    const tick = () => { if (++frames >= 8) setReady(true); else raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, []);
  return { sentinel, sticking, ready };
}

/** iOS navigation bar, pinned: back circle (chevron only, HIG), centred inline title, trailing items. At the top
 *  of the page it has no background; once content scrolls under it the scroll edge fades in. With `collapse`,
 *  the title shows only then, as a large title does when it scrolls away. */
export function NavBar({ back, onBack, title, right, collapse = false }: { back?: string; onBack?: () => void; title?: ReactNode; right?: ReactNode; collapse?: boolean }) {
  const { sentinel, sticking, ready } = useSticking<HTMLSpanElement>();
  return (
    <>
      <span ref={sentinel} aria-hidden="true" className="block h-px" />
      <div className="chrome bleed sticky top-0 z-20 -mt-px">
        <div aria-hidden="true" className="scroll-edge pointer-events-none absolute inset-x-0 -top-2 h-[64px]" data-on={sticking} data-ready={ready} />
        <div className="relative grid h-11 grid-cols-[minmax(44px,1fr)_auto_minmax(44px,1fr)] items-center gap-2">
          <span className="flex">
            {back || onBack ? (
              <BackCircle href={back} onClick={onBack} />
            ) : null}
          </span>
          <span className={cx("truncate text-center text-headline text-ink", collapse && "transition-opacity duration-200", collapse && !sticking && "opacity-0")} aria-hidden={collapse && !sticking ? true : undefined}>{title}</span>
          <span className="flex justify-end gap-2">{right}</span>
        </div>
      </div>
    </>
  );
}

