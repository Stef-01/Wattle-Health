"use client";
import { Brand } from "@/src/ui/brand";
// /healthspan (2026-10-19): an editorial landing page and a guided match in one scroll.
// 1) What healthspan is, in three short beats. 2) Pick what matters to you, your wearable and
// whether you want bloodwork read with you. 3) Doctors who say, in their own published words, that
// they work this way, with why each matched, then services. No model calls; see healthspan-match.ts.
import Link from "next/link";
import { useRef, useState } from "react";
import { AREAS, DEVICES, type Device } from "@/src/data/healthspan";
import type { HealthspanMatch } from "@/src/data/healthspan-match";
import { Button, Check, NavBar, Screen, Toggle } from "@/src/ui/kit";
import { doctorHref } from "@/src/data/doctor-slug";
import type { Offering } from "./Discover";
import { Portrait } from "../patient-a/DoctorCard";
import { drName, placeOf, providerTitle } from "./facts";

const BEATS = [
  { n: "01", title: "Measure early", body: "Blood pressure, ApoB, HbA1c, fitness and sleep show risk years before illness does." },
  { n: "02", title: "Read it together", body: "A doctor goes through your numbers and your wearable’s trends with you." },
  { n: "03", title: "Adjust and recheck", body: "Make small changes, then measure again in three to six months." },
];

const hobbiesOf = (m: HealthspanMatch) => {
  const p = m.doctor.personal;
  const h = [p?.hobbies ?? []].flat().filter(Boolean);
  const s = p?.outsideMedicine?.trim() || h.join(", ");
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : null;
};

