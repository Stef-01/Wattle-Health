"use client";
// Results as a journey (2026-10-17): the top match first, as a whole profile. Reaching the end of
// it reveals the second, then the third. Three is the limit; more means searching again with a
// different sentence. Empty: "No strong match yet" with the counts the engine reported.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Card, SearchResponse } from "@/src/data/search-types";
import { doctorHref } from "@/src/data/doctor-slug";
import { Avatar, Body, Cta, Divider, Gap, Row, Screen, Sliders, TabBar } from "@/src/ui/kit";
import { getCurrentRequest, getSavedIds, REQUEST_VERSION, setDraft, toggleSavedId, type StoredRequest } from "@/src/ui/store";
import { ProfileBody } from "@/src/ui/screens/patient-b/Profile";
import { ContactCta, ShareCircle } from "@/src/ui/screens/patient-b/ProfileClient";
import { placeOf, primaryRoom, specialtyTitle } from "@/src/ui/screens/patient-b/facts";
import { Dock } from "./Dock";
import { MatchPanel } from "./MatchPanel";
import { Highlights } from "./Highlights";
import { applyRefine, readRefine, Refine, type RefineState } from "./Refine";
import { REACH_KM, restoreCounts, runMatch } from "./lib";

const ORDINAL = ["Your top match", "Your second match", "Your third match"];
const MAX = 3;

/** "Endometriosis, with a doctor who listens. Telehealth, anywhere in Queensland." Specialties stay implicit; nothing is said twice. */
function heardSentence(req: StoredRequest): string {
  const tele = /telehealth only/i.test(req.sentence);
  const chips = req.response.chips.filter((c) => c.kind !== "specialty" && !(tele && /telehealth|video/i.test(c.label)));
  const what = chips.filter((c) => c.kind === "condition").map((c) => c.label);
  const how = chips.filter((c) => c.kind !== "condition").map((c) => c.label.toLowerCase());
  const parts = how.map((l) => (/^(listens|explains|takes|believes|gets)/.test(l) ? `who ${l}` : `with ${l.replace(/^(a |an )/, "")}`));
  const head = what.length ? what.join(" and ") : "";
  const who = parts.length ? `${head ? ", " : ""}a doctor ${parts.join(" and ")}` : "";
  const place = req.response.place.suburb?.replace(/ City$/, "");
  const where = req.anywhere ? "All of Queensland." : tele ? "Telehealth, anywhere in Queensland." : place ? `Within ${REACH_KM} km of ${place}.` : "";
  return [head || who ? `${(head + who).charAt(0).toUpperCase()}${(head + who).slice(1)}.` : "", where].filter(Boolean).join(" ");
}

