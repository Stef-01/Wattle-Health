"use client";
// The narrowing conversation (2026-10-17). The person's sentence sits on the right; Wattle asks
// up to three short questions on the left, skipping any the sentence already answered. Each
// answer appends a plain phrase the matcher already understands, so the final search is just a
// fuller sentence. Then the searching screen, then one match at a time on /results.
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Chip } from "@/src/data/search-types";
import { ArrowLeft, Circle, Screen } from "@/src/ui/kit";
import { getDraft, setDraft } from "@/src/ui/store";
import { runMatch } from "./lib";
import { MIN_SEARCH_MS, Searching } from "./Searching";

type Option = { label: string; phrase: string };
type Question = { id: string; ask: string; options: Option[]; skip: (chips: Chip[], sentence: string) => boolean; offer?: (chips: Chip[]) => Option[] };

const ADULT_ONLY = /endometriosis|pcos|polycystic|menopause|perimenopause|pelvic|perinatal|postnatal/i;

const QUESTIONS: Question[] = [
  {
    id: "who",
    ask: "Who is this for?",
    options: [
      { label: "Me", phrase: "" },
      { label: "My child", phrase: "for my child" },
      { label: "My teenager", phrase: "for my teenager" },
      { label: "Me, during or after a pregnancy", phrase: "postnatal" },
    ],
    skip: (chips) => chips.some((c) => c.kind === "population"),
    // A women's health condition is not something to ask about a child.
    offer: (chips) => {
      const all = QUESTIONS[0]!.options;
      return chips.some((c) => c.kind === "condition" && ADULT_ONLY.test(c.label)) ? all.filter((o) => !/child/i.test(o.label)) : all;
    },
  },
  {
    id: "how",
    ask: "How would you like to see them?",
    options: [
      { label: "In person, near Brisbane", phrase: "" },
      { label: "Telehealth is fine", phrase: "telehealth is fine" },
      { label: "Telehealth only", phrase: "telehealth only" },
    ],
    skip: (_chips, s) => /telehealth|video|online/i.test(s),
  },
  {
    id: "matters",
    ask: "What matters most in how they work with you?",
    options: [
      { label: "They really listen", phrase: "someone who really listens" },
      { label: "They have been through it too", phrase: "lived experience" },
      { label: "Longer appointments", phrase: "longer appointments" },
      { label: "They look at the whole picture", phrase: "whole person care" },
      { label: "Up to date with research", phrase: "up to date with research" },
    ],
    skip: (chips) => chips.some((c) => c.kind === "human"),
  },
];

type Turn = { q: Question; answer?: Option };

export function Narrow() {
  const router = useRouter();
  const [sentence, setSentence] = useState<string | null>(null);
  const [chips, setChips] = useState<Chip[] | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [searching, setSearching] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const s = getDraft().trim();
    if (!s) return router.replace("/");
    setSentence(s);
    // A first read of the sentence decides which questions are already answered.
    runMatch({ sentence: s })
      .then((req) => setChips(req.response.chips))
      .catch(() => setChips([]));
  }, [router]);

  const queue = useMemo(() => (chips && sentence ? QUESTIONS.filter((q) => !q.skip(chips, sentence)) : []), [chips, sentence]);

  useEffect(() => {
    if (!chips || !sentence) return;
    if (queue.length === 0) void finish([]);
    else setTurns([{ q: queue[0]! }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue]);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  async function finish(answered: Turn[]) {
    const extra = answered.map((t) => t.answer?.phrase).filter(Boolean).join(", ");
    const full = extra ? `${sentence}, ${extra}` : sentence!;
    setSearching(full);
    setDraft(full);
    const started = Date.now();
    try {
      await runMatch({ sentence: full });
    } finally {
      const wait = MIN_SEARCH_MS - (Date.now() - started);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      router.push("/results");
    }
  }

  function answer(option: Option) {
    const next = turns.slice();
    next[next.length - 1] = { ...next[next.length - 1]!, answer: option };
    const remaining = queue[next.length];
    if (remaining) setTurns([...next, { q: remaining }]);
    else {
      setTurns(next);
      setTimeout(() => void finish(next), 450);
    }
  }

  const current = turns[turns.length - 1];
  const step = turns.length;

  return (
    <Screen padBottom="pb-[60px]">
      <div className="flex h-11 items-center justify-between">
        <Circle href="/" label="Back"><ArrowLeft size={20} /></Circle>
        {queue.length > 0 ? <span className="text-[14px] text-grey">{Math.min(step, queue.length)} of {queue.length}</span> : null}
      </div>
      <div className="mt-8 flex flex-col gap-5">
        {sentence ? (
          <p className="rise ml-auto max-w-[85%] rounded-[22px] rounded-br-[6px] bg-ink px-5 py-3.5 text-[16px] leading-[1.45] text-white">{sentence}</p>
        ) : null}
        {chips === null && sentence ? <p className="rise font-display text-[22px] text-grey">Reading that…</p> : null}
        {turns.map((t, i) => (
          <div key={t.q.id} className="flex flex-col gap-5">
            <p className="rise max-w-[90%] font-display text-[24px] leading-[1.25] text-ink" style={{ "--i": 1 } as React.CSSProperties}>
              {i === 0 ? "Thanks. " : ""}
              {t.q.ask}
            </p>
            {t.answer ? (
              <p className="rise ml-auto max-w-[85%] rounded-[22px] rounded-br-[6px] bg-ink px-5 py-3.5 text-[16px] leading-[1.45] text-white">{t.answer.label}</p>
            ) : null}
          </div>
        ))}
        {current && !current.answer && !searching ? (
          <div className="flex flex-col gap-2.5">
            {(current.q.offer ? current.q.offer(chips ?? []) : current.q.options).map((o, i) => (
              <button
                key={o.label}
                type="button"
                data-answer={i}
                onClick={() => answer(o)}
                className="rise press press-soft w-full rounded-[18px] border border-hairline bg-white px-5 py-4 text-left text-[17px] text-charcoal"
                style={{ "--i": i + 2 } as React.CSSProperties}
              >
                {o.label}
              </button>
            ))}
            <button type="button" onClick={() => void finish(turns.filter((t) => t.answer))} className="press-dim mt-2 self-start text-[15px] text-accent">
              Skip, show my match
            </button>
          </div>
        ) : null}
        <div ref={end} />
      </div>
      {searching ? <Searching sentence={searching} /> : null}
    </Screen>
  );
}
