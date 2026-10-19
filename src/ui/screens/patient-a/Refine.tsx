"use client";
// Refine (2026-10-18): the Zocdoc-style filters as switches in one sheet, not a row of pills.
// Each switch maps to a phrase the matcher already reads (or the "anywhere" flag), so applying it
// is just a fresh search with a fuller sentence. No insurance.
import { useState } from "react";
import { Cta, Sheet } from "@/src/ui/kit";

export type RefineState = { telehealth: boolean; anywhere: boolean; woman: boolean; child: boolean };

const PHRASES: Record<Exclude<keyof RefineState, "anywhere">, { phrase: string; strip: RegExp }> = {
  telehealth: { phrase: "telehealth only", strip: /,?\s*telehealth (only|is fine)/gi },
  woman: { phrase: "a woman doctor", strip: /,?\s*(a )?(woman|female) doctor/gi },
  child: { phrase: "for my child", strip: /,?\s*for my child/gi },
};

export function readRefine(sentence: string, anywhere: boolean): RefineState {
  return { telehealth: /telehealth only/i.test(sentence), anywhere, woman: /(woman|female) doctor/i.test(sentence), child: /for my child/i.test(sentence) };
}

export function applyRefine(sentence: string, s: RefineState): string {
  let out = sentence;
  for (const k of Object.keys(PHRASES) as Array<keyof typeof PHRASES>) out = out.replace(PHRASES[k].strip, "");
  const add = (Object.keys(PHRASES) as Array<keyof typeof PHRASES>).filter((k) => s[k]).map((k) => PHRASES[k].phrase);
  return [out.trim().replace(/,\s*$/, ""), ...add].filter(Boolean).join(", ");
}

function Switch({ on, onChange, label, sub }: { on: boolean; onChange: (v: boolean) => void; label: string; sub: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="press-soft press flex w-full items-center gap-4 border-b border-divider py-4 text-left last:border-b-0">
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] text-ink">{label}</span>
        <span className="block text-[14px] text-grey">{sub}</span>
      </span>
      <span className="relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200" style={{ background: on ? "#1b1b1b" : "#e3e3e3" }}>
        <span className="absolute top-[2px] size-[27px] rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.2)] transition-transform duration-200" style={{ transform: `translateX(${on ? 22 : 2}px)`, transitionTimingFunction: "var(--ease-out)" }} />
      </span>
    </button>
  );
}

export function Refine({ open, onClose, initial, onApply, place }: { open: boolean; onClose: () => void; initial: RefineState; onApply: (s: RefineState) => void; place: string }) {
  const [s, setS] = useState(initial);
  const set = (k: keyof RefineState) => (v: boolean) => setS((x) => ({ ...x, [k]: v }));
  return (
    <Sheet open={open} onClose={onClose} title="Refine">
      <div>
        <Switch on={s.telehealth} onChange={set("telehealth")} label="Telehealth only" sub="See them by video from home" />
        <Switch on={s.anywhere} onChange={set("anywhere")} label="All of Queensland" sub={`Beyond 20 km of ${place}`} />
        <Switch on={s.woman} onChange={set("woman")} label="A woman doctor" sub="Only doctors who are women" />
        <Switch on={s.child} onChange={set("child")} label="Sees children" sub="For a child under 12" />
      </div>
      <Cta fixed={false} onClick={() => onApply(s)}>Show my picks</Cta>
    </Sheet>
  );
}
