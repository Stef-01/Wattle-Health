"use client";
import { useBrandName } from "@/src/ui/brand";
// P01 Splash (225:10): green gradient, Lobster wordmark + leaf, "Doctors who listen".
// Tapping anywhere goes home; the flag stops "/" sending the reader back here.
import "@fontsource/lobster/400.css";
import { asset } from "@/src/ui/base-path";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { markSplashSeen } from "@/src/ui/store";

export function Splash() {
  const router = useRouter();
  const brand = useBrandName();
  useEffect(() => {
    markSplashSeen();
    router.prefetch("/");
  }, [router]);
  return (
    <main className="frame relative overflow-clip" style={{ background: "linear-gradient(180deg, var(--color-splash) 0%, var(--color-splash-deep) 100%)" }}>
      {/* The whole screen is one button, laid over the artwork: a real <button>, so assistive tech and
          Lighthouse read it as one, and <main> stays a landmark (aria-allowed-role). */}
      <button type="button" aria-label="Continue" onClick={() => router.push("/")} className="absolute inset-0 z-10 cursor-pointer outline-none" />
      {/* The wordmark is visible from the first paint (an element that starts at opacity 0 is never the
          largest contentful paint); only the tagline settles in. */}
      <div className="absolute inset-x-0 top-[390px] flex items-center justify-center gap-[10px]">
        <span className="text-wordmark text-white" style={{ fontFamily: '"Lobster", cursive' }}>
          {brand === "ADHDme" ? "ADHDme" : "wattle"}
        </span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset("/figma/leaf.svg")} alt="" width={34} height={34} className="block size-[34px]" />
      </div>
      <p style={{ animationDelay: "350ms" }} className="settle absolute left-1/2 top-[474px] w-[300px] -translate-x-1/2 text-center text-title3 text-splash-text">Doctors who listen</p>
    </main>
  );
}
