"use client";
import { Orb } from "@/src/ui/kit/Orb";
// Guided questions (2026-10-18), reconstructed from Zocdoc SearchAI's shipped mental-health fit
// questionnaire (recovered with REA from the archived searchai bundle; see
// qa/benchmark-zocdoc/archive): entry → specific issue → experience → type of care → medication →
// open to a GP → who → age → video or in person → summary ("Here's what you'll be searching for").
// No insurance. Wattle adds "what matters most", its personal-fit question. Every answer changes
// the search (a phrase the matcher reads, an excluded specialty) or the guidance shown with the
// results; none is asked for show. Questions the sentence already answered are skipped.
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Chip } from "@/src/data/search-types";
import { ArrowLeft, Check, Circle, Cta, Screen } from "@/src/ui/kit";
import { getDraft, setDraft } from "@/src/ui/store";
import { runMatch } from "./lib";
import { contextPhrases } from "@/src/ui/context";
import { MIN_SEARCH_MS, Searching } from "./Searching";

type Option = { id: string; label: string; sub?: string; phrase?: string; exclude?: string[] };
type Ctx = { chips: Chip[]; sentence: string; answers: Record<string, Option> };
type Step = { id: string; ask: string; help?: string; options: (ctx: Ctx) => Option[]; when: (ctx: Ctx) => boolean; summary: string };

const MENTAL = /anxiety|depress|adhd|bipolar|psychosis|personality|trauma|ptsd|eating|ocd|substance|addiction|autism|sleep|perinatal|postnatal|grief|stress/i;
const ADULT_ONLY = /endometriosis|pcos|polycystic|menopause|perimenopause|pelvic|perinatal|postnatal|pregnan/i;

const hasCondition = (c: Ctx) => c.chips.some((x) => x.kind === "condition") || Boolean(c.answers.issue?.phrase);
const isMental = (c: Ctx) => c.chips.some((x) => x.kind === "condition" && MENTAL.test(x.label)) || MENTAL.test(c.answers.issue?.phrase ?? "");
const isAdultOnly = (c: Ctx) => c.chips.some((x) => x.kind === "condition" && ADULT_ONLY.test(x.label)) || ADULT_ONLY.test(c.answers.issue?.phrase ?? "");
const hasPopulation = (c: Ctx) => c.chips.some((x) => x.kind === "population");

const STEPS: Step[] = [
  {
    id: "issue",
    ask: "What would you like help with?",
    summary: "Issue",
    when: (c) => !c.chips.some((x) => x.kind === "condition"),
    options: () => [
      { id: "anxiety", label: "Anxiety", phrase: "anxiety" },
      { id: "depression", label: "Depression", phrase: "depression" },
      { id: "adhd", label: "ADHD", phrase: "ADHD" },
      { id: "endo", label: "Endometriosis or pelvic pain", phrase: "endometriosis and pelvic pain" },
      { id: "menopause", label: "Menopause or perimenopause", phrase: "menopause" },
      { id: "pcos", label: "PCOS", phrase: "PCOS" },
      { id: "perinatal", label: "Pregnancy or after the birth", phrase: "postnatal" },
      { id: "pain", label: "Persistent pain or fibromyalgia", phrase: "fibromyalgia and chronic pain" },
      { id: "fatigue", label: "Chronic fatigue, POTS or long COVID", phrase: "chronic fatigue" },
      { id: "else", label: "Something else", phrase: "" },
    ],
  },
  {
    id: "experience",
    ask: "Have you had care for this before?",
    summary: "Experience",
    when: hasCondition,
    options: () => [
      { id: "first", label: "No, this is my first time" },
      { id: "before", label: "Yes, I’ve seen someone before" },
      { id: "change", label: "I see someone now and want a change" },
    ],
  },
  {
    id: "care",
    ask: "What kind of care do you want?",
    summary: "Type of care",
    when: isMental,
    options: () => [
      { id: "medication", label: "Medication, or a review of it", sub: "Psychiatrists and GPs" },
      { id: "assessment", label: "An assessment or diagnosis", sub: "Such as ADHD or autism" },
      { id: "talk", label: "Talking it through", sub: "Psychologists and counsellors, with a GP referral" },
      { id: "start", label: "I’d like to talk to someone first" },
      { id: "either", label: "I’m open to either" },
    ],
  },
  {
    id: "meds",
    ask: "What do you need with medication?",
    summary: "Medication",
    when: (c) => c.answers.care?.id === "medication",
    options: () => [
      { id: "new", label: "Starting something new" },
      { id: "review", label: "Reviewing or refilling what I take now" },
    ],
  },
  {
    id: "gp",
    ask: "Are you open to seeing a GP?",
    help: "A GP can often renew a script you already have. Some GPs diagnose and prescribe for common conditions.",
    summary: "Open to a GP",
    when: (c) => c.answers.care?.id === "medication" || c.answers.care?.id === "assessment",
    options: () => [
      { id: "yes", label: "Yes, a GP is fine" },
      { id: "no", label: "No, a specialist only", exclude: ["general-practice"] },
    ],
  },
  {
    id: "who",
    ask: "Who is the appointment for?",
    summary: "For",
    when: (c) => !hasPopulation(c),
    options: () => [
      { id: "me", label: "Me" },
      { id: "else", label: "Someone else" },
    ],
  },
  {
    id: "age",
    ask: "How old is the patient?",
    help: "For someone else, give their age.",
    summary: "Age",
    when: (c) => !hasPopulation(c),
    options: (c) =>
      [
        { id: "child", label: "Under 12", phrase: "for my child" },
        { id: "teen", label: "12 to 17", phrase: "for my teenager" },
        { id: "adult", label: "18 to 64" },
        { id: "older", label: "65 or older", phrase: "elderly" },
      ].filter((o) => !(o.id === "child" && isAdultOnly(c))),
  },
  {
    id: "how",
    ask: "Would you like to meet by video or in person?",
    summary: "Appointment",
    when: (c) => !/telehealth|video|online/i.test(c.sentence),
    options: () => [
      { id: "person", label: "In person" },
      { id: "video", label: "Video", phrase: "telehealth only" },
      { id: "either", label: "I’m open to either", phrase: "telehealth is fine" },
    ],
  },
  {
    id: "matters",
    ask: "What matters most to you in a doctor?",
    summary: "What matters",
    when: (c) => !c.chips.some((x) => x.kind === "human"),
    options: () => [
      { id: "listen", label: "They really listen", phrase: "someone who really listens" },
      { id: "lived", label: "They’ve been through it too", phrase: "lived experience" },
      { id: "long", label: "Longer appointments", phrase: "longer appointments" },
      { id: "whole", label: "They look at the whole picture", phrase: "whole person care" },
      { id: "research", label: "Up to date with research", phrase: "up to date with research" },
    ],
  },
];

