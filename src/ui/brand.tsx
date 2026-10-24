"use client";
// The platform name and mode (founder 2026-10-19; a real mode since 2026-10-24, src/mode.ts). One
// setting switches the whole app between Wattle and ADHDme: the name, and in ADHDme mode the
// roster, the copy and the surfaces too. The `wattle.mode` cookie is the source of truth because
// the server reads it; localStorage keeps the old key in step for screens that read it directly.
import { useEffect, useState } from "react";
import { defaultMode, MODE_COOKIE, MODES, parseMode, type AppMode } from "@/src/mode";

export const BRANDS = MODES;
export type BrandId = AppMode;
const KEY = "wattle.brand.v1";

function cookieMode(): AppMode | null {
  if (typeof document === "undefined") return null;
  const hit = document.cookie.split(/;\s*/).find((c) => c.startsWith(`${MODE_COOKIE}=`));
  return parseMode(hit?.slice(MODE_COOKIE.length + 1));
}

export function getBrand(): BrandId {
  const fromCookie = cookieMode();
  if (fromCookie) return fromCookie;
  try {
    return parseMode(localStorage.getItem(KEY)) ?? defaultMode();
  } catch {
    return defaultMode();
  }
}

export function setBrand(id: BrandId): void {
  document.cookie = `${MODE_COOKIE}=${id}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new Event("wattle:brand"));
}

/** The current mode, live. */
export function useMode(): AppMode {
  const [id, setId] = useState<AppMode>(defaultMode());
  useEffect(() => {
    const sync = () => setId(getBrand());
    sync();
    window.addEventListener("wattle:brand", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("wattle:brand", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return id;
}

export function useBrandName(): string {
  return BRANDS[useMode()];
}

/** Renders the current platform name. */
export function Brand() {
  return <>{useBrandName()}</>;
}

/** Keeps document.title on the chosen name (page titles are written as "… · Wattle"). */
export function BrandTitle() {
  const name = useBrandName();
  useEffect(() => {
    const fix = () => {
      if (name !== "Wattle" && document.title.includes("Wattle")) document.title = document.title.replace(/Wattle( Health)?/g, name);
    };
    fix();
    const t = window.setInterval(fix, 400);
    return () => window.clearInterval(t);
  }, [name]);
  return null;
}
