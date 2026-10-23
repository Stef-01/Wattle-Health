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
    <main
      role="button"
      tabIndex={0}
      aria-label="Continue"
      onClick={() => router.push("/")}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") router.push("/");
      }}
      className="frame cursor-pointer overflow-clip"
      style={{ background: "linear-gradient(180deg, #1b1b1b 0%, #000000 100%)" }}
    >
      <div className="settle absolute inset-x-0 top-[390px] flex items-center justify-center gap-[10px]">
        <span className="text-[44px] text-white" style={{ fontFamily: '"Lobster", cursive' }}>
          {brand === "ADHDme" ? "ADHDme" : "wattle"}
        </span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset("/figma/leaf.svg")} alt="" width={34} height={34} className="float block size-[34px]" />
      </div>
      <p style={{ animationDelay: "350ms" }} className="settle absolute left-1/2 top-[474px] w-[300px] -translate-x-1/2 text-center text-title3 text-[#e8e8e8]">Doctors who listen</p>
    </main>
  );
}