export function Narrow() {
  const router = useRouter();
  const [sentence, setSentence] = useState<string | null>(null);
  const [chips, setChips] = useState<Chip[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, Option>>({});
  const [index, setIndex] = useState(-1); // -1 entry, steps.length = summary
  const [picked, setPicked] = useState<string | null>(null);
  const [searching, setSearching] = useState<string | null>(null);

  useEffect(() => {
    const s = getDraft().trim();
    if (!s) return router.replace("/");
    setSentence(s);
    const withContext = [s, ...contextPhrases(s).phrases].join(", ");
    runMatch({ sentence: withContext })
      .then((req) => setChips(req.response.chips))
      .catch(() => setChips([]));
  }, [router]);

  const ctx: Ctx | null = chips && sentence ? { chips, sentence, answers } : null;
  const steps = useMemo(() => (ctx ? STEPS.filter((s) => s.when(ctx)) : []), [chips, sentence, answers]); // eslint-disable-line react-hooks/exhaustive-deps
  const step = index >= 0 && index < steps.length ? steps[index]! : null;
  const options = step && ctx ? step.options(ctx) : [];

  useEffect(() => setPicked(step ? (answers[step.id]?.id ?? null) : null), [index]); // eslint-disable-line react-hooks/exhaustive-deps

  async function finish(final: Record<string, Option>) {
    const ctxWords = contextPhrases(sentence ?? "");
    const phrases = [...Object.values(final).map((o) => o.phrase).filter(Boolean), ...ctxWords.phrases];
    const exclude = Object.values(final).flatMap((o) => o.exclude ?? []);
    const full = phrases.length ? `${sentence}, ${phrases.join(", ")}` : sentence!;
    const summary = [...steps.filter((s) => final[s.id]).map((s) => ({ ask: s.summary, answer: final[s.id]!.label })), ...(ctxWords.labels.length ? [{ ask: "From your health context", answer: ctxWords.labels.join(", ") }] : [])];
    setSearching(full);
    setDraft(full);
    const started = Date.now();
    try {
      await runMatch({ sentence: full, exclude, answers: summary });
    } finally {
      const wait = MIN_SEARCH_MS - (Date.now() - started);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      router.push("/results");
    }
  }

  function next() {
    if (!step || !picked) return;
    const option = options.find((o) => o.id === picked)!;
    setAnswers((a) => ({ ...a, [step.id]: option }));
    setIndex((i) => i + 1);
  }

  const total = steps.length;
  const progress = index < 0 ? 0 : Math.min(1, (index + (step ? 0 : 1)) / Math.max(1, total));

  return (
    <Screen padBottom="pb-[150px]">
      <div className="flex h-11 items-center justify-between">
        {index < 0 ? <Circle href="/" label="Back"><ArrowLeft size={20} /></Circle> : <Circle onClick={() => setIndex((i) => i - 1)} label="Back"><ArrowLeft size={20} /></Circle>}
        {index >= 0 && step ? <span className="text-[14px] text-grey">{index + 1} of {total}</span> : null}
      </div>
      <div className="mt-5 h-1 w-full overflow-hidden rounded-full bg-surface" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
        <div className="bar-fill h-full w-full rounded-full" style={{ transform: `scaleX(${progress})`, background: "#1b1b1b" }} />
      </div>

      {index < 0 ? (
        <div key="entry" className="rise mt-16 flex flex-col items-center text-center">
          <Orb size={72} />
          <h1 className="mt-10 text-[26px] leading-[1.25] tracking-[-0.015em] text-ink">A few questions to narrow your search</h1>
          <p className="mt-3 text-[16px] leading-[1.5] text-grey">Your answers shape who we show you.</p>
          {sentence ? <p className="mt-8 rounded-[6px] bg-surface-soft px-5 py-3 text-[15px] leading-[1.45] text-charcoal">“{sentence}”</p> : null}
        </div>
      ) : step ? (
        <div key={step.id} className="rise mt-10">
          <h1 className="text-[26px] leading-[1.25] tracking-[-0.015em] text-ink">{step.ask}</h1>
          {step.help ? <p className="mt-3 text-[15px] leading-[1.5] text-grey">{step.help}</p> : null}
          <div role="radiogroup" aria-label={step.ask} className="mt-7 flex flex-col gap-2.5">
            {options.map((o, i) => {
              const on = picked === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  data-answer={i}
                  onClick={() => setPicked(o.id)}
                  className={`rise press press-soft flex w-full items-center gap-4 rounded-[6px] border px-5 py-4 text-left ${on ? "border-[#1b1b1b] bg-[#f4f4f4]" : "border-hairline bg-white"}`}
                  style={{ "--i": i } as React.CSSProperties}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[17px] text-ink">{o.label}</span>
                    {o.sub ? <span className="block text-[14px] text-grey">{o.sub}</span> : null}
                  </span>
                  <span aria-hidden="true" className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full border ${on ? "border-[#1b1b1b] bg-[#1b1b1b] text-white" : "border-hairline text-transparent"}`}>
                    <Check size={13} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : ctx ? (
        <div key="summary" className="rise mt-10">
          <h1 className="text-[26px] leading-[1.25] tracking-[-0.015em] text-ink">What we’ll search for</h1>
          <p className="mt-3 text-[15px] text-grey">You can change this on the results page.</p>
          <dl className="mt-6 rounded-[22px] px-5 py-2" style={{ background: "#f4f4f4" }}>
            <div className="border-b border-[#e3ebe5] py-3">
              <dt className="text-[13px] text-grey">In your words</dt>
              <dd className="text-[16px] text-ink">{sentence}</dd>
            </div>
            {contextPhrases(sentence ?? "").labels.length ? (
              <div className="border-b border-[#e3ebe5] py-3">
                <dt className="text-[13px] text-grey">From your health context</dt>
                <dd className="text-[16px] text-ink">{contextPhrases(sentence ?? "").labels.join(", ")}</dd>
              </div>
            ) : null}
            {steps.filter((s) => answers[s.id]).map((s) => (
              <div key={s.id} className="border-b border-[#e3ebe5] py-3 last:border-b-0">
                <dt className="text-[13px] text-grey">{s.summary}</dt>
                <dd className="text-[16px] text-ink">{answers[s.id]!.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : (
        <p className="rise mt-16 text-center font-display text-[22px] text-grey">Reading that…</p>
      )}

      <div className="frame-fixed pointer-events-none bottom-0 z-20 bg-white">
        <div className="frame-pad pointer-events-auto flex flex-col items-center gap-3 pb-[26px] pt-3">
          {index < 0 ? (
            <>
              <Cta fixed={false} disabled={!ctx} onClick={() => (steps.length ? setIndex(0) : void finish({}))}>Continue</Cta>
              <button type="button" disabled={!ctx} onClick={() => void finish({})} className="press-dim text-[15px] text-accent">Skip to my matches</button>
            </>
          ) : step ? (
            <>
              <Cta fixed={false} disabled={!picked} onClick={next}>Continue</Cta>
              <button type="button" onClick={() => void finish(answers)} className="press-dim text-[15px] text-accent">Skip to my matches</button>
            </>
          ) : ctx ? (
            <Cta fixed={false} onClick={() => void finish(answers)}>See your matches</Cta>
          ) : null}
        </div>
      </div>
      {searching ? <Searching sentence={searching} /> : null}
    </Screen>
  );
}
