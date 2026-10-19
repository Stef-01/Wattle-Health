"use client";
// Settings › Discover (2026-10-18): guided flows into newer, concierge-style care that most people
// don't know exists: doctor-led biomarker analysis, consults that use your wearable data, and
// holistic menopause care. Three short questions, then real Australian services that fit, each
// with what you get, price and a link to their own site. Listings are facts from each provider's
// website (data/discover/offerings.json); Wattle does not endorse or take payment from them.
import { useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronRight, Circle, Cta, Screen } from "@/src/ui/kit";
import { Healthspan } from "./Healthspan";

export type Offering = {
  id: string;
  name: string;
  provider: string;
  category: "biomarkers" | "wearables" | "menopause";
  summary: string;
  includes: string[];
  delivery: string;
  location: string;
  price: string | null;
  referral_needed: boolean | null;
  eligibility: string | null;
  subscription: boolean;
  clinicians: string;
  url: string;
  observed_at: string;
};

const CATEGORIES = [
  { id: "biomarkers", title: "Know your biomarkers", sub: "A doctor reads an extended blood panel with you.", tint: "#f5f8f6" },
  { id: "wearables", title: "Make your wearable useful", sub: "Bring your Oura, Apple Watch or glucose monitor data to a doctor.", tint: "#f6f7fa" },
  { id: "menopause", title: "Menopause, properly", sub: "Longer, whole-person consults for perimenopause and menopause.", tint: "#f8f6f3" },
] as const;

type Q = { id: string; ask: string; options: { id: string; label: string }[] };
const QUESTIONS: Q[] = [
  { id: "how", ask: "How would you like to be seen?", options: [{ id: "any", label: "Either is fine" }, { id: "telehealth", label: "Telehealth, from home" }, { id: "person", label: "In person" }] },
  { id: "pay", ask: "How would you like to pay?", options: [{ id: "any", label: "Show me everything" }, { id: "once", label: "One-off consult or test" }, { id: "subscription", label: "A membership is fine" }] },
];

const isTele = (o: Offering) => /telehealth|online|video|australia-wide/i.test(`${o.delivery} ${o.location}`);
const isPerson = (o: Offering) => /in person|clinic|in-person/i.test(o.delivery) || !/telehealth/i.test(o.location);

