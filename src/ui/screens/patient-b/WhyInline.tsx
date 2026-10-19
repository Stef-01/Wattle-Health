"use client";
// "Why this pick" folded into the profile: the engine's clinical and human-fit reasons for this
// doctor in the current request, each with its source. Renders nothing when there is no
// current search or the doctor was not in it (a profile opened from Saved, say).
import { useEffect, useState } from "react";
import type { DoctorRecord } from "@/src/data/types";
import type { Ranked, Reason } from "@/src/matching/types";
import { Disclosure, FigmaIcon, SourceRow } from "@/src/ui/kit";
import { getCurrentRequest, getMatch, setMatch, type StoredMatch } from "@/src/ui/store";
import { humanReason, sourceForReason } from "./facts";
import { fetchRerank } from "./rerank-client";

const NO_PROFILE_REASON = "No personal profile yet";

async function loadMatch(): Promise<StoredMatch | null> {
  const req = getCurrentRequest();
  if (!req) return null;
  const cached = getMatch(req.id);
  if (cached) return cached;
  const out = await fetchRerank({ ask: { sentence: req.sentence, suburb: req.anywhere ? "" : req.suburb, removed: req.removed } });
  const m: StoredMatch = { requestId: req.id, intent: out.intent, survivors: out.survivors, at: new Date().toISOString() };
  setMatch(m);
  return m;
}

export function WhyInline({ doctor: d }: { doctor: DoctorRecord }) {
  const [ranked, setRanked] = useState<Ranked | null>(null);
  useEffect(() => {
    let live = true;
    loadMatch()
      .then((m) => {
        if (!live || !m) return;
        setRanked(m.survivors.find((r) => r.doctor.id === d.id) ?? null);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [d.id]);
  if (!ranked) return null;
  const reasons: Reason[] = [...ranked.clinicalFit.reasons, ...ranked.humanFit.reasons.filter((r) => r.text !== NO_PROFILE_REASON)];
  if (reasons.length === 0) return null;
  const first = humanReason(reasons[0]!.text);
  return (
    <Disclosure tint="why" title="Why this pick" sub={`${first}${reasons.length > 1 ? ` and ${reasons.length - 1} more` : ""}`}>
      {reasons.map((r, i) => {
        const s = sourceForReason(d, r);
        return <SourceRow key={`${r.field}-${r.label ?? i}`} icon={<FigmaIcon name="check" size={17} />} title={humanReason(r.text)} sub={s.text} href={s.href} />;
      })}
    </Disclosure>
  );
}
