"use client";
// P09 Why this pick (226:257). Clinical and Personal sections built strictly from the engine's
// clinicalFit.reasons and humanFit.reasons for this doctor in the current request. Each row's
// sub is the source, tier and date the reason rests on, with an external link when the source
// has a URL. No personal profile → "No personal profile yet". No search yet → say so.
import { useEffect, useState } from "react";
import type { DoctorRecord } from "@/src/data/types";
import type { Ranked, Reason } from "@/src/matching/types";
import { Body, Divider, FigmaIcon, Screen, SourceRow, TopBar } from "@/src/ui/kit";
import { getCurrentRequest, getMatch, setMatch, type StoredMatch } from "@/src/ui/store";
import { Space } from "./bits";

/** Mirrors NO_PROFILE_REASON in src/matching/layer2 (not imported: that module reads yaml with fs). */
const NO_PROFILE_REASON = "No personal profile yet";
import { drShort, humanReason, sourceForReason } from "./facts";
import { fetchRerank } from "./rerank-client";
import { doctorSlug } from "@/src/data/doctor-slug";

type State = { kind: "loading" } | { kind: "none" } | { kind: "absent" } | { kind: "ready"; ranked: Ranked };

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

function ReasonRows({ doctor, reasons }: { doctor: DoctorRecord; reasons: Reason[] }) {
  return (
    <>
      {reasons.map((r, i) => {
        const s = sourceForReason(doctor, r);
        return (
          <div key={`${r.field}-${r.label ?? i}`}>
            <SourceRow icon={<FigmaIcon name="check" size={17} />} title={humanReason(r.text)} sub={s.text} href={s.href} />
            <Divider />
          </div>
        );
      })}
    </>
  );
}

export function Why({ doctor: d }: { doctor: DoctorRecord }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  useEffect(() => {
    let live = true;
    loadMatch()
      .then((m) => {
        if (!live) return;
        if (!m) return setState({ kind: "none" });
        const ranked = m.survivors.find((r) => r.doctor.id === d.id);
        setState(ranked ? { kind: "ready", ranked } : { kind: "absent" });
      })
      .catch(() => live && setState({ kind: "none" }));
    return () => {
      live = false;
    };
  }, [d.id]);

  const id = doctorSlug(d.id);
  const clinical = state.kind === "ready" ? state.ranked.clinicalFit.reasons : [];
  const human = state.kind === "ready" ? state.ranked.humanFit : null;
  const personal = human ? human.reasons.filter((r) => r.text !== NO_PROFILE_REASON) : [];
  const noProfile = !human || human.basis === "none" || personal.length === 0;

  return (
    <Screen padBottom="pb-[60px]">
      <TopBar title={`Why ${drShort(d)}`} back={`/doctor/${id}`} />
      <Space h={30} />
      {state.kind === "loading" ? <Body>Reading the pick…</Body> : null}
      {state.kind === "none" ? <Body>Search first to see why this provider was picked.</Body> : null}
      {state.kind === "absent" ? <Body>{drShort(d)} was not in your last matches.</Body> : null}
      {state.kind === "ready" ? (
        <>
          <h2 className="text-title3 text-ink">Clinical</h2>
          <Space h={4} />
          {clinical.length > 0 ? (
            <ReasonRows doctor={d} reasons={clinical} />
          ) : (
            <>
              <SourceRow icon={<FigmaIcon name="check" size={17} />} title="Listed for this specialty" sub={sourceForReason(d, { text: "", field: "specialty" }).text} href={sourceForReason(d, { text: "", field: "specialty" }).href} />
              <Divider />
            </>
          )}
          <Space h={30} />
          <h2 className="text-title3 text-ink">Personal</h2>
          <Space h={4} />
          {noProfile ? (
            <>
              <SourceRow icon={<FigmaIcon name="file" size={17} />} title="No personal profile yet" sub={human?.basis === "none" ? "Nothing shared by the doctor" : "Nothing aligned with what you asked"} />
              <Divider />
            </>
          ) : (
            <ReasonRows doctor={d} reasons={personal} />
          )}
          <Space h={22} />
          <p className="text-subhead text-grey">Every reason links to its source.</p>
        </>
      ) : null}
    </Screen>
  );
}
