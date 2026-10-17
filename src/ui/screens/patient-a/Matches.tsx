"use client";
// Results (2026-10-16, v3): what we heard as a pill strip you can edit in place, two inline
// toggles (telehealth only, all of Queensland), then the ranked cards. Empty: the "No strong
// match yet" options with the counts the engine reported. Flow is Home → here → profile.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { SearchResponse } from "@/src/data/search-types";
import { Body, Cta, Divider, Gap, Row, Screen, Sliders, TabBar } from "@/src/ui/kit";
import { getCurrentRequest, getSavedIds, setDraft, toggleSavedId, type StoredRequest } from "@/src/ui/store";
import { Dock } from "./Dock";
import { DoctorCard } from "./DoctorCard";
import { REACH_KM, restoreCounts, runMatch } from "./lib";

/** "Endometriosis, someone who listens. Within 20 km of Brisbane." Specialties stay implicit. */
function heardSentence(req: StoredRequest): string {
  const chips = req.response.chips.filter((c) => c.kind !== "specialty");
  const words = chips.map((c, i) => (i === 0 ? c.label : c.label.toLowerCase()));
  const place = req.response.place.suburb?.replace(/ City$/, "");
  const where = req.anywhere ? "All of Queensland." : place ? `Within ${REACH_KM} km of ${place}.` : "";
  return [words.length ? `${words.join(", ")}.` : "", where].filter(Boolean).join(" ");
}

export function Matches() {
  const router = useRouter();
  const [req, setReq] = useState<StoredRequest | null>(null);
  const [missing, setMissing] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const found = getCurrentRequest();
    if (!found) setMissing(true);
    else setReq(found);
    setSaved(getSavedIds());
  }, []);

  async function rerun(input: { anywhere?: boolean; sentence?: string }) {
    if (!req || busy) return;
    setBusy(true);
    try {
      setReq(await runMatch({ sentence: input.sentence ?? req.sentence, suburb: req.suburb, removed: req.removed, anywhere: input.anywhere ?? req.anywhere, id: req.id }));
    } finally {
      setBusy(false);
    }
  }

  const res: SearchResponse | null = req?.response ?? null;
  const cards = res?.cards ?? [];
  const labels = res?.conditionLabels ?? {};
  const place = (res?.place.suburb ?? req?.suburb ?? "Brisbane").replace(/ City$/, "");

  return (
    <Screen padBottom="pb-[110px]">
      <div className="flex items-center justify-between">
        <h1 className="display text-[28px] tracking-[-0.02em] text-ink">Your matches</h1>
        <Link href="/adjust" className="press-dim -mr-2 inline-flex h-11 items-center gap-1.5 px-2 text-[15px] font-medium text-accent"><Sliders size={16} />Adjust</Link>
      </div>
      {req ? (
        <>
          <Gap h={8} />
          <p className="text-[15px] leading-[1.5] text-grey">
            {heardSentence(req)}
            {" "}
            <Link href="/" onClick={() => setDraft(req.sentence)} className="press-dim text-accent">Edit</Link>
          </p>
          {res?.emergency ? (
            <>
              <Gap h={16} />
              <Body className="text-[16px]">{res.emergency.note}</Body>
            </>
          ) : null}
        </>
      ) : null}
      <Gap h={24} />
      {missing ? <Body>No search yet.</Body> : null}
      {res && cards.length === 0 ? (
        <Empty res={res} place={place} busy={busy} onWiden={() => void rerun({ anywhere: true })} onTelehealth={() => void rerun({ sentence: `${req!.sentence}, telehealth only` })} onChange={() => router.push("/")} onClosest={() => void rerun({ anywhere: true })} />
      ) : null}
      <div className="flex flex-col gap-7" style={busy ? { opacity: 0.5, transition: "opacity 150ms ease" } : { transition: "opacity 150ms ease" }}>
        {cards.map((card, i) => (
          <DoctorCard key={card.doctor.id} card={card} labels={labels} index={i} saved={saved.includes(card.doctor.id)} onSave={() => setSaved(toggleSavedId(card.doctor.id))} />
        ))}
      </div>
      {res && cards.length > 0 ? (
        <>
          <Gap h={16} />
          <p className="caption text-[13px] leading-normal text-grey">{res.orderNote}</p>
          {res.careGuidance ? <p className="pt-3 text-[14px] leading-normal text-grey">{res.careGuidance}</p> : null}
        </>
      ) : null}
      <div className="frame-fixed pointer-events-none bottom-[88px] z-[9] h-[40px] bg-gradient-to-b from-white/0 to-white" aria-hidden="true" />
      <TabBar active="/" />
    </Screen>
  );
}

function Empty({ res, place, busy, onWiden, onTelehealth, onChange, onClosest }: { res: SearchResponse; place: string; busy: boolean; onWiden: () => void; onTelehealth: () => void; onChange: () => void; onClosest: () => void }) {
  const n = restoreCounts(res);
  const count = (v: number | null, unit: string) => (v !== null ? ` (${v}${unit})` : "");
  return (
    <div style={busy ? { opacity: 0.5 } : undefined}>
      <h2 className="display text-[20px] text-charcoal">No strong match yet</h2>
      <p className="pt-2 text-[14px] text-grey">
        Within {REACH_KM} km of {place}
      </p>
      <Gap h={24} />
      <Row title={`Widen to all of Queensland${count(n.widen, " doctors")}`} onClick={onWiden} />
      <Divider />
      <Row title={`Include telehealth only${count(n.telehealth, "")}`} onClick={onTelehealth} />
      <Divider />
      <Row title="Change what you need" onClick={onChange} />
      <Divider />
      <Dock bottom={94}>
        <Cta fixed={false} onClick={onClosest} disabled={busy}>
          Show closest fits
        </Cta>
      </Dock>
    </div>
  );
}
