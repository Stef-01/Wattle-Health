"use client";
// P02 Home (225:17), Apple pass 2026-10-23: large title, the sentence in a filled field with the
// mic trailing, one action ("Find my provider"), examples and recent searches as inset-grouped lists. Submit runs POST /api/match and goes
// straight to /results (one field, one gate, then cards) with the response parked under a request id.
import { track } from "@vercel/analytics";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, Cell, Clock, Face, FaceStack, FieldBox, Gap, Group, GroupHeader, LargeTitle, Mic, NavBar, Screen, initialsOf } from "@/src/ui/kit";
import { OpeningsBanner } from "@/src/ui/OpeningsBanner";
import { getDraft, getName, getRecent, getRequest as getRecentRequest, setDraft, setRequest, splashSeen, type RecentSearch } from "@/src/ui/store";
import { ADHD_EXAMPLES, EXAMPLES } from "./lib";
import type { AppMode } from "@/src/mode";
import { useMode } from "@/src/ui/brand";
import { ByMode } from "@/src/ui/ByMode";

type Recognition = { lang: string; interimResults: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; start: () => void; stop: () => void };
type RecognitionCtor = new () => Recognition;

function speechCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type Face = { id: string; name: string; url: string };
export type HomeByMode = Record<AppMode, { faces: Face[]; count: number }>;

export function Home({ byMode }: { byMode: HomeByMode }) {
  const mode = useMode();
  const adhd = mode === "adhdme";
  const modes = ["wattle", "adhdme"] as const;
  const router = useRouter();
  const [name, setNameState] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [recent, setRecent] = useState<RecentSearch[]>([]);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [canListen, setCanListen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false); // the title is written once the name is known, so it never swaps on screen
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
    setReady(true);
  }, [router]);

  /** Home only takes the sentence; /narrow asks the follow-up questions and runs the search. */
  async function submit(sentence: string) {
    const s = sentence.trim();
    if (!s || busy) return;
    track("search_started");
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
      <NavBar />
      {/* The avatar slot is always laid out (44 px) so the title sits at the same height with or without a name. The
          generic title is in the server HTML and paints at once; a reader with a stored name (data-named on <html>,
          stamped before paint) sees the slot held until the name is read, then one short fade (motion review, 2026-11-08). */}
      <LargeTitle trailing={initials ? <Link href="/me" aria-label="Your profile" className="press mb-1 inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-ink text-subhead font-semibold text-white">{initials}</Link> : <span aria-hidden="true" className="mb-1 inline-block size-11 shrink-0" />}>
        <span className={ready ? (name ? "fade-in" : undefined) : "pre-title"}>{name ? `Hi, ${display}.` : <ByMode wattle="Who do you need?" adhdme="What ADHD support do you need?" />}</span>
      </LargeTitle>
      <Gap h={16} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(text);
        }}
      >
        <FieldBox className="relative">
          <label className="sr-only" htmlFor="sentence">
            Describe who you need, in your own words
          </label>
          <textarea
            id="sentence"
            name="sentence"
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit(text);
              }
            }}
            placeholder={adhd ? "Assessment, medication, coaching…" : "Tell us what’s going on"}
            className="block w-full resize-none bg-transparent px-4 pb-11 pt-3.5 text-body text-ink outline-none placeholder:text-grey"
          />
          {canListen ? (
            <button type="button" onClick={toggleMic} aria-pressed={listening} aria-label={listening ? "Stop listening" : "Speak instead"} className={`press-dim absolute bottom-0.5 right-0.5 inline-flex size-11 items-center justify-center ${listening ? "text-accent" : "text-grey"}`}>
              <Mic size={22} />
            </button>
          ) : null}
        </FieldBox>
        <Gap h={12} />
        <Button type="submit" full disabled={busy || !text.trim()}>
          Find my provider
        </Button>
      </form>
      {error ? <p className="pt-2 text-subhead text-grey">{error}</p> : null}
      <OpeningsBanner />
      <ByMode
        block
        {...(Object.fromEntries(
          modes.map((m) => [
            m,
            <>
              {byMode[m].faces.length > 0 ? (
                <Link href="/results?all=1" className="chrome press-soft mt-6 flex min-h-11 items-center gap-3" onClick={(e) => { e.preventDefault(); void submit("Someone who listens"); }}>
                  <span className="flex shrink-0 -space-x-2.5">
                    {byMode[m].faces.map((f) => (
                      <Face key={f.id} url={f.url} name={f.name} size={36} ring />
                    ))}
                  </span>
                  <span className="text-pretty text-subhead text-ink">Meet {byMode[m].count} {m === "adhdme" ? "ADHD providers" : "doctors"} in their own words.</span>
                </Link>
              ) : null}
              <GroupHeader>Or try one of these</GroupHeader>
              <Group tone="plain">
                {(m === "adhdme" ? ADHD_EXAMPLES : EXAMPLES).map((ex) => (
                  <Cell key={ex} title={ex} onClick={() => void submit(ex)} />
                ))}
              </Group>
            </>,
          ]),
        ) as { wattle: React.ReactNode; adhdme: React.ReactNode })}
      />
      {recent.length > 0 ? (
        <>
          <GroupHeader>Recent</GroupHeader>
          <Group tone="plain" sep={58}>
            {recent.map((r) => (
              <Cell key={r.id} bare={Boolean(r.faces?.length)} icon={r.faces?.length ? <FaceStack urls={r.faces} size={26} /> : <Clock size={17} />} title={r.label} sub={`${r.matches} ${r.matches === 1 ? "pick" : "picks"}`} href="/results" onClick={() => { const q = getRecentRequest(r.id); if (q) setRequest(q); }} />
            ))}
          </Group>
        </>
      ) : null}
    </Screen>
  );
}
