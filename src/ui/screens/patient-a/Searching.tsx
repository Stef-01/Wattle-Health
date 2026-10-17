"use client";
// The moment between "Find my doctor" and the results: the sentence replays word by word, a
// wattle-green orb breathes, and the status changes as the search runs. Shown for at least
// 1.4 s so the arrival feels deliberate rather than a flash.
import { useEffect, useState } from "react";

const STEPS = ["Reading what you said", "Finding doctors who fit", "Checking who is taking patients"];

export function Searching({ sentence }: { sentence: string }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 650);
    return () => clearInterval(t);
  }, []);
  const words = sentence.trim().split(/\s+/).slice(0, 40);
  return (
    <div className="frame-fixed inset-y-0 z-40 flex flex-col items-center justify-center bg-white px-8 text-center" role="status" aria-live="polite">
      <div className="search-orb" aria-hidden="true" />
      <p className="mt-12 font-display text-[22px] leading-[1.35] text-ink">
        {words.map((w, i) => (
          <span key={`${w}-${i}`} className="word-in" style={{ "--i": i } as React.CSSProperties}>
            {w}&nbsp;
          </span>
        ))}
      </p>
      <p key={step} className="rise mt-6 text-[15px] text-grey">{STEPS[step]}…</p>
    </div>
  );
}

export const MIN_SEARCH_MS = 1400;
