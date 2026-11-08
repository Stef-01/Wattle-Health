"use client";
// The moving thumb under a selected segment, tab or tab-bar item: it slides to the selected child
// instead of each child painting its own background, so a change of selection reads as one object
// moving (iOS segmented controls, the iOS 26 tab bar lens). Measured from the selected child's box,
// so it works with equal and content-sized columns alike; transform only, so it stays on the GPU.
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
      setBox({ x: on.offsetLeft, w: on.offsetWidth });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [selectedKey]);
  return { track, box };
}

/** The thumb itself: absolutely placed in a `relative` track, under the children (`z-0`), inset by the track padding. */
export function Thumb({ box, className, inset = 2 }: { box: { x: number; w: number } | null; className?: string; inset?: number }) {
  if (!box) return null;
  const style: CSSProperties = { top: inset, bottom: inset, left: 0, width: box.w, transform: `translateX(${box.x}px)` };
  return <span aria-hidden="true" className={`pointer-events-none absolute z-0 rounded-full transition-[transform,width] duration-(--duration-base) ease-(--ease-out) motion-reduce:transition-none ${className ?? ""}`} style={style} />;
}
