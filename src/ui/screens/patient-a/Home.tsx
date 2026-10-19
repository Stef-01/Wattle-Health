"use client";
// P02 Home (225:17): greeting + avatar, the sentence field with mic and send, "Try" examples,
// "Recent" rows, "Find my doctor" CTA over the tab bar. Submit runs POST /api/match and goes
// straight to /results (one field, one gate, then cards) with the response parked under a request id.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Clock, Cta, Divider, FaceStack, FieldBox, Gap, Row, Screen, SectionTitle, TabBar, Title, Mic, initialsOf } from "@/src/ui/kit";
import { OpeningsBanner } from "@/src/ui/OpeningsBanner";
import { getDraft, getName, getRecent, getRequest as getRecentRequest, setDraft, setRequest, splashSeen, type RecentSearch } from "@/src/ui/store";
import { EXAMPLES } from "./lib";

type Recognition = { lang: string; interimResults: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; start: () => void; stop: () => void };
type RecognitionCtor = new () => Recognition;

function speechCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type Face = { id: string; name: string; url: string };

export function Home({ faces = [], count = 0 }: { faces?: Face[]; count?: number }) {
  const router = useRouter();
  const [name, setNameState] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [recent, setRecent] = useState<RecentSearch[]>([]);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [canListen, setCanListen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);

  useEffect(() => {
    if (!splashSeen()) {
      router.replace("/splash");
      return;
    }
    setNameState(getName());
    setText(getDraft());
    setRecent(getRecent());
    setCanListen(speechCtor() !== null);
  }, [router]);

  /** Home only takes the sentence; /narrow asks the follow-up questions and runs the search. */
  async function submit(sentence: string) {
    const s = sentence.trim();
    if (!s || busy) return;
    setBusy(true);
    setDraft(s);
    router.push("/narrow");
  }

  function toggleMic() {
    const Ctor = speechCtor();
    if (!Ctor) return;
    if (listening) {
      rec.current?.stop();
      setListening(false);
      return;
    }
    const r = new Ctor();
    r.lang = "en-AU";
    r.interimResults = false;
    r.onresult = (e) => {
      const heard = Array.from({ length: e.results.length }, (_, i) => e.results[i]?.[0]?.transcript ?? "").join(" ").trim();
      if (heard) setText((t) => (t ? `${t} ${heard}` : heard));
    };
    r.onend = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  }

  const display = name?.trim() || "there";
  const initials = name ? initialsOf(name) : "";

  return (
    <Screen padBottom="pb-[110px]">
      <div className="flex items-center justify-between">
        <Title>{name ? `Hi, ${display}.` : "Who do you need?"}</Title>
        {initials ? (
          <span aria-hidden="true" className="inline-flex size-[50px] shrink-0 items-center justify-center rounded-full bg-charcoal font-inter text-[18px] font-semibold text-white">
            {initials}
          </span>
        ) : null}
      </div>
      <Gap h={38} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(text);
        }}
      >
        <FieldBox className="flex flex-col gap-5 px-5 pb-4 pt-5">
          <label className="sr-only" htmlFor="sentence">
            Describe who you need, in your own words
          </label>
          <textarea
            id="sentence"
            name="sentence"
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit(text);
              }
            }}
            placeholder="Endometriosis, someone who listens"
            className="w-full resize-none bg-transparent text-[16px] font-medium leading-[1.5] text-charcoal outline-none placeholder:text-grey"
          />
          <div className="flex items-center justify-between">
            <button type="button" onClick={toggleMic} disabled={!canListen} aria-pressed={listening} aria-label={listening ? "Stop listening" : "Speak instead"} className={listening ? "text-accent" : canListen ? "text-grey" : "text-line"}>
              <Mic size={24} />
            </button>
            <button type="submit" aria-label="Send" disabled={busy} className="inline-flex size-11 items-center justify-center rounded-full bg-charcoal text-white disabled:opacity-50">
              <ArrowRight size={20} />
            </button>
          </div>
        </FieldBox>
      </form>
      {error ? <p className="pt-2 text-[14px] text-grey">{error}</p> : null}
      <Gap h={16} />
      <Cta fixed={false} onClick={() => void submit(text)} disabled={busy || !text.trim()}>
        Find my doctor
      </Cta>
      <OpeningsBanner />
      <Gap h={40} />
      {faces.length > 0 ? (
        <Link href="/results?all=1" className="press press-soft mb-8 flex items-center gap-4" onClick={(e) => { e.preventDefault(); void submit("Someone who listens"); }}>
          <span className="flex shrink-0 -space-x-3">
            {faces.map((f, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={f.id} src={f.url} alt="" referrerPolicy="no-referrer" className="rise size-11 rounded-full border-2 border-white object-cover object-top shadow-[0_2px_6px_rgba(0,0,0,0.12)]" style={{ "--i": i, background: "#e9e9e9" } as React.CSSProperties} />
            ))}
          </span>
          <span className="text-[15px] leading-snug text-charcoal">Meet {count} Queensland doctors in their own words.</span>
        </Link>
      ) : null}
      <p className="text-[14px] text-grey">Or try one of these</p>
      <Gap h={8} />
      {EXAMPLES.map((ex) => (
        <button key={ex} type="button" onClick={() => void submit(ex)} className="press press-soft block w-full border-b border-divider py-3.5 text-left text-[17px] leading-snug text-charcoal">
          {ex}
        </button>
      ))}
      {recent.length > 0 ? (
        <>
          <Gap h={40} />
          <SectionTitle>Recent</SectionTitle>
          <Gap h={8} />
          {recent.map((r) => (
            <div key={r.id}>
              <Row icon={r.faces?.length ? <FaceStack urls={r.faces} /> : <Clock size={17} />} title={r.label} sub={`${r.matches} ${r.matches === 1 ? "match" : "matches"}`} href={`/results`} onClick={() => { const q = getRecentRequest(r.id); if (q) setRequest(q); }} />
              <Divider />
            </div>
          ))}
        </>
      ) : null}
      <TabBar active="/" />
    </Screen>
  );
}