export function Matches() {
  const router = useRouter();
  const [req, setReq] = useState<StoredRequest | null>(null);
  const [missing, setMissing] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState(1);
  const [reading, setReading] = useState(0);
  const [refining, setRefining] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const found = getCurrentRequest();
    setSaved(getSavedIds());
    if (!found) return setMissing(true);
    if ((found.v ?? 0) < REQUEST_VERSION) {
      setBusy(true);
      runMatch({ sentence: found.sentence, suburb: found.suburb, removed: found.removed, anywhere: found.anywhere, id: found.id, exclude: found.exclude, answers: found.answers })
        .then(setReq)
        .catch(() => setReq(found))
        .finally(() => setBusy(false));
      return;
    }
    setReq(found);
  }, []);

  const res: SearchResponse | null = req?.response ?? null;
  const cards = (res?.cards ?? []).slice(0, MAX);
  const labels = res?.conditionLabels ?? {};
  const place = (res?.place.suburb ?? req?.suburb ?? "Brisbane").replace(/ City$/, "");

  // Which match is under the top third of the screen, for the progress dots.
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("section[data-match]"));
    if (els.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setReading(Number(e.target.getAttribute("data-match")));
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [shown]);

  // Reaching the end of the last shown profile reveals the next one.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || shown >= cards.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setShown((n) => Math.min(n + 1, cards.length));
      },
      { rootMargin: "0px 0px -15% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown, cards.length]);

  async function rerun(input: { anywhere?: boolean; sentence?: string }) {
    if (!req || busy) return;
    setBusy(true);
    try {
      setReq(await runMatch({ sentence: input.sentence ?? req.sentence, suburb: req.suburb, removed: req.removed, anywhere: input.anywhere ?? req.anywhere, id: req.id, exclude: req.exclude, answers: req.answers }));
      setShown(1);
    } finally {
      setBusy(false);
    }
  }

  async function refine(s: RefineState) {
    if (!req) return;
    setRefining(false);
    await rerun({ sentence: applyRefine(req.sentence, s), anywhere: s.anywhere });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function searchAgain() {
    setDraft("");
    router.push("/");
  }

  return (
    <Screen padBottom="pb-[120px]">
      {cards.length > 1 ? (
        <div className="material sticky top-0 z-10 -mx-7 mb-3 flex items-center justify-center gap-2 px-7 py-3" aria-label={`Reading match ${reading + 1} of ${cards.length}`}>
          {cards.map((c, i) => (
            <span key={c.doctor.id} className="h-1.5 rounded-full transition-all duration-300" style={{ width: i === reading ? 28 : 8, background: i === reading ? "#2f5d3a" : i < shown ? "#b9c9bd" : "#e3e3e3", transitionTimingFunction: "var(--ease-out)" }} />
          ))}
        </div>
      ) : null}
      {req ? (
        <div className="flex items-start gap-4">
          <p className="min-w-0 flex-1 text-[15px] leading-[1.5] text-grey">
            {heardSentence(req)}{" "}
            <Link href="/" onClick={() => setDraft(req.sentence)} className="press-dim text-accent">Edit</Link>
          </p>
          <button type="button" onClick={() => setRefining(true)} className="press inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-hairline px-4 text-[15px] text-ink">
            <Sliders size={16} /> Refine
          </button>
        </div>
      ) : null}
      {req?.answers?.some((a) => /Talking it through|talk to someone/i.test(a.answer)) ? (
        <p className="mt-3 rounded-[16px] px-4 py-3 text-[14px] leading-[1.5] text-charcoal" style={{ background: "#f8f6f3" }}>
          Wattle lists doctors. For talking therapy, start with a GP: a Mental Health Treatment Plan gives you Medicare-subsidised sessions with a psychologist.
        </p>
      ) : null}
      {req && cards.length > 0 ? (
        <p className="mt-3 text-[14px] leading-[1.6] text-grey">
          Follow up:{" "}
          {[
            { label: "By video instead", on: { telehealth: true } },
            { label: "A woman doctor", on: { woman: true } },
            { label: "Anywhere in Queensland", on: { anywhere: true } },
          ].map((f, i) => (
            <span key={f.label}>
              {i > 0 ? " · " : ""}
              <button type="button" onClick={() => void refine({ ...readRefine(req.sentence, req.anywhere === true), ...f.on })} className="press-dim text-accent">{f.label}</button>
            </span>
          ))}
        </p>
      ) : null}
      {req ? <Refine key={`${req.sentence}|${req.anywhere}`} open={refining} onClose={() => setRefining(false)} initial={readRefine(req.sentence, req.anywhere === true)} onApply={(s) => void refine(s)} place={place} /> : null}
      {res?.emergency ? (
        <>
          <Gap h={16} />
          <Body className="text-[16px]">{res.emergency.note}</Body>
        </>
      ) : null}
      <Gap h={24} />
      {missing ? <Body>No search yet.</Body> : null}
      {res && cards.length === 0 ? (
        <Empty res={res} place={place} busy={busy} onWiden={() => void rerun({ anywhere: true })} onTelehealth={() => void rerun({ sentence: `${req!.sentence}, telehealth only` })} onChange={() => router.push("/")} onClosest={() => void rerun({ anywhere: true })} />
      ) : null}
      <div className="flex flex-col" style={busy ? { opacity: 0.5, transition: "opacity 150ms ease" } : { transition: "opacity 150ms ease" }}>
        {cards.slice(0, shown).map((card, i) => (
          <div key={card.doctor.id}>
            {i > 0 ? <div className="my-12 h-px w-full bg-divider" aria-hidden="true" /> : null}
            <MatchPanel telehealthOnly={/telehealth only/i.test(req?.sentence ?? "")} newPatientMatters={Boolean(req?.answers?.some((a) => a.ask === "Experience"))} card={card} index={i} total={cards.length} labels={labels} saved={saved.includes(card.doctor.id)} onSave={() => setSaved(toggleSavedId(card.doctor.id, req?.response.chips.find((c) => c.kind === "condition")?.label))} />
          </div>
        ))}
        {shown < cards.length ? (
          <div ref={sentinel} className="mt-12 flex flex-col items-center gap-3 py-6 text-center">
            <span className="search-orb" style={{ width: 28, height: 28 }} aria-hidden="true" />
            <p className="text-[14px] text-grey">Keep scrolling for your {shown === 1 ? "second" : "third"} match</p>
          </div>
        ) : null}
        {cards.length > 0 && shown >= cards.length ? (
          <div className="rise mt-12 rounded-[24px] px-6 py-8 text-center" style={{ background: "#f5f8f6" }}>
            <div className="mb-5 flex justify-center -space-x-3">
              {cards.map((c) =>
                c.doctor.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={c.doctor.id} src={c.doctor.photo.url} alt={c.doctor.name.display} referrerPolicy="no-referrer" className="size-14 rounded-full border-[3px] border-white object-cover object-top shadow-[0_4px_10px_rgba(0,0,0,0.12)]" style={{ background: "#e9e9e9" }} />
                ) : (
                  <span key={c.doctor.id} className="rounded-full border-[3px] border-white"><Avatar name={c.doctor.name.display} size={50} /></span>
                ),
              )}
            </div>
            <p className="font-display text-[24px] leading-tight text-ink">That is your {cards.length === 1 ? "match" : cards.length === 2 ? "two" : "three"}.</p>
            <p className="mt-2 text-[15px] leading-[1.5] text-grey">Wattle shows three at a time so each one gets a proper read. Search again to meet different doctors.</p>
            <div className="mt-6">
              <Cta fixed={false} onClick={searchAgain}>Search again</Cta>
            </div>
          </div>
        ) : null}
      </div>
      {res && cards.length > 0 ? (
        <>
          <Gap h={16} />
          <p className="caption text-[13px] leading-normal text-grey">{res.orderNote.replace(/ and ([A-Z])(?=[a-z ])/g, (_m, c: string) => ` and ${c.toLowerCase()}`)}</p>
        </>
      ) : null}
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
