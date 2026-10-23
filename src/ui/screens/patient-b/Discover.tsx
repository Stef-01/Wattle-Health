"use client";
import { Brand } from "@/src/ui/brand";
// Settings › Discover (2026-10-18): guided flows into newer, concierge-style care that most people
// don't know exists: doctor-led biomarker analysis, consults that use your wearable data, and
// holistic menopause care. Three short questions, then real Australian services that fit, each
// with what you get, price and a link to their own site. Listings are facts from each provider's
// website (data/discover/offerings.json); Wattle does not endorse or take payment from them.
import { useMemo, useState } from "react";
import { Check, ChevronRight, Cta, NavBar, Screen } from "@/src/ui/kit";
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
  { id: "biomarkers", title: "Know your biomarkers", sub: "A doctor reads an extended blood panel with you.", tint: "var(--color-surface-soft)" },
  { id: "wearables", title: "Make your wearable useful", sub: "Bring Oura, Apple Watch, Whoop or glucose data to a doctor.", tint: "var(--color-surface-soft)" },
  { id: "menopause", title: "Menopause, properly", sub: "Longer, whole-person consults for perimenopause and menopause.", tint: "var(--color-surface-soft)" },
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
      {cat === null ? <NavBar back="/me" title="Discover" /> : <NavBar onBack={back} />}
      {cat === null ? <p className="mt-2 text-body text-grey">Newer care you can book directly.</p> : null}

      {cat === null ? (
        <div className="rise mt-4">
          <div className="flex flex-col gap-3">
            <a href="/healthspan" className="rise press-soft block rounded-card bg-ink px-5 py-5 text-left">
              <span className="block font-display text-title2 text-white">Plan your healthspan</span>
              <span className="mt-1 block text-subhead text-white/85">Prevention, with your wearable and bloodwork.</span>
            </a>
            {CATEGORIES.map((c, i) => {
              const n = offerings.filter((o) => o.category === c.id).length;
              return (
                <button key={c.id} type="button" onClick={() => { setCat(c.id); setStep(0); setAnswers({}); }} className="rise press-soft rounded-card px-5 py-5 text-left" style={{ background: c.tint, "--i": i } as React.CSSProperties}>
                  <span className="block font-display text-title2 text-ink">{c.title}</span>
                  <span className="mt-1 block text-subhead leading-read text-charcoal">{c.sub}</span>
                  <span className="mt-3 inline-flex items-center gap-0.5 text-subhead font-semibold text-ink">{n} {n === 1 ? "service" : "services"}<ChevronRight size={15} strokeWidth={2.25} className="text-grey-3" /></span>
                </button>
              );
            })}
          </div>
          <p className="mt-6 px-4 text-footnote text-grey">Listings are facts from each provider’s own website. <Brand /> doesn’t endorse or take payment from them. Talk to your GP about whether a test or program is right for you.</p>
        </div>
      ) : cat === "healthspan" ? (
        <Healthspan offerings={offerings} />
      ) : q ? (
        <div key={q.id} className="rise mt-8">
          <p className="text-subhead text-grey">{category?.title} · {step + 1} of {QUESTIONS.length}</p>
          <h2 className="mt-1 text-title1 text-ink">{q.ask}</h2>
          <div role="radiogroup" aria-label={q.ask} className="ios-group mt-6 overflow-hidden rounded-card bg-surface-soft">
            {q.options.map((o, i) => {
              const on = picked === o.id;
              return (
                <button key={o.id} type="button" role="radio" aria-checked={on} onClick={() => setPicked(o.id)} className="rise cell flex min-h-[52px] w-full items-center gap-3 px-4 py-3 text-left" style={{ "--i": i } as React.CSSProperties}>
                  <span className="flex-1 text-body text-ink">{o.label}</span>
                  <Check size={20} strokeWidth={2.25} aria-hidden="true" className={`shrink-0 text-accent ${on ? "" : "invisible"}`} />
                </button>
              );
            })}
          </div>
          <Cta disabled={!picked} onClick={next}>Continue</Cta>
        </div>
      ) : (
        <div className="rise mt-6">
          <h2 className="text-title1 text-ink">{category?.title}</h2>
          <p className="mt-1 text-subhead text-grey">{results.length} {results.length === 1 ? "service fits" : "services fit"} what you chose.</p>
          <div className="mt-5 flex flex-col gap-4">
            {results.map((o, i) => (
              <article key={o.id} className="rise rounded-card bg-surface-soft p-4" style={{ "--i": i } as React.CSSProperties}>
                <p className="text-footnote text-grey">{o.provider}</p>
                <h3 className="mt-0.5 text-title3 text-ink">{o.name}</h3>
                <p className="mt-2 text-subhead leading-read text-charcoal">{o.summary}</p>
                <ul className="mt-3 flex flex-col gap-1.5">
                  {o.includes.slice(0, 3).map((x) => (
                    <li key={x} className="flex gap-2 text-subhead leading-read text-charcoal"><span className="mt-0.5 text-ink"><Check size={14} /></span>{x}</li>
                  ))}
                </ul>
                <p className="mt-3 text-subhead text-grey">{[o.price ?? "Price on their site", o.location, o.subscription ? "Membership" : null, o.referral_needed ? "GP referral needed" : null].filter(Boolean).join(" · ")}</p>
                <p className="mt-1 text-footnote text-grey">With {o.clinicians}</p>
                <a href={o.url} target="_blank" rel="noreferrer" className="press mt-4 inline-flex rounded-full bg-ink px-4 py-2.5 text-subhead text-white">Visit their site</a>
              </article>
            ))}
            {results.length === 0 ? <p className="text-subhead text-grey">Nothing fits all of that yet. Go back and widen a choice.</p> : null}
          </div>
          <p className="mt-6 px-4 text-footnote text-grey">From each provider’s website, checked {offerings[0]?.observed_at ?? ""}. Not an endorsement; prices change, so confirm on their site.</p>
        </div>
      )}
    </Screen>
  );
}
