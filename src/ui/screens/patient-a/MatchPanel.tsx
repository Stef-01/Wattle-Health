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
import { Check, Group, Labelled } from "@/src/ui/kit";
import { Facts, Research, Sources, WordsFull } from "@/src/ui/screens/patient-b/Profile";
import { ContactCta } from "@/src/ui/screens/patient-b/ProfileClient";
import { Reviews, Stars } from "@/src/ui/screens/patient-b/Reviews";
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

/** Highlight row (Maps "Good to know"): a monochrome glyph, the label, a secondary line; a trailing
 *  check in the tint when it matches what was asked. */
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
    <ul className="grid grid-cols-1 gap-x-10 gap-y-4 lg:grid-cols-2">
      {items.map((h, i) => (
        <li key={h.id} className="rise flex items-start gap-3" style={{ "--i": i } as React.CSSProperties}>
          <span aria-hidden="true" className="inline-flex size-[30px] shrink-0 items-center justify-center text-grey">
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d={ICONS[h.kind]} /></svg>
          </span>
          <span className="min-w-0 flex-1 pt-1">
            <span className="block text-body text-ink">{h.label}</span>
            {h.detail ?? h.matched ? <span className="mt-0.5 line-clamp-2 text-subhead text-grey">{h.detail ?? "Matches what you asked for"}</span> : null}
          </span>
          {h.matched ? <Check size={18} strokeWidth={2.25} className="mt-1.5 shrink-0 text-accent" aria-label="Matches your search" /> : null}
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
        <div className="mb-3 flex items-baseline justify-between">
          <p className="text-headline text-ink">{ORDINAL[index]}</p>
          <p className="tnum text-subhead text-grey">{index + 1} of {total}</p>
        </div>
      ) : null}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_500px] lg:items-start lg:gap-16">
      <div className="min-w-0">
      <Link href={doctorHref(d.id)} className="press-soft block">
        <Portrait d={d} height={440} saved={saved} onSave={onSave} eager={index === 0} caption={false} />
      </Link>
      <header className="mt-4">
        <Link href={doctorHref(d.id)} className="press-dim hit block">
          <p role="heading" aria-level={2} className="text-title1 text-ink">{d.name.display}</p>
        </Link>
        <p className="mt-1 text-body text-ink">{line}</p>
        <p className="mt-0.5 text-subhead text-grey">{[placeOf(d), km].filter(Boolean).join(" · ")}</p>
      </header>
      {ownLine ? <p className="mt-4 font-display text-quote text-ink">“{ownLine.replace(/^[“"]|[”"]$/g, "")}”</p> : <p className="mt-4 text-body leading-read text-grey">{fitSentence(card, labels)}</p>}
      {reviews && reviews.count > 0 ? (
        <button type="button" onClick={() => setTab("Reviews")} className="cell mt-4 flex w-full items-center gap-4 rounded-card bg-surface-soft p-4 text-left">
          <span className="flex shrink-0 flex-col items-center">
            <span className="tnum text-large-title text-ink">{reviews.average?.toFixed(1)}</span>
            <span className="mt-0.5"><Stars value={reviews.average ?? 0} size={12} /></span>
          </span>
          <span className="min-w-0 flex-1">
            {reviews.commentary ? <span className="line-clamp-3 text-subhead text-ink">{reviews.commentary}</span> : null}
            <span className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <span className="text-footnote text-grey">{reviews.demo ? "Demo reviews, not real patients" : `${reviews.count} verified reviews`}</span>
              <span className="text-subhead text-accent">See all {reviews.count}</span>
            </span>
          </span>
        </button>
      ) : null}
      {outside ? (
        <p className="mt-4 text-body leading-read text-ink"><span className="font-semibold">Outside the clinic </span><span className="text-grey">{outside.charAt(0).toUpperCase() + outside.slice(1)}</span></p>
      ) : null}

      <div role="tablist" aria-label="Doctor details" className="chrome mt-7 grid h-9 rounded-full bg-surface p-[2px]" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((t) => (
          <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => setTab(t)} className={`hit truncate rounded-full px-1 text-footnote transition-[background-color,box-shadow] duration-200 ${tab === t ? "bg-white font-semibold text-ink shadow-[0_3px_8px_rgba(0,0,0,0.12),0_3px_1px_rgba(0,0,0,0.04)]" : "text-ink"}`}>{t}</button>
        ))}
      </div>
      <div role="tabpanel" key={tab} className="rise min-h-[220px] pt-5">
        {tab === "Highlights" ? <HighlightRows items={highlights} /> : null}
        {tab === "About" ? (
          <div className="flex flex-col gap-7">
            <Facts d={d} />
            {personal ? <WordsFull d={d} shown={[ownLine, outside]} /> : <p className="text-body text-grey">They haven’t written about how they work yet.</p>}
            <Labelled label="Sees">
              <p className="text-body leading-read text-ink">{conditions.length ? `${listSentence(conditions)}.` : "No clinical focus listed yet."}</p>
            </Labelled>
            <div className="flex flex-col"><Research d={d} /><Sources d={d} /></div>
            {source ? <p className="text-footnote text-grey">{source.text} {source.href ? <a href={source.href} target="_blank" rel="noreferrer" className="text-accent">Source</a> : null}</p> : null}
          </div>
        ) : null}
        {tab === "Location" ? (
          <div className="flex flex-col gap-3">
            {d.rooms.slice(0, 3).map((r) => {
              const address = [r.name, r.address, `${r.suburb} ${r.state} ${r.postcode}`.trim()].filter(Boolean).join(", ");
              return (
                <div key={r.id} className="rounded-card bg-surface-soft px-4 pt-3">
                  <p className="text-headline text-ink">{r.name ?? r.suburb}</p>
                  <p className="mt-0.5 text-subhead text-grey">{address}</p>
                  <div className="flex flex-wrap gap-x-4 text-body">
                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer" className="press-dim inline-flex h-11 items-center text-accent">Directions</a>
                    {r.phone ? <a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`} className="press-dim inline-flex h-11 items-center text-accent">Call {r.phone}</a> : null}
                    {r.website ? <a href={r.website} target="_blank" rel="noreferrer" className="press-dim inline-flex h-11 items-center text-accent">Website</a> : null}
                  </div>
                </div>
              );
            })}
            {d.declared.telehealth && d.telehealth.value !== "none" ? <p className="px-4 text-subhead text-grey">Also sees patients by telehealth.</p> : null}
          </div>
        ) : null}
        {tab === "Reviews" ? <Reviews doctorId={d.id} name={drShort(d)} /> : null}
        {tab === "FAQs" ? (
          <dl>
            <Group tone="soft">
              {faqs(d).map((f) => (
                <div key={f.q} className="px-4 py-3">
                  <dt className="text-headline text-ink">{f.q}</dt>
                  <dd className="mt-0.5 text-subhead text-grey">{f.a}</dd>
                </div>
              ))}
            </Group>
          </dl>
        ) : null}
      </div>
      <div className="mt-8 lg:hidden">
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
