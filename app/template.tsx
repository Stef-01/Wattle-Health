"use client";
import { useLayoutEffect } from "react";

// Re-mounts on every navigation, so each screen eases in (150 ms, ease-out) on client navigations only. At the first
// document load the fade's opacity-0 frame hid the first contentful paint until the next main-thread repaint, the font
// swap (/narrow painted at 2.7 s instead of 0.4 s, 2026-11-08): the first screen now paints as the HTML arrives, and
// `data-navigated` on <html> (stamped as the first template leaves) turns the fade on from then. Reduced motion shortens it.
export default function Template({ children }: { children: React.ReactNode }) {
  useLayoutEffect(() => () => { document.documentElement.dataset.navigated = "1"; }, []);
  return <div className="page-enter">{children}</div>;
}
