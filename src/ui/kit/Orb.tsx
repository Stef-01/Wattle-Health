"use client";
// The orb (founder 2026-10-19: "the same orb system that ADHD.me has"). A port of ADHD.me's
// brand-blobs morph (adhd-me/app/brand-blobs.tsx): N vertices on a circle, the five hand-tuned shape
// tables, smoothstep between them, per-vertex drift, a Catmull-Rom closed path, a reduced-motion
// guard that paints one frame, and a pause while the tab is hidden. Wattle paints it in ink, not
// green: two overlapping blobs, charcoal over near-black, so it reads as one living orb.
import { useEffect, useRef } from "react";

const N = 9;
const TAU = Math.PI * 2;
const SHAPES: readonly (readonly number[])[] = [
  [1.0, 0.78, 1.14, 0.86, 1.06, 0.74, 1.18, 0.82, 0.98],
  [0.86, 1.16, 0.8, 1.1, 0.78, 1.2, 0.84, 1.04, 0.92],
  [1.2, 0.92, 1.02, 1.18, 0.84, 0.96, 1.1, 0.78, 1.14],
  [0.92, 1.06, 0.74, 0.98, 1.22, 0.82, 0.94, 1.16, 0.8],
  [1.1, 0.84, 1.2, 0.78, 1.02, 1.14, 0.76, 1.08, 0.96],
];
const ease = (t: number) => t * t * (3 - 2 * t);

function build(pts: readonly (readonly [number, number])[]): string {
  let d = `M${pts[0]![0].toFixed(2)} ${pts[0]![1].toFixed(2)}`;
  for (let i = 0; i < N; i++) {
    const p0 = pts[(i - 1 + N) % N]!;
    const p1 = pts[i]!;
    const p2 = pts[(i + 1) % N]!;
    const p3 = pts[(i + 2) % N]!;
    d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(2)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(2)},${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(2)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(2)},${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return `${d}Z`;
}

const BLOBS = [
  { radius: 34, duration: 3200, offset: 0, drift: 0.16, fill: "#1b1b1b", opacity: 1 },
  { radius: 30, duration: 2600, offset: 1.3, drift: 0.2, fill: "#5a5a5a", opacity: 0.55 },
] as const;

/** A living ink orb; `size` in CSS px. Decorative (aria-hidden). */
export function Orb({ size = 96, className }: { size?: number; className?: string }) {
  const refs = useRef<(SVGPathElement | null)[]>([]);
  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const pts: [number, number][] = Array.from({ length: N }, () => [0, 0]);
    const paint = (elapsed: number) => {
      BLOBS.forEach((b, j) => {
        const path = refs.current[j];
        if (!path) return;
        // A rAF timestamp can precede `start` by a frame; a negative t would index SHAPES[-1].
        const t = Math.max(0, elapsed) + b.offset * 1000;
        const i0 = Math.floor(t / b.duration) % SHAPES.length;
        const k = ease((t % b.duration) / b.duration);
        const a = SHAPES[i0]!;
        const c = SHAPES[(i0 + 1) % SHAPES.length]!;
        const wob = t * 0.001;
        for (let v = 0; v < N; v++) {
          const m = a[v]! + (c[v]! - a[v]!) * k;
          const ang = (v / N) * TAU + Math.sin(wob + v) * b.drift + wob * 0.35;
          const r = b.radius * m * (1 + Math.sin(wob * 1.7 + v * 1.3) * 0.05);
          pts[v] = [Math.cos(ang) * r, Math.sin(ang) * r];
        }
        path.setAttribute("d", build(pts));
      });
    };
    if (reduced) {
      paint(1200);
      return;
    }
    let raf = 0;
    let start = performance.now();
    let pausedAt = 0;
    const loop = (now: number) => {
      paint(now - start);
      raf = requestAnimationFrame(loop);
    };
    const onVis = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        pausedAt = performance.now();
      } else {
        start += performance.now() - pausedAt;
        raf = requestAnimationFrame(loop);
      }
    };
    raf = requestAnimationFrame(loop);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
  return (
    <svg width={size} height={size} viewBox="-50 -50 100 100" aria-hidden="true" className={className} style={{ overflow: "visible" }}>
      {BLOBS.map((b, j) => (
        <path key={j} ref={(el) => { refs.current[j] = el; }} fill={b.fill} opacity={b.opacity} />
      ))}
    </svg>
  );
}
