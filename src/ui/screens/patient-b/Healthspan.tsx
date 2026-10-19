"use client";
// Discover › Healthspan: one sentence and your wearable in, then for each area it reads: why it
// matters, what a doctor would measure, what your device can tell you, and services that fit.
import { useState } from "react";
import { DEVICES, EXAMPLES, readHealthspan, type Area, type Device } from "@/src/data/healthspan";
import { Check, Cta } from "@/src/ui/kit";
import type { Offering } from "./Discover";

export function Healthspan({ offerings }: { offerings: Offering[] }) {
  const [text, setText] = useState("");
  const [device, setDevice] = useState<Device>("none");
  const [areas, setAreas] = useState<Area[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  if (!areas) {
    return (
      <div className="rise mt-6">
        <h2 className="display text-[28px] leading-[1.2] text-ink">What do you want more good years for?</h2>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Keep up with my kids, stay sharp, sleep properly…" className="field mt-5 w-full rounded-[18px] border-2 border-line p-4 text-[17px] outline-none" />
        <div className="mt-3 flex flex-col gap-1.5">
          {EXAMPLES.map((e) => (
            <button key={e} type="button" onClick={() => setText(e)} className="press-dim self-start text-left text-[15px] text-accent">“{e}”</button>
          ))}
        </div>
        <p className="mt-6 text-[14px] font-medium text-grey">What do you wear?</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {DEVICES.map((d) => (
            <button key={d.id} type="button" aria-pressed={device === d.id} onClick={() => setDevice(d.id)} className={`press rounded-[14px] border px-3 py-2.5 text-left text-[15px] ${device === d.id ? "border-[#2f5d3a] bg-[#f5f8f6] text-ink" : "border-hairline text-grey"}`}>{d.label}</button>
          ))}
        </div>
        <div className="mt-6"><Cta fixed={false} disabled={text.trim().length < 3} onClick={() => { const a = readHealthspan(text); setAreas(a); setOpen(a[0]?.id ?? null); }}>Show my plan</Cta></div>
      </div>
    );
  }

  const dev = DEVICES.find((d) => d.id === device)!;
  return (
    <div className="rise mt-6">
      <p className="text-[14px] text-grey">You said “{text.trim()}”</p>
      <h2 className="display mt-1 text-[26px] leading-tight text-ink">{areas.length === 1 ? "One area to work on" : `${areas.length} areas to work on`}</h2>
      <div className="mt-5 flex flex-col gap-3">
        {areas.map((a) => {
          const on = open === a.id;
          const fits = offerings.filter((o) => a.categories.includes(o.category)).slice(0, 2);
          const signal = device === "none" ? null : a.wearable[device] ?? `${dev.label} doesn’t measure much here. A test with your doctor will tell you more.`;
          return (
            <section key={a.id} className="rounded-[22px] border border-hairline">
              <button type="button" aria-expanded={on} onClick={() => setOpen(on ? null : a.id)} className="flex w-full items-center justify-between px-5 py-4 text-left">
                <span className="font-display text-[20px] text-ink">{a.title}</span>
                <span className="text-[20px] text-grey">{on ? "−" : "+"}</span>
              </button>
              {on ? (
                <div className="px-5 pb-5">
                  <p className="text-[15px] leading-[1.5] text-charcoal">{a.why}</p>
                  <p className="mt-4 text-[13px] font-medium text-[#2f5d3a]">Ask your doctor about</p>
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {a.measure.map((m) => (
                      <li key={m} className="flex gap-2 text-[15px] text-charcoal"><span className="mt-0.5 text-[#2f5d3a]"><Check size={14} /></span>{m}</li>
                    ))}
                  </ul>
                  {signal ? (
                    <>
                      <p className="mt-4 text-[13px] font-medium text-[#8a6a3b]">From your {dev.label}</p>
                      <p className="mt-1 text-[15px] leading-[1.5] text-charcoal">{signal}</p>
                    </>
                  ) : null}
                  {fits.length ? (
                    <>
                      <p className="mt-4 text-[13px] font-medium text-grey">Services that do this</p>
                      {fits.map((o) => (
                        <a key={o.id} href={o.url} target="_blank" rel="noreferrer" className="press-dim mt-1.5 block text-[15px] text-accent">{o.name} · {o.provider}{o.price ? ` · ${o.price.split(/[;(]/)[0]!.trim()}` : ""}</a>
                      ))}
                    </>
                  ) : null}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
      <button type="button" onClick={() => setAreas(null)} className="press-dim mt-5 text-[15px] text-accent">Ask something else</button>
      <p className="mt-6 text-[12px] leading-[1.5] text-grey">General information to take to your GP, not medical advice. Wearable numbers are estimates.</p>
    </div>
  );
}
