"use client";
// /healthspan (2026-10-19): an editorial landing page and a guided match in one scroll.
// 1) What healthspan is, in three short beats. 2) Pick what matters to you, your wearable and
// whether you want bloodwork read with you. 3) Doctors who say, in their own published words, that
// they work this way, with why each matched, then services. No model calls; see healthspan-match.ts.
import Link from "next/link";
import { useRef, useState } from "react";
import { AREAS, DEVICES, type Device } from "@/src/data/healthspan";
import type { HealthspanMatch } from "@/src/data/healthspan-match";
import { ArrowLeft, Check, Circle, Cta, Screen, Toggle } from "@/src/ui/kit";
import { doctorHref } from "@/src/data/doctor-slug";
import { Portrait } from "../patient-a/DoctorCard";
import type { Offering } from "./Discover";
import { drName, placeOf, specialtyTitle } from "./facts";

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
      <div className="flex h-11 items-center">
        <Circle href="/me/discover" label="Back"><ArrowLeft size={20} /></Circle>
      </div>

      <header className="rise mt-8">
        <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-[#8a6a3b]">Healthspan</p>
        <h1 className="display mt-3 text-[40px] leading-[1.05] text-ink">More years in good health.</h1>
        <p className="mt-5 text-[17px] leading-[1.55] text-charcoal">Healthspan is the part of life you spend well. Most Australians spend around their last decade living with illness. Much of that illness shows early signs you can act on.</p>
        <button type="button" onClick={() => plan.current?.scrollIntoView({ behavior: "smooth" })} className="press mt-7 inline-flex rounded-full bg-[#2f5d3a] px-5 py-3 text-[15px] text-white">Find a doctor who works this way</button>
      </header>

      <section className="mt-14 flex flex-col gap-7">
        {BEATS.map((b, i) => (
          <div key={b.n} className="rise flex gap-5" style={{ "--i": i } as React.CSSProperties}>
            <span className="font-display text-[28px] leading-none text-[#c9b48a]">{b.n}</span>
            <div>
              <h2 className="display text-[22px] leading-tight text-ink">{b.title}</h2>
              <p className="mt-1.5 text-[16px] leading-[1.5] text-charcoal">{b.body}</p>
            </div>
          </div>
        ))}
      </section>

      <div ref={plan} className="mt-14 scroll-mt-6 rounded-[8px] bg-[#f5f8f6] px-5 py-6">
        <h2 className="display text-[26px] leading-tight text-ink">What matters most to you?</h2>
        <p className="mt-1 text-[15px] text-grey">Pick any. We match doctors who work on these.</p>
        <div className="mt-5 grid grid-cols-1 gap-2.5">
          {AREAS.map((a) => {
            const on = areas.includes(a.id);
            return (
              <button key={a.id} type="button" aria-pressed={on} onClick={() => toggle(a.id)} className={`press press-soft flex items-start gap-3 rounded-[6px] border bg-white px-4 py-3.5 text-left ${on ? "border-[#2f5d3a]" : "border-transparent"}`}>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-semibold text-ink">{a.title}</span>
                  {on ? <span className="mt-1 block text-[14px] leading-[1.45] text-charcoal">{a.why}</span> : null}
                </span>
                <span aria-hidden="true" className={`mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border ${on ? "border-[#2f5d3a] bg-[#2f5d3a] text-white" : "border-hairline text-transparent"}`}><Check size={13} /></span>
              </button>
            );
          })}
        </div>

        <h3 className="mt-7 text-[16px] text-ink">What do you wear?</h3>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {DEVICES.map((d) => (
            <button key={d.id} type="button" aria-pressed={device === d.id} onClick={() => setDevice(d.id)} className={`press rounded-[6px] border bg-white px-3 py-2.5 text-left text-[15px] ${device === d.id ? "border-[#2f5d3a] text-ink" : "border-transparent text-grey"}`}>{d.label}</button>
          ))}
        </div>

        <div className="mt-6 flex flex-col divide-y divide-hairline rounded-[6px] bg-white">
          <div className="flex items-center justify-between gap-3 px-4 py-3"><span className="text-[15px] text-ink">Read extended bloodwork with me</span><Toggle on={bloodwork} onChange={setBloodwork} label="Read extended bloodwork with me" /></div>
          <div className="flex items-center justify-between gap-3 px-4 py-3"><span className="text-[15px] text-ink">Telehealth is fine</span><Toggle on={telehealth} onChange={setTelehealth} label="Telehealth is fine" /></div>
        </div>
        <div className="mt-6"><Cta fixed={false} disabled={busy} onClick={() => void find()}>{busy ? "Matching" : "Match me"}</Cta></div>
      </div>

      <div ref={results} className="scroll-mt-6">
        {matches ? (
          <section className="mt-12">
            <h2 className="display text-[28px] leading-tight text-ink">{matches.length ? "Doctors who work forwards" : "No match yet"}</h2>
            {matches.length ? <p className="mt-1 text-[15px] text-grey">Each says so on their own practice page.</p> : <p className="mt-1 text-[15px] text-grey">Try fewer areas, or the services below.</p>}
            <div className="mt-6 flex flex-col gap-10">
              {matches.map((m, i) => {
                const outside = hobbiesOf(m);
                return (
                  <article key={m.doctor.id} className="rise" style={{ "--i": i } as React.CSSProperties}>
                    <p className="font-display text-[20px] leading-[1.4] text-ink">“{m.evidence.replace(/^[“"]|[”"]$/g, "")}”</p>
                    <div className="mt-4"><Portrait d={m.doctor} height={i === 0 ? 360 : 240} /></div>
                    <p className="mt-3 text-[15px] text-charcoal">{specialtyTitle(m.doctor.specialty)} · {placeOf(m.doctor)}</p>
                    {m.reasons.length ? (
                      <ul className="mt-3 flex flex-col gap-1.5">
                        {m.reasons.map((r) => <li key={r} className="flex gap-2 text-[15px] text-charcoal"><span className="mt-0.5 text-[#2f5d3a]"><Check size={14} /></span>{r}</li>)}
                      </ul>
                    ) : null}
                    {outside ? <p className="mt-4 rounded-[6px] bg-[#f8f6f3] px-4 py-3 text-[15px] leading-[1.5] text-charcoal"><span className="block text-[13px] font-medium text-[#8a6a3b]">Outside the clinic</span>{outside}</p> : null}
                    <Link href={doctorHref(m.doctor.id)} className="press mt-4 inline-flex rounded-full border border-hairline px-4 py-2.5 text-[15px] text-ink">Read {drName(m.doctor).split(" ").slice(0, 2).join(" ")}’s profile</Link>
                  </article>
                );
              })}
            </div>
            {services.length ? (
              <div className="mt-12">
                <h3 className="display text-[22px] text-ink">Services that pair with this</h3>
                {services.map((o) => (
                  <a key={o.id} href={o.url} target="_blank" rel="noreferrer" className="press-dim mt-3 block rounded-[6px] border border-hairline px-4 py-3">
                    <span className="block text-[13px] text-grey">{o.provider}</span>
                    <span className="block text-[16px] text-ink">{o.name}</span>
                    <span className="block text-[14px] text-grey">{o.price ? o.price.split(/[;(]/)[0]!.trim() : "Price on their site"}</span>
                  </a>
                ))}
              </div>
            ) : null}
            <p className="mt-10 text-[12px] leading-[1.5] text-grey">General information, not medical advice. Matches use each doctor’s own published words. Wattle doesn’t take payment from doctors or services.</p>
          </section>
        ) : null}
      </div>
    </Screen>
  );
}
