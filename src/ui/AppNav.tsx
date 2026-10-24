"use client";
// The persistent bottom nav (founder 2026-10-20): one tab bar for every browsing screen, mounted
// once in the layout so it never re-animates between pages. Focused flows (splash, guided
// questions, join, team) hide it. --nav-h tells frames and docks how much room the floating bar
// takes (62 tall, --tab-gap above the edge, 8 clear above it); --dock-pb is the space under a CTA.
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { TabBar } from "./kit";

const HIDDEN = ["/splash", "/narrow", "/join", "/claim", "/team", "/adjust", "/admin"];

function activeFor(path: string): "/" | "/recent" | "/saved" | "/me" {
  if (path.startsWith("/recent")) return "/recent";
  if (path.startsWith("/saved")) return "/saved";
  // Pages opened from Profile keep Profile selected (wayfinding: where am I?).
  if (path.startsWith("/me") || path.startsWith("/about") || path.startsWith("/healthspan")) return "/me";
  return "/";
}

export function AppNav() {
  const path = usePathname() ?? "/";
  const hidden = HIDDEN.some((h) => path.startsWith(h));
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty("--nav-h", hidden ? "0px" : "calc(62px + var(--tab-gap) + 8px)");
    root.setProperty("--dock-pb", hidden ? "max(16px, env(safe-area-inset-bottom))" : "8px");
  }, [hidden]);
  // iOS Safari only applies :active (every press state here) once a touch listener exists.
  useEffect(() => {
    const noop = () => {};
    document.addEventListener("touchstart", noop, { passive: true });
    return () => document.removeEventListener("touchstart", noop);
  }, []);
  return hidden ? null : <TabBar active={activeFor(path)} />;
}
