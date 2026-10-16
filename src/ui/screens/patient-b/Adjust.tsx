"use client";
// P08 What matters most (226:209). Three sections of toggle pills. Clinical pills weight the
// documented-interest and research signals, Personal pills weight the philosophy and lived-
// experience signals and add the matching human-fit labels to the intent, Practical pills edit
// the distance, gender and telehealth constraints. "Update matches" reranks the stored Layer-1
// survivors (server side, the vocabulary lives on disk) and returns to /results. Choices persist
// in sessionStorage under the request id.
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { HumanFitWeights } from "@/src/matching/layer2";
import { Check, Cta, Screen, TopBar } from "@/src/ui/kit";
import { getAdjust, getCurrentRequest, getMatch, setAdjust, setMatch, setRequest, type StoredRequest } from "@/src/ui/store";
import { Space } from "./bits";
import { fetchRerank, type RerankEdits } from "./rerank-client";

const SECTIONS: { title: string; pills: string[] }[] = [
  { title: "Clinical", pills: ["Experience", "Research", "Procedures"] },
  { title: "Personal", pills: ["Feels heard", "Shared experience", "Philosophy"] },
  { title: "Practical", pills: ["20 km", "Any gender", "Telehealth"] },
];

/** The P08 frame's starting state. */
const DEFAULT_ON = ["Experience", "Procedures", "Feels heard", "Philosophy"];

export function weightsFor(on: Set<string>): HumanFitWeights {
  return {
    clinicalInterests: on.has("Experience") || on.has("Procedures") ? 1 : 0,
    research: on.has("Research") ? 1 : 0,
    philosophy: on.has("Feels heard") || on.has("Philosophy") ? 1 : 0,
    livedExperience: on.has("Shared experience") ? 1 : 0,
    populations: 1,
  };
}

export function editsFor(on: Set<string>): RerankEdits {
  const humanFit: string[] = [];
  if (on.has("Feels heard")) humanFit.push("listens");
  if (on.has("Shared experience")) humanFit.push("lived-experience");
  const edits: RerankEdits = { humanFit };
  if (on.has("20 km")) edits.maxKm = 20;
  if (on.has("Any gender")) edits.anyGender = true;
  if (on.has("Telehealth")) edits.telehealthOnly = true;
  return edits;
}

export function Adjust() {
  const router = useRouter();
  const [req, setReq] = useState<StoredRequest | null | undefined>(undefined);
  const [on, setOn] = useState<Set<string>>(new Set(DEFAULT_ON));
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const found = getCurrentRequest();
    setReq(found);
    if (found) {
      const saved = getAdjust(found.id);
      if (saved) setOn(new Set(saved.on));
    }
  }, []);

  const toggle = (label: string) => {
    const next = new Set(on);
    if (next.has(label)) next.delete(label);
    else next.add(label);
    setOn(next);
    if (req) setAdjust({ requestId: req.id, on: [...next] });
  };

  async function update() {
    if (!req || busy) {
      if (!req) router.push("/");
      return;
    }
    setBusy(true);
    setFailed(false);
    try {
      const stored = getMatch(req.id);
      const ask = { sentence: req.sentence, suburb: req.anywhere ? "" : req.suburb, removed: req.removed };
      const out = await fetchRerank({
        ...(stored ? { survivors: stored.survivors, intent: stored.intent } : {}),
        ask,
        weights: weightsFor(on),
        edits: editsFor(on),
        chips: req.response.chips,
      });
      setMatch({ requestId: req.id, intent: out.intent, survivors: out.survivors, at: new Date().toISOString() });
      setRequest({ ...req, response: out.response, at: new Date().toISOString() });
      router.push("/results");
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <Screen padBottom="pb-[140px]">
      <TopBar title="What matters most" back="/results" />
      <Space h={30} />
      {SECTIONS.map((s, i) => (
        <div key={s.title}>
          {i > 0 ? <Space h={32} /> : null}
          <h2 className="display text-[22px] text-ink">{s.title}</h2>
          <Space h={8} />
          {s.pills.map((p) => (
            <button key={p} type="button" role="switch" aria-checked={on.has(p)} onClick={() => toggle(p)} className="press press-soft flex w-full items-center justify-between border-b border-divider py-3.5 text-left">
              <span className={`text-[17px] ${on.has(p) ? "text-ink" : "text-grey"}`}>{p}</span>
              <span className={`inline-flex size-6 items-center justify-center rounded-full border ${on.has(p) ? "border-ink bg-ink text-white" : "border-hairline text-transparent"}`}><Check size={14} /></span>
            </button>
          ))}
        </div>
      ))}
      <Space h={30} />
      <p className="text-[14px] leading-normal text-grey">{req === null ? "Search first, then choose what matters." : failed ? "Could not update. Try again." : "Clinical needs come first."}</p>
      <Cta onClick={() => void update()} disabled={busy}>{busy ? "Updating" : "Update matches"}</Cta>
    </Screen>
  );
}
