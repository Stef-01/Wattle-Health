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
import { Button, Cell, Group, NavBar, Progress, Screen } from "@/src/ui/kit";
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
      { id: "no", label: "No, not a GP", exclude: ["general-practice"] },
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
    const withContext = [s.replace(/[\s.,;!]+$/, ""), ...contextPhrases(s).phrases].join(", ");
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
    // join without doubled punctuation: "…in women. Sydney" + ", whole person care", never "Sydney., whole person"
    const full = phrases.length ? `${sentence!.replace(/[\s.,;!]+$/, "")}, ${phrases.join(", ")}` : sentence!;
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

  /** Shorter flow (2026-10-19): tapping an answer records it and moves on; no Continue tap. */
  function choose(id: string) {
    if (!step) return;
    setPicked(id);
    const option = options.find((o) => o.id === id)!;
    window.setTimeout(() => {
      setAnswers((a) => ({ ...a, [step.id]: option }));
      setIndex((i) => i + 1);
    }, 220);
  }

  // Straight into the first question once the sentence is read; the separate intro screen is gone.
  useEffect(() => {
    if (index === -1 && ctx && steps.length) setIndex(0);
  }, [ctx, steps.length, index]);

  const total = steps.length;
  const progress = index < 0 ? 0 : Math.min(1, (index + (step ? 0 : 1)) / Math.max(1, total));

  return (
    <Screen padBottom="pb-[150px]">
      <NavBar
        back={index <= 0 ? "/" : undefined}
        onBack={index > 0 ? () => setIndex((i) => i - 1) : undefined}
        title={index >= 0 && step ? <span className="tnum">{index + 1} of {total}</span> : undefined}
      />
      <div className="mt-3">
        <Progress step={Math.max(0.0001, progress)} of={1} />
      </div>

      {index < 0 ? (
        <div key="entry" className="rise mt-16 flex flex-col items-center text-center">
          <Orb size={72} />
          <h1 className="mt-10 text-title1 text-ink">A few questions to narrow your search</h1>
          <p className="mt-2 text-body text-grey">Your answers shape who we show you.</p>
          {sentence ? <p className="mt-8 rounded-card bg-surface-soft px-5 py-3 text-body text-ink">“{sentence}”</p> : null}
        </div>
      ) : step ? (
        <div key={step.id} className="rise mt-8">
          <h1 className="text-title1 text-ink">{step.ask}</h1>
          {step.help ? <p className="mt-2 text-body text-grey">{step.help}</p> : null}
          <div role="radiogroup" aria-label={step.ask} className="mt-6">
            <Group tone="soft">
              {options.map((o, i) => (
                <Cell key={o.id} role="radio" selected={picked === o.id} accessory="check" title={o.label} sub={o.sub} onClick={() => choose(o.id)} attrs={{ "data-answer": i }} />
              ))}
            </Group>
          </div>
        </div>
      ) : ctx ? (
        <div key="summary" className="rise mt-8">
          <h1 className="text-title1 text-ink">What we’ll search for</h1>
          <p className="mt-2 text-body text-grey">You can change this on the results page.</p>
          <dl className="mt-6">
            <Group tone="soft">
              <div className="px-4 py-3">
                <dt className="text-footnote text-grey">In your words</dt>
                <dd className="text-body text-ink">{sentence}</dd>
              </div>
              {contextPhrases(sentence ?? "").labels.length ? (
                <div className="px-4 py-3">
                  <dt className="text-footnote text-grey">From your health context</dt>
                  <dd className="text-body text-ink">{contextPhrases(sentence ?? "").labels.join(", ")}</dd>
                </div>
              ) : null}
              {steps.filter((s) => answers[s.id]).map((s) => (
                <div key={s.id} className="px-4 py-3">
                  <dt className="text-footnote text-grey">{s.summary}</dt>
                  <dd className="text-body text-ink">{answers[s.id]!.label}</dd>
                </div>
              ))}
            </Group>
          </dl>
        </div>
      ) : (
        <p className="rise mt-16 text-center text-body text-grey">Reading that…</p>
      )}

      <div className="frame-fixed pointer-events-none bottom-0 z-20">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -top-6 bg-gradient-to-b from-white/0 via-white/90 via-30% to-white" />
        <div className="frame-pad pointer-events-auto relative flex flex-col items-center gap-1 pt-2" style={{ paddingBottom: "var(--dock-pb)" }}>
          {index < 0 ? (
            <>
              <Button full disabled={!ctx} onClick={() => (steps.length ? setIndex(0) : void finish({}))}>Continue</Button>
              <Button kind="plain" size="medium" disabled={!ctx} onClick={() => void finish({})}>Skip to my picks</Button>
            </>
          ) : step ? (
            <Button kind="plain" size="medium" onClick={() => void finish(answers)}>Skip to my picks</Button>
          ) : ctx ? (
            <Button full onClick={() => void finish(answers)}>See your picks</Button>
          ) : null}
        </div>
      </div>
      {searching ? <Searching sentence={searching} /> : null}
    </Screen>
  );
}
