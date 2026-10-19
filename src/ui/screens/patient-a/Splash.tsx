"use client";
// P01 Splash (225:10): green gradient, Lobster wordmark + leaf, "Doctors who listen".
// Tapping anywhere goes home; the flag stops "/" sending the reader back here.
import "@fontsource/lobster/400.css";
import { asset } from "@/src/ui/base-path";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { markSplashSeen } from "@/src/ui/store";

export function Splash() {
  const router = useRouter();
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
      <div className="settle absolute left-[141px] top-[390px] flex items-center gap-[10px]">
        <span className="text-[44px] leading-normal text-white" style={{ fontFamily: '"Lobster", cursive' }}>
          wattle
        </span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset("/figma/leaf.svg")} alt="" width={34} height={34} className="float block size-[34px]" />
      </div>
      <p style={{ animationDelay: "350ms" }} className="settle absolute left-1/2 top-[474px] w-[300px] -translate-x-1/2 text-center text-[20px] font-medium leading-normal text-[#e8e8e8]">Doctors who listen</p>
    </main>
  );
}
