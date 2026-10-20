"use client";
// The persistent bottom nav (founder 2026-10-20): one tab bar for every browsing screen, mounted
// once in the layout so it never re-animates between pages. Focused flows (splash, guided
// questions, join, team) hide it. --nav-h tells docks and frames how much room it takes.
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { TabBar } from "./kit";

const HIDDEN = ["/splash", "/narrow", "/join", "/claim", "/team", "/adjust"];

function activeFor(path: string): "/" | "/recent" | "/saved" | "/me" {
  if (path.startsWith("/recent")) return "/recent";
  if (path.startsWith("/saved")) return "/saved";
  if (path.startsWith("/me")) return "/me";
  return "/";
}

export function AppNav() {
  const path = usePathname() ?? "/";
  const hidden = HIDDEN.some((h) => path.startsWith(h));
  useEffect(() => {
    document.documentElement.style.setProperty("--nav-h", hidden ? "0px" : "calc(64px + env(safe-area-inset-bottom))");
  }, [hidden]);
  return hidden ? null : <TabBar active={activeFor(path)} />;
}
