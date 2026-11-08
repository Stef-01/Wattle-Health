"use client";
// Lets a server page stay static while still differing by mode: it renders both modes' markup at
// build time and this picks one by the cookie in the browser. Reading the cookie on the server made
// About and Coverage per-request function calls (4 to 5 s cold on Vercel) for a line of text.
import type { ReactNode } from "react";
import { useMode } from "@/src/ui/brand";

export function ByMode({ wattle, adhdme }: { wattle: ReactNode; adhdme: ReactNode }) {
  return <>{useMode() === "adhdme" ? adhdme : wattle}</>;
}