export function HealthspanLanding({ offerings }: { offerings: Offering[] }) {
  const [areas, setAreas] = useState<string[]>([]);
  const [device, setDevice] = useState<Device>("none");
  const [bloodwork, setBloodwork] = useState(true);
  const [telehealth, setTelehealth] = useState(false);
  const [matches, setMatches] = useState<HealthspanMatch[] | null>(null);
  const [busy, setBusy] = useState(false);
  const plan = useRef<HTMLDivElement>(null);
  const results = useRef<HTMLDivElement>(null);

  async function find() {
    setBusy(true);
    const r = await fetch("/api/healthspan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ areas, device, bloodwork, telehealth }) }).then((x) => x.json()).catch(() => ({ matches: [] }));
    setMatches((r as { matches: HealthspanMatch[] }).matches);
    setBusy(false);
    requestAnimationFrame(() => results.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  const toggle = (id: string) => setAreas((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  const services = offerings.filter((o) => (device !== "none" ? o.category === "wearables" : false) || (bloodwork && o.category === "biomarkers") || (areas.includes("hormones") && o.category === "menopause")).slice(0, 3);

  return (
    <Screen padBottom="pb-[120px]">
      <NavBar back="/me/discover" />

      <header className="rise mt-6">
        <h1 className="display text-hero font-medium text-ink">More years in good health.</h1>
        <p className="mt-3 text-body leading-read text-ink">Healthspan is the part of life you spend well. Most Australians spend around their last decade living with illness. Much of that illness shows early signs you can act on.</p>
        <div className="mt-5">
          <Button size="medium" onClick={() => plan.current?.scrollIntoView({ behavior: "smooth" })}>Find a doctor who works this way</Button>
        </div>
      </header>

      <section className="mt-16 flex flex-col gap-9">
        {BEATS.map((b, i) => (
          <div key={b.n} className="rise" style={{ "--i": i } as React.CSSProperties}>
            <h2 className="display text-title2 font-medium text-ink">{b.title}</h2>
            <p className="mt-1 text-body leading-read text-ink">{b.body}</p>
          </div>
        ))}
      </section>

      <div ref={plan} className="mt-10 scroll-mt-6 rounded-card bg-surface-soft p-4">
        <h2 className="px-1 text-title2 text-ink">What matters most to you?</h2>
        <p className="mt-1 px-1 text-subhead text-grey">Pick any. We pick doctors who work on these.</p>
        <div className="mt-4 ios-group overflow-hidden rounded-[18px] bg-white">
          {AREAS.map((a) => {
            const on = areas.includes(a.id);
            return (
              <button key={a.id} type="button" aria-pressed={on} onClick={() => toggle(a.id)} className="cell flex min-h-[52px] w-full items-start gap-3 px-4 py-3.5 text-left">
                <span className="min-w-0 flex-1">
                  <span className="block text-body text-ink">{a.title}</span>
                  {on ? <span className="mt-0.5 block text-subhead text-grey">{a.why}</span> : null}
                </span>
                <Check size={20} strokeWidth={2.25} className={`mt-0.5 shrink-0 text-accent ${on ? "" : "invisible"}`} />
              </button>
            );
          })}
        </div>

        <h3 className="mt-6 px-1 text-headline text-grey">What do you wear?</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {DEVICES.map((d) => (
            <button key={d.id} type="button" aria-pressed={device === d.id} onClick={() => setDevice(d.id)} className={`press inline-flex h-11 items-center rounded-full px-4 text-subhead ${device === d.id ? "bg-ink font-semibold text-white" : "bg-white text-ink"}`}>{d.label}</button>
          ))}
        </div>

        <div className="mt-6 ios-group overflow-hidden rounded-[18px] bg-white">
          <div className="flex min-h-[52px] items-center justify-between gap-3 px-4 py-2.5"><span className="text-body text-ink">Read extended bloodwork with me</span><Toggle on={bloodwork} onChange={setBloodwork} label="Read extended bloodwork with me" /></div>
          <div className="flex min-h-[52px] items-center justify-between gap-3 px-4 py-2.5"><span className="text-body text-ink">Telehealth is fine</span><Toggle on={telehealth} onChange={setTelehealth} label="Telehealth is fine" /></div>
        </div>
        <div className="mt-5"><Button full disabled={busy} onClick={() => void find()}>{busy ? "Picking" : "Show my picks"}</Button></div>
      </div>

      <div ref={results} className="scroll-mt-6">
        {matches ? (
          <section className="mt-12">
            <h2 className="text-title1 text-ink">{matches.length ? "Providers who work forwards" : "No picks yet"}</h2>
            {matches.length ? <p className="mt-1 text-subhead text-grey">Each says so on their own practice page.</p> : <p className="mt-1 text-subhead text-grey">Try fewer areas, or the services below.</p>}
            <div className="mt-6 flex flex-col gap-10">
              {matches.map((m, i) => {
                const outside = hobbiesOf(m);
                return (
                  <article key={m.doctor.id} className="rise" style={{ "--i": i } as React.CSSProperties}>
                    <Link href={doctorHref(m.doctor.id)} className="press-soft block">
                      <Portrait d={m.doctor} height={i === 0 ? 400 : 320} caption={false} />
                    </Link>
                    <Link href={doctorHref(m.doctor.id)} className="press-dim mt-4 block">
                      <span role="heading" aria-level={3} className="block text-title2 text-ink">{drName(m.doctor)}</span>
                      <span className="mt-0.5 block text-body text-ink">{providerTitle(m.doctor)}</span>
                      <span className="block text-subhead text-grey">{placeOf(m.doctor)}</span>
                    </Link>
                    <p className="mt-3 font-display text-quote text-ink">“{m.evidence.replace(/^[“"]|[”"]$/g, "")}”</p>
                    {m.reasons.length ? (
                      <ul className="mt-3 flex flex-col gap-1.5">
                        {m.reasons.map((r) => <li key={r} className="flex gap-2 text-subhead text-ink"><span className="mt-0.5 text-accent"><Check size={15} strokeWidth={2.25} /></span>{r}</li>)}
                      </ul>
                    ) : null}
                    {outside ? <p className="mt-3 text-subhead leading-read text-ink"><span className="font-semibold">Outside the clinic </span><span className="text-grey">{outside}</span></p> : null}
                  </article>
                );
              })}
            </div>
            {services.length ? (
              <div className="mt-12">
                <h3 className="text-title2 text-ink">Services that pair with this</h3>
                <div className="mt-3 ios-group overflow-hidden rounded-card bg-surface-soft">
                  {services.map((o) => (
                    <a key={o.id} href={o.url} target="_blank" rel="noreferrer" className="cell block px-4 py-3">
                      <span className="block text-footnote text-grey">{o.provider}</span>
                      <span className="block text-body text-ink">{o.name}</span>
                      <span className="block text-subhead text-grey">{o.price ? o.price.split(/[;(]/)[0]!.trim() : "Price on their site"}</span>
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
            <p className="mt-10 text-footnote text-grey">General information, not medical advice. Picks use each provider’s own published words. <Brand /> doesn’t take payment from doctors or services.</p>
          </section>
        ) : null}
      </div>
    </Screen>
  );
}
