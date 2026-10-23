"use client";
// C05 Interview question (Figma 227:184). Speech uses the browser's Web Speech API only; no server.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Cta, Screen } from "@/src/ui/kit";
import { Asset, DevBanner, StepHeader, StepProgress, StepTitle } from "./parts";
import { QUESTIONS, TOTAL, useJoin } from "./session";

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
};

function recogniser(): Recognition | null {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export function QuestionScreen({ n }: { n: number }) {
  const q = QUESTIONS.find((x) => x.n === n) ?? QUESTIONS[0]!;
  const { state, update, ready } = useJoin();
  const router = useRouter();
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [speechOk, setSpeechOk] = useState(true);
  const rec = useRef<Recognition | null>(null);

  useEffect(() => {
    if (!ready) return;
    setText(state.answers[n]?.raw ?? "");
  }, [ready, n]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => rec.current?.stop(), []);

  function toggleMic() {
    if (listening) {
      rec.current?.stop();
      setListening(false);
      return;
    }
    const r = recogniser();
    if (!r) {
      setSpeechOk(false);
      return;
    }
    r.lang = "en-AU";
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e) => {
      let add = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res?.isFinal) add += ` ${res[0]?.transcript ?? ""}`;
      }
      if (add.trim()) setText((t) => `${t} ${add.trim()}`.trim());
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    r.start();
    setListening(true);
  }

  function next() {
    rec.current?.stop();
    update((s) => ({ answers: { ...s.answers, [n]: { raw: text, draft: s.answers[n]?.draft ?? "", show: s.answers[n]?.show ?? true } } }));
    router.push(`/join/draft/${n}`);
  }

  return (
    <Screen>
      <StepHeader back={n === 1 ? "/join/interview" : `/join/draft/${n - 1}`} right={`${n} of ${TOTAL}`} />
      <div className="h-6" />
      <StepProgress step={n} of={TOTAL} />
      <div className="h-10" />
      <DevBanner backend={ready ? state.backend : undefined} />
      <StepTitle size={26} sub="Rough is fine. We’ll tidy it with you.">{q.text}</StepTitle>
      <div className="h-8" />
      <label className="field block h-[220px] w-full rounded-card bg-surface px-4 py-3.5">
        <span className="sr-only">Your answer</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={listening ? "Listening…" : "Type, or tap the mic."}
          className="size-full resize-none bg-transparent text-body leading-read text-charcoal outline-none placeholder:text-grey/60"
        />
      </label>
      {!speechOk ? <p role="status" className="mt-3 text-subhead text-grey">This browser has no speech input. Typing works.</p> : null}
      <Cta
        onClick={next}
        disabled={!text.trim()}
       
        secondary={
          <button type="button" onClick={toggleMic} aria-pressed={listening} aria-label={listening ? "Stop listening" : "Speak your answer"} className={["inline-flex size-[66px] shrink-0 items-center justify-center rounded-cta", listening ? "bg-charcoal" : "bg-surface"].join(" ")}>
            <Asset name="mic-26" size={26} className={listening ? "invert" : undefined} />
          </button>
        }
      >
        Next
      </Cta>
    </Screen>
  );
}
