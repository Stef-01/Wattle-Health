"use client";
// One match, on Zocdoc SearchAI's provider-panel structure (from the founder's 2026-10-18 capture,
// qa/benchmark-zocdoc/pdf): portrait, rating and top review when there are
// reviews, then tabs (Highlights, About, Location, Reviews, FAQs) so the match opens short and
// everything else is one tap away. Highlights are server-ranked for this patient.
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Card } from "@/src/data/search-types";
import type { DoctorRecord } from "@/src/data/types";
import { doctorHref } from "@/src/data/doctor-slug";
import { demoOpenings } from "@/src/data/calendar";
import { Check, Labelled } from "@/src/ui/kit";
import { Facts, Research, Sources, WordsFull } from "@/src/ui/screens/patient-b/Profile";
import { ContactCta } from "@/src/ui/screens/patient-b/ProfileClient";
import { Reviews } from "@/src/ui/screens/patient-b/Reviews";
import { conditionLabels, drShort, feeOf, listSentence, personalOf, placeOf, primaryRoom, providerTitle, wordsSource } from "@/src/ui/screens/patient-b/facts";
import { fitSentence, Portrait } from "./DoctorCard";
import { BookCard, NextFree, nextFreeLabel } from "./BookCard";
import type { Highlight } from "@/src/data/search-types";

const ORDINAL = ["Your top pick", "Your second pick", "Your third pick"];
const TABS = ["Highlights", "About", "Location", "Reviews", "FAQs"] as const;
type Tab = (typeof TABS)[number];

type ReviewData = { count: number; average: number | null; highlyRecommended: boolean; reviews: { body: string }[]; demo?: boolean; commentary?: string | null };
const reviewCache = new Map<string, Promise<ReviewData>>();
function useReviewSummary(id: string): ReviewData | null {
  const [data, setData] = useState<ReviewData | null>(null);
  useEffect(() => {
    if (!reviewCache.has(id)) reviewCache.set(id, fetch(`/api/reviews?doctor=${encodeURIComponent(id)}`).then((r) => r.json()).catch(() => ({ count: 0, average: null, highlyRecommended: false, reviews: [] })));
    reviewCache.get(id)!.then(setData);
  }, [id]);
  return data;
}