export function Discover({ offerings }: { offerings: Offering[] }) {
  const [cat, setCat] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<string | null>(null);
  const done = cat !== null && cat !== "healthspan" && step >= QUESTIONS.length;

  const results = useMemo(() => {
    if (!done) return [];
    return offerings.filter((o) => {
      if (o.category !== cat) return false;
      if (answers.how === "telehealth" && !isTele(o)) return false;
      if (answers.how === "person" && !isPerson(o)) return false;
      if (answers.pay === "once" && o.subscription) return false;
      return true;
    });
  }, [done, offerings, cat, answers]);

  const category = CATEGORIES.find((c) => c.id === cat);
  const q = cat && cat !== "healthspan" && !done ? QUESTIONS[step] : null;

  function next() {
    if (!q || !picked) return;
    setAnswers((a) => ({ ...a, [q.id]: picked }));
    setPicked(null);
    setStep((s) => s + 1);
  }

  function back() {
    if (cat === null) return;
    if (step === 0 || cat === "healthspan") setCat(null);
    else {
      setStep((s) => s - 1);
      setPicked(null);
    }
  }

  return (
    <Screen padBottom="pb-[150px]">
      <div className="flex h-11 items-center gap-4">
        {cat === null ? <Circle href="/me" label="Back"><ArrowLeft size={20} /></Circle> : <Circle onClick={back} label="Back"><ArrowLeft size={20} /></Circle>}
        <h1 className="text-[22px] text-ink">Discover</h1>
      </div>

      {cat === null ? (
        <div className="rise mt-6">
          <p className="text-[16px] leading-[1.5] text-charcoal">Newer care you can book directly.</p>
          <div className="mt-6 flex flex-col gap-3">
            <a href="/healthspan" className="rise press press-soft block rounded-[8px] bg-[#2f5d3a] px-5 py-5 text-left">
              <span className="block text-[20px] font-semibold leading-tight tracking-[-0.01em] text-white">Plan your healthspan</span>
              <span className="mt-1 block text-[15px] leading-[1.45] text-white/85">Prevention doctors who read your wearable and bloodwork.</span>
            </a>
            {CATEGORIES.map((c, i) => {
              const n = offerings.filter((o) => o.category === c.id).length;
              return (
                <button key={c.id} type="button" onClick={() => { setCat(c.id); setStep(0); setAnswers({}); }} className="rise press press-soft rounded-[8px] px-5 py-5 text-left" style={{ background: c.tint, "--i": i } as React.CSSProperties}>
                  <span className="block text-[20px] font-semibold leading-tight tracking-[-0.01em] text-ink">{c.title}</span>
                  <span className="mt-1 block text-[15px] leading-[1.45] text-charcoal">{c.sub}</span>
                  <span className="mt-3 flex items-center gap-1 text-[14px] font-semibold text-[#2f5d3a]">{n} {n === 1 ? "service" : "services"}<ChevronRight size={15} /></span>
                </button>
              );
            })}
          </div>
          <p className="mt-6 text-[12px] leading-[1.5] text-grey">Facts from each provider’s own site. Wattle takes no payment. Ask your GP first.</p>
        </div>
      ) : cat === "healthspan" ? (
        <Healthspan offerings={offerings} />
      ) : q ? (
        <div key={q.id} className="rise mt-8">
          <p className="text-[14px] text-grey">{category?.title} · {step + 1} of {QUESTIONS.length}</p>
          <h2 className="mt-2 text-[26px] leading-[1.25] tracking-[-0.015em] text-ink">{q.ask}</h2>
          <div role="radiogroup" aria-label={q.ask} className="mt-6 flex flex-col gap-2.5">
            {q.options.map((o, i) => {
              const on = picked === o.id;
              return (
                <button key={o.id} type="button" role="radio" aria-checked={on} onClick={() => setPicked(o.id)} className={`rise press press-soft flex items-center gap-4 rounded-[6px] border px-5 py-4 text-left ${on ? "border-[#2f5d3a] bg-[#f5f8f6]" : "border-hairline"}`} style={{ "--i": i } as React.CSSProperties}>
                  <span className="flex-1 text-[17px] text-ink">{o.label}</span>
                  <span aria-hidden="true" className={`inline-flex size-6 items-center justify-center rounded-full border ${on ? "border-[#2f5d3a] bg-[#2f5d3a] text-white" : "border-hairline text-transparent"}`}><Check size={13} /></span>
                </button>
              );
            })}
          </div>
          <div className="frame-fixed pointer-events-none bottom-0 z-20 bg-white">
            <div className="frame-pad pointer-events-auto pb-[26px] pt-3"><Cta fixed={false} disabled={!picked} onClick={next}>Continue</Cta></div>
          </div>
        </div>
      ) : (
        <div className="rise mt-6">
          <h2 className="text-[24px] leading-tight tracking-[-0.015em] text-ink">{category?.title}</h2>
          <p className="mt-1 text-[15px] text-grey">{results.length} {results.length === 1 ? "service fits" : "services fit"} what you chose.</p>
          <div className="mt-5 flex flex-col gap-4">
            {results.map((o, i) => (
              <article key={o.id} className="rise rounded-[8px] border border-hairline px-5 py-5" style={{ "--i": i } as React.CSSProperties}>
                <p className="text-[13px] text-grey">{o.provider}</p>
                <h3 className="mt-0.5 text-[18px] leading-tight text-ink">{o.name}</h3>
                <p className="mt-2 text-[15px] leading-[1.5] text-charcoal">{o.summary}</p>
                <ul className="mt-3 flex flex-col gap-1.5">
                  {o.includes.slice(0, 3).map((x) => (
                    <li key={x} className="flex gap-2 text-[14px] leading-[1.45] text-charcoal"><span className="mt-0.5 text-[#2f5d3a]"><Check size={14} /></span>{x}</li>
                  ))}
                </ul>
                <p className="mt-3 text-[14px] text-grey">{[o.price ?? "Price on their site", o.location, o.subscription ? "Membership" : null, o.referral_needed ? "GP referral needed" : null].filter(Boolean).join(" · ")}</p>
                <p className="mt-1 text-[13px] text-grey">With {o.clinicians}</p>
                <a href={o.url} target="_blank" rel="noreferrer" className="press mt-4 inline-flex h-11 items-center rounded-[6px] bg-ink px-4 text-[15px] font-semibold text-white">Visit their site</a>
              </article>
            ))}
            {results.length === 0 ? <p className="text-[15px] text-grey">Nothing fits all of that yet. Go back and widen a choice.</p> : null}
          </div>
          <p className="mt-6 text-[12px] leading-[1.5] text-grey">From each provider’s website, checked {offerings[0]?.observed_at ?? ""}. Not an endorsement; prices change, so confirm on their site.</p>
        </div>
      )}
    </Screen>
  );
}
