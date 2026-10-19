"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_WEIGHTS } from "@/src/data/search-types";
import { getAsk, setAsk } from "./store";

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type RecognitionCtor = new () => Recognition;

function recogniser(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function AskForm() {
  const router = useRouter();
  const [sentence, setSentence] = useState("");
  const [suburb, setSuburb] = useState("Brisbane");
  const [canSpeak, setCanSpeak] = useState(false);
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);

  useEffect(() => {
    const prior = getAsk();
    if (prior) {
      setSentence(prior.sentence);
      setSuburb(prior.suburb);
    }
    setCanSpeak(recogniser() !== null);
  }, []);

  function speak() {
    if (listening) {
      rec.current?.stop();
      return;
    }
    const Ctor = recogniser();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = "en-AU";
    r.interimResults = false;
    r.continuous = false;
    r.onresult = (e) => {
      const heard = Array.from(e.results, (alt) => alt[0]?.transcript ?? "").join(" ").trim();
      if (heard) setSentence((s) => (s ? `${s} ${heard}` : heard));
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = sentence.trim();
    if (!text) return;
    setAsk({ sentence: text, suburb: suburb.trim() || "Brisbane", removed: [], weights: DEFAULT_WEIGHTS });
    router.push("/results");
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className="display text-2xl sm:text-3xl">Tell us what you&rsquo;re looking for in a doctor.</span>
        <div className="relative">
          <textarea
            name="sentence"
            value={sentence}
            onChange={(e) => setSentence(e.target.value)}
            rows={5}
            required
            maxLength={1200}
            autoComplete="off"
            className="w-full resize-y rounded-card border border-line bg-white p-4 pr-14 text-base leading-relaxed outline-none focus:border-foliage"
          />
          {canSpeak && (
            <button
              type="button"
              onClick={speak}
              aria-pressed={listening}
              aria-label={listening ? "Stop listening" : "Speak instead"}
              className={`absolute right-2 top-2 flex size-11 items-center justify-center rounded-full border ${listening ? "border-foliage bg-foliage text-paper" : "border-line bg-paper text-foliage"}`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
              </svg>
            </button>
          )}
        </div>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-soft">Suburb or postcode</span>
        <input
          name="suburb"
          value={suburb}
          onChange={(e) => setSuburb(e.target.value)}
          autoComplete="off"
          className="min-h-11 rounded-card border border-line bg-white px-3 text-base outline-none focus:border-foliage"
        />
      </label>
      <button type="submit" className="min-h-12 rounded-full bg-foliage px-6 text-base font-medium text-paper transition-transform active:scale-[0.99]">
        Find my providers
      </button>
      <p className="text-xs text-ink-soft">Leave out names. If someone is in danger now, call 000.</p>
    </form>
  );
}