/** Zocdoc-style highlight row: illustrated icon in a soft wattle-gold disc, bold title, grey line. */
const ICONS: Record<Highlight["kind"], string> = {
  clinical: "M12 4v16M4 12h16",
  approach: "M4 12a8 8 0 1 0 16 0 8 8 0 0 0-16 0Zm4 0a4 4 0 1 0 8 0 4 4 0 0 0-8 0",
  lived: "M12 20s-7-4.3-7-9.4A4 4 0 0 1 12 8a4 4 0 0 1 7 2.6C19 15.7 12 20 12 20Z",
  access: "M6 4h12v16H6zM9 9h6M9 13h6",
  research: "M5 5h10a3 3 0 0 1 3 3v11H8a3 3 0 0 1-3-3V5Z",
  personal: "M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M6 18l2-2M16 8l2-2M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
  people: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 20a5 5 0 0 1 10 0M11 20a5 5 0 0 1 10 0",
};
function HighlightRows({ items }: { items: Highlight[] }) {
  return (
    <ul className="grid grid-cols-1 gap-x-10 gap-y-5 lg:grid-cols-2">
      {items.map((h, i) => (
        <li key={h.id} className="rise flex gap-3.5" style={{ "--i": i } as React.CSSProperties}>
          <span aria-hidden="true" className="relative inline-flex size-10 shrink-0 items-center justify-center rounded-full" style={{ background: "#fbf1cf", color: "#8a6a00" }}>
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d={ICONS[h.kind]} /></svg>
            {h.matched ? (
              <span className="absolute -bottom-0.5 -right-0.5 inline-flex size-[18px] items-center justify-center rounded-full border-2 border-white bg-[#1b1b1b] text-white">
                <Check size={10} />
              </span>
            ) : null}
          </span>
          <span className="min-w-0">
            <span className="block text-[17px] font-semibold leading-[1.3] tracking-[-0.01em] text-ink">{h.label}</span>
            <span className="mt-1 line-clamp-2 text-[15px] leading-[1.5] text-[#6b6b6b]">{h.detail ?? (h.matched ? "Matches what you asked for" : "")}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function faqs(d: DoctorRecord): { q: string; a: string }[] {
  const fee = feeOf(d);
  const tele = d.declared.telehealth ? (d.telehealth.value === "none" ? "No, appointments are in person." : d.telehealth.value === "only" ? "Yes, appointments are by telehealth only." : "Yes, telehealth is available.") : "Not listed. Ask the practice when you call.";
  return [
    { q: "Do I need a referral?", a: d.referralRequired ? (d.referralRequired.value ? "Yes. Get a referral from your GP before you book. It also lets you claim the Medicare rebate." : "No referral needed.") : "Not listed. Ask the practice when you call." },
    { q: "Are they taking new patients?", a: d.declared.capacity ? (d.capacity.value === "open" ? "Yes, their practice says so." : d.capacity.value === "waitlist" ? `There is a waitlist${d.waitlistWeeks ? ` of about ${d.waitlistWeeks.value} weeks` : ""}.` : d.capacity.value === "closed" ? "Not at the moment." : "Not listed.") : "Not listed. Ask the practice when you call." },
    { q: "Can I see them by video?", a: tele },
    { q: "What does the first visit cost?", a: fee ? `${fee}, as published by the practice. Medicare rebates may apply.` : "Not published. Ask the practice when you call." },
    { q: "What languages do they speak?", a: d.languages?.value.length ? d.languages.value.join(", ") : "Not listed." },
  ];
}

export function MatchPanel({ card, index, total, labels, saved, onSave, newPatientMatters = false, telehealthOnly = false, variant = "match" }: { variant?: "match" | "profile"; telehealthOnly?: boolean; card: Card; index: number; total: number; labels: Record<string, string>; saved: boolean; onSave: () => void; newPatientMatters?: boolean }) {
  const d = card.doctor;
  const [tab, setTab] = useState<Tab>("Highlights");
  const reviews = useReviewSummary(d.id);
  const room = primaryRoom(d);
  const line = [providerTitle(d), room?.name ?? null].filter(Boolean).join(" · ");
  const km = card.distanceKm !== undefined ? `${Math.max(1, Math.round(card.distanceKm))} km away` : null;
  const referral = d.referralRequired?.value === true;
  const personal = personalOf(d);
  const conditions = conditionLabels(d, labels);
  const source = wordsSource(d);
  const ownWords = [personal?.philosophyOfCare, personal?.philosophy, personal?.communicationApproach, personal?.purpose, personal?.professionalPurpose].find((t) => t && t.trim().length > 30)?.trim();
  const ownLine = ownWords ? (ownWords.match(/^.{30,220}?[.!?](\s|$)/)?.[0] ?? ownWords.slice(0, 200) + "…").trim() : null;
  const [next, setNext] = useState<string | null>(null);
  const [nextMode, setNextMode] = useState<string | null>(null);
  useEffect(() => {
    const all = demoOpenings(d.id, d.declared?.telehealth === true && d.telehealth?.value !== "none", Date.now());
    const o = telehealthOnly ? all.find((x) => x.mode === "telehealth") : all[0];
    setNext(o ? nextFreeLabel(o.start) : null);
    setNextMode(o?.mode ?? null);
  }, [d, telehealthOnly]);
  const hobbies = personal ? [personal.hobbies ?? []].flat().filter(Boolean) : [];
  const outside = personal?.outsideMedicine?.trim() || (hobbies.length ? hobbies.map((h, i) => (i && !/^[A-Z]{2}/.test(h) ? h.charAt(0).toLowerCase() + h.slice(1) : h)).join(", ").replace(/, (?=[^,]*$)/, " and ") : null);
  let highlights = card.highlights ?? [];
  if (newPatientMatters) highlights = highlights.map((h) => (h.id === "open" ? { ...h, matched: true } : h)).sort((a, b) => Number(b.matched) - Number(a.matched));
  if (reviews?.highlyRecommended && !reviews.demo) highlights = [{ id: "recommended", kind: "people", label: "Recommended by patients", detail: `${reviews.count} verified Wattle patients, ${reviews.average?.toFixed(1)} of 5 on average`, matched: false }, ...highlights];
  if (outside) highlights = highlights.filter((h) => h.kind !== "personal");
  const tabs = TABS.filter((t) => t !== "Highlights" || highlights.length > 0);

  return (
    <section className="rise" aria-label={variant === "match" ? ORDINAL[index] : d.name.display} data-match={variant === "match" ? index : undefined}>
      {variant === "match" ? (
        <div className="mb-5 flex items-baseline justify-between">
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#1b1b1b]">{ORDINAL[index]}</p>
          <p className="text-[13px] text-grey">{index + 1} of {total}</p>
        </div>
      ) : null}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_500px] lg:items-start lg:gap-16">
      <div className="min-w-0">
      <Link href={doctorHref(d.id)} className="press block">
        <Portrait d={d} height={440} saved={saved} onSave={onSave} eager={index === 0} caption={false} />
      </Link>
      <header className="mt-5">
        <Link href={doctorHref(d.id)} className="press-dim block">
          <p role="heading" aria-level={2} className="text-[24px] font-semibold leading-[1.2] tracking-[-0.015em] text-ink lg:text-[28px]">{d.name.display}</p>
        </Link>
        <p className="mt-1 text-[16px] font-medium leading-snug text-ink lg:text-[17px]">{line}</p>
        <p className="mt-1 text-[15px] leading-snug text-[#6b6b6b] lg:text-[16px]">{[placeOf(d), km].filter(Boolean).join(" · ")}</p>
      </header>
      {ownLine ? <p className="mt-5 font-display text-[19px] leading-[1.45] text-ink lg:text-[21px]">“{ownLine.replace(/^[“"]|[”"]$/g, "")}”</p> : <p className="mt-5 text-[15px] leading-[1.5] text-[#6b6b6b]">{fitSentence(card, labels)}</p>}
      {reviews && reviews.count > 0 ? (
        <button type="button" onClick={() => setTab("Reviews")} className="press-soft mt-5 flex w-full items-stretch gap-4 rounded-[4px] bg-[#f6f4ee] px-4 py-4 text-left lg:gap-6 lg:px-8 lg:py-6">
          <span className="flex shrink-0 flex-col items-center justify-center border-r border-[#d9d5ca] pr-4 lg:pr-6">
            <span className="text-[32px] font-medium leading-none tracking-[-0.02em] text-ink lg:text-[48px]">{reviews.average?.toFixed(1)}</span>
            <span className="mt-1.5 text-[13px] tracking-[1px] text-[#e8b72f] lg:text-[17px] lg:tracking-[2px]" aria-label={`${reviews.average?.toFixed(1)} out of 5`}>{"★".repeat(Math.round(reviews.average ?? 0))}</span>
          </span>
          <span className="min-w-0 flex-1 self-center">
            {reviews.commentary ? <span className="line-clamp-3 text-[15px] leading-[1.5] text-ink lg:text-[16px] lg:leading-[1.55]">{reviews.commentary}</span> : null}
            <span className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="text-[13px] text-[#6b6b6b] lg:text-[14px]">{reviews.demo ? "Example reviews" : `${reviews.count} verified reviews`}</span>
              <span className="text-[15px] font-semibold text-ink underline underline-offset-4">See all {reviews.count} reviews</span>
            </span>
          </span>
        </button>
      ) : null}
      {outside ? (
        <p className="mt-4 text-[16px] leading-[1.5] text-ink"><span className="font-semibold">Outside the clinic </span><span className="text-[#4a4a4a]">{outside.charAt(0).toUpperCase() + outside.slice(1)}</span></p>
      ) : null}

      <div role="tablist" aria-label="Doctor details" className="mt-8 flex gap-7 overflow-x-auto border-b border-divider [scrollbar-width:none] lg:gap-10">
        {tabs.map((t) => (
          <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => setTab(t)} className={`press-soft -mb-px shrink-0 border-b-2 pb-3.5 text-[16px] lg:text-[17px] ${tab === t ? "border-ink font-semibold text-ink" : "border-transparent text-[#6b6b6b]"}`}>{t}</button>
        ))}
      </div>
      <div role="tabpanel" key={tab} className="rise min-h-[220px] pt-6">
        {tab === "Highlights" ? <HighlightRows items={highlights} /> : null}
        {tab === "About" ? (
          <div className="flex flex-col gap-7">
            <Facts d={d} />
            {personal ? <WordsFull d={d} shown={[ownLine, outside]} /> : <p className="text-[16px] text-grey">They haven’t written about how they work yet.</p>}
            <Labelled label="Sees">
              <p className="text-[17px] leading-[1.5] text-charcoal">{conditions.length ? `${listSentence(conditions)}.` : "No clinical focus listed yet."}</p>
            </Labelled>
            <div className="flex flex-col"><Research d={d} /><Sources d={d} /></div>
            {source ? <p className="caption text-[12px] text-grey">{source.text} {source.href ? <a href={source.href} target="_blank" rel="noreferrer" className="text-accent">Source</a> : null}</p> : null}
          </div>
        ) : null}
        {tab === "Location" ? (
          <div className="flex flex-col gap-4">
            {d.rooms.slice(0, 3).map((r) => {
              const address = [r.name, r.address, `${r.suburb} ${r.state} ${r.postcode}`.trim()].filter(Boolean).join(", ");
              return (
                <div key={r.id} className="rounded-[18px] border border-hairline px-4 py-3">
                  <p className="text-[16px] font-medium text-ink">{r.name ?? r.suburb}</p>
                  <p className="mt-0.5 text-[14px] leading-[1.45] text-grey">{address}</p>
                  <div className="mt-2 flex gap-4 text-[14px]">
                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer" className="text-accent">Directions</a>
                    {r.phone ? <a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`} className="text-accent">Call {r.phone}</a> : null}
                    {r.website ? <a href={r.website} target="_blank" rel="noreferrer" className="text-accent">Website</a> : null}
                  </div>
                </div>
              );
            })}
            {d.declared.telehealth && d.telehealth.value !== "none" ? <p className="text-[15px] text-charcoal">Also sees patients by telehealth.</p> : null}
          </div>
        ) : null}
        {tab === "Reviews" ? <Reviews doctorId={d.id} name={drShort(d)} /> : null}
        {tab === "FAQs" ? (
          <dl className="flex flex-col">
            {faqs(d).map((f) => (
              <div key={f.q} className="border-b border-divider py-3 last:border-b-0">
                <dt className="text-[16px] font-medium text-ink">{f.q}</dt>
                <dd className="mt-0.5 text-[15px] leading-[1.45] text-grey">{f.a}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
      <div className="mt-6 lg:hidden">
        {next ? <NextFree doctor={d} when={next} mode={nextMode} referral={referral} /> : <ContactCta inline doctor={d} label="Call to book" note={referral ? "GP referral needed first" : undefined} />}
      </div>
      </div>
      <aside className="hidden lg:sticky lg:top-20 lg:block">
        <BookCard doctor={d} telehealthOnly={telehealthOnly} referral={referral} />
      </aside>
      </div>
    </section>
  );
}
