"use client";
// The moving thumb under a selected segment, tab or tab-bar item: it slides to the selected child
// instead of each child painting its own background, so a change of selection reads as one object
// moving (iOS segmented controls, the iOS 26 tab bar lens). Measured from the selected child's box,
// so it works with equal and content-sized columns alike; transform only, so it stays on the GPU.
// Until it has measured (server HTML, no script yet) the selected child paints its own fill: see
// `.thumb-track` in app/globals.css.
import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";

export function useThumb<T extends HTMLElement>(selectedKey: string | number) {
  const track = useRef<T>(null);
  const [box, setBox] = useState<{ x: number; w: number } | null>(null);
  useLayoutEffect(() => {
    const el = track.current;
    if (!el) return;
    const measure = () => {
      const on = el.querySelector<HTMLElement>("[data-thumb-on='true']");
      if (!on) return setBox(null);
      // Fractional positions (minmax columns split 392 px three ways), measured against the padding edge.
      const t = el.getBoundingClientRect();
      const r = on.getBoundingClientRect();
      setBox({ x: r.left - t.left - el.clientLeft, w: r.width });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    for (const child of el.children) if (child instanceof HTMLElement && !child.hasAttribute("data-thumb")) ro.observe(child);
    void document.fonts?.ready.then(measure);
    return () => ro.disconnect();
  }, [selectedKey]);
  return { track, box };
}

/** The thumb itself: absolutely placed in a `relative .thumb-track`, under the children (`z-0`), inset by the track padding. */
export function Thumb({ box, className, inset = 2 }: { box: { x: number; w: number } | null; className?: string; inset?: number }) {
  if (!box) return null;
  const style: CSSProperties = { top: inset, bottom: inset, left: 0, width: box.w, transform: `translateX(${box.x}px)` };
  return <span aria-hidden="true" data-thumb="" className={`pointer-events-none absolute z-0 rounded-full transition-[transform,width] duration-(--duration-base) ease-(--ease-out) motion-reduce:transition-none ${className ?? ""}`} style={style} />;
}
