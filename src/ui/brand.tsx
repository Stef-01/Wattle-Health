"use client";
// The platform name (founder 2026-10-19): one setting switches the whole app between "Wattle" and
// "ADHDme". Stored on this device; every <Brand /> and the tab title follow it live.
import { useEffect, useState } from "react";

export const BRANDS = { wattle: "Wattle", adhdme: "ADHDme" } as const;
export type BrandId = keyof typeof BRANDS;
const KEY = "wattle.brand.v1";

export function getBrand(): BrandId {
  try {
    const v = localStorage.getItem(KEY);
    return v === "adhdme" ? "adhdme" : "wattle";
  } catch {
    return "wattle";
  }
}
export function setBrand(id: BrandId): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new Event("wattle:brand"));
}

export function useBrandName(): string {
  const [id, setId] = useState<BrandId>("wattle");
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
  return BRANDS[id];
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
