"use client";
import { Orb } from "@/src/ui/kit/Orb";
// Results as a journey (2026-10-17): the top match first, as a whole profile. Reaching the end of
// it reveals the second, then the third. Three is the limit; more means searching again with a
// different sentence. Empty: "No strong pick yet" with the counts the engine reported.
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Card, SearchResponse } from "@/src/data/search-types";
import { doctorHref } from "@/src/data/doctor-slug";
import { Body, Button, Cell, Cta, Face, Gap, Group, Screen, Sliders, useSticking } from "@/src/ui/kit";
import { getCurrentRequest, getSavedIds, REQUEST_VERSION, setDraft, toggleSavedId, type StoredRequest } from "@/src/ui/store";
import { ProfileBody } from "@/src/ui/screens/patient-b/Profile";
import { ContactCta, ShareCircle } from "@/src/ui/screens/patient-b/ProfileClient";
import { placeOf, primaryRoom, specialtyTitle } from "@/src/ui/screens/patient-b/facts";
import { Dock } from "./Dock";
import { MatchPanel } from "./MatchPanel";
import { Highlights } from "./Highlights";
import { applyRefine, readRefine, Refine, type RefineState } from "./Refine";
import { REACH_KM, restoreCounts, runMatch } from "./lib";

const ORDINAL = ["Your top pick", "Your second pick", "Your third pick"];
const MAX = 3;

/** "Endometriosis, with a doctor who listens. Telehealth, anywhere in Australia." Specialties stay implicit; nothing is said twice. */
function heardSentence(req: StoredRequest): string {
  const tele = /telehealth only/i.test(req.sentence);
  const chips = req.response.chips.filter((c) => c.kind !== "specialty" && !(tele && /telehealth|video/i.test(c.label)));
  const what = chips.filter((c) => c.kind === "condition").map((c) => c.label);
  const how = chips.filter((c) => c.kind !== "condition" && c.kind !== "population").map((c) => c.label.toLowerCase());
  const forWho = chips.filter((c) => c.kind === "population").map((c) => c.label.toLowerCase()).map((l) => `for ${/^[aeiou]/.test(l) ? "an" : "a"} ${l}`);
  // adjective labels read as a clause ("a doctor who looks at the whole picture", never "a doctor with holistic")
  const CLAUSE: Record<string, string> = { holistic: "who looks at the whole picture" };
  const parts = how.map((l) => CLAUSE[l] ?? (/^(listens|explains|takes|believes|gets)/.test(l) ? `who ${l}` : `with ${l.replace(/^(a |an )/, "")}`));
  const head = what.length ? what.join(" and ") : "";
  const who = parts.length ? `${head ? ", " : ""}a doctor ${parts.join(" and ")}` : "";
  const place = req.response.place.suburb?.replace(/ City$/, "");
  const where = req.anywhere ? "Anywhere in Australia." : tele ? "Telehealth, anywhere in Australia." : place ? `Within ${REACH_KM} km of ${place}.` : "";
  const line = [head, forWho.join(" and ")].filter(Boolean).join(" ") + who;
  return [line ? `${line.charAt(0).toUpperCase()}${line.slice(1)}.` : "", where].filter(Boolean).join(" ");
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
  const edge = useSticking<HTMLDivElement>();

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
    <Screen padBottom="pb-[120px]" className="frame-wide">
      <div ref={edge.sentinel} aria-hidden="true" className="-mt-2 h-px" />
      {cards.length > 1 ? (
        <div className="bleed sticky top-0 z-10 -mt-px mb-2 flex h-11 items-center justify-center gap-1.5" aria-label={`Reading pick ${reading + 1} of ${cards.length}`}>
          <span aria-hidden="true" className="scroll-edge pointer-events-none absolute inset-x-0 -top-2 h-[64px]" data-on={edge.sticking} data-ready={edge.ready} />
          {cards.map((c, i) => (
            <span key={c.doctor.id} className="relative h-[7px] rounded-full transition-[width,background-color] duration-300" style={{ width: i === reading ? 22 : 7, background: i === reading ? "var(--color-ink)" : i < shown ? "#aeaeb2" : "#d1d1d6", transitionTimingFunction: "var(--ease-out)" }} />
          ))}
        </div>
      ) : null}
      {req ? (
        <section aria-label="Your search" className="rounded-card bg-surface-soft p-4 lg:max-w-[calc(100%-564px)]">
          <p className="text-footnote text-grey">You searched</p>
          <p className="mt-0.5 text-headline text-ink">{heardSentence(req)}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button href="/" kind="gray" size="small" className="bg-white" onClick={() => setDraft(req.sentence)}>Edit</Button>
            <Button kind="gray" size="small" className="bg-white" onClick={() => setRefining(true)} icon={<Sliders size={15} />}>Refine</Button>
          </div>
          {cards.length > 0 ? (
            <div className="mt-3 border-t-[length:var(--hairline)] border-hairline pt-3">
              <p className="text-footnote text-grey">Also try</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  { label: "By video", on: { telehealth: true } },
                  { label: "A woman", on: { woman: true } },
                  { label: "Anywhere in Australia", on: { anywhere: true } },
                ].map((f) => (
                  <Button key={f.label} kind="gray" size="small" className="bg-white font-normal" onClick={() => void refine({ ...readRefine(req.sentence, req.anywhere === true), ...f.on })}>{f.label}</Button>
                ))}
              </div>
            </div>
          ) : null}
          {req.answers?.some((a) => /Talking it through|talk to someone/i.test(a.answer)) ? (
            <p className="mt-3 border-t-[length:var(--hairline)] border-hairline pt-3 text-subhead text-grey">For talking therapy, a psychologist is often the place to start. A GP’s Mental Health Treatment Plan gives you Medicare-subsidised sessions.</p>
          ) : null}
        </section>
      ) : null}
      {req ? <Refine key={`${req.sentence}|${req.anywhere}`} open={refining} onClose={() => setRefining(false)} initial={readRefine(req.sentence, req.anywhere === true)} onApply={(s) => void refine(s)} place={place} /> : null}
      {res?.emergency ? (
        <>
          <Gap h={16} />
          <Body>{res.emergency.note}</Body>
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
            {i > 0 ? <div className="hairline my-10 w-full" aria-hidden="true" /> : null}
            <MatchPanel telehealthOnly={/telehealth only/i.test(req?.sentence ?? "")} newPatientMatters={Boolean(req?.answers?.some((a) => a.ask === "Experience"))} card={card} index={i} total={cards.length} labels={labels} saved={saved.includes(card.doctor.id)} onSave={() => setSaved(toggleSavedId(card.doctor.id, req?.response.chips.find((c) => c.kind === "condition")?.label))} />
          </div>
        ))}
        {shown < cards.length ? (
          <div ref={sentinel} className="mt-12 flex flex-col items-center gap-3 py-6 text-center">
            <Orb size={28} />
            <p className="text-footnote text-grey">Keep scrolling for your {shown === 1 ? "second" : "third"} match</p>
          </div>
        ) : null}
        {cards.length > 0 && shown >= cards.length ? (
          <div className="rise mt-10 rounded-card bg-surface-soft px-5 py-7 text-center">
            <div className="mb-4 flex justify-center -space-x-3">
              {cards.map((c) => (
                <Face key={c.doctor.id} url={c.doctor.photo?.url} name={c.doctor.name.display} size={52} ring />
              ))}
            </div>
            <p className="text-title2 text-ink">That’s your {cards.length === 1 ? "pick" : cards.length === 2 ? "two" : "three"}.</p>
            <p className="mt-1.5 text-subhead text-grey">We show three at a time, so you can read each one properly. Search again to meet others.</p>
            <div className="mt-5">
              <Button full onClick={searchAgain}>Search again</Button>
            </div>
          </div>
        ) : null}
      </div>
      {res && cards.length > 0 ? (
        <>
          <Gap h={16} />
          <p className="text-footnote text-grey">{res.orderNote.replace(/ and ([A-Z])(?=[a-z ])/g, (_m, c: string) => ` and ${c.toLowerCase()}`)}</p>
        </>
      ) : null}
    </Screen>
  );
}

function Empty({ res, place, busy, onWiden, onTelehealth, onChange, onClosest }: { res: SearchResponse; place: string; busy: boolean; onWiden: () => void; onTelehealth: () => void; onChange: () => void; onClosest: () => void }) {
  const n = restoreCounts(res);
  const count = (v: number | null, unit: string) => (v !== null ? ` (${v}${unit})` : "");
  return (
    <div style={busy ? { opacity: 0.5 } : undefined}>
      <h2 className="text-title2 text-ink">No strong pick yet</h2>
      <p className="pt-1 text-subhead text-grey">
        Within {REACH_KM} km of {place}
      </p>
      <Gap h={24} />
      <Group tone="soft">
        <Cell tint title={`Widen to all of Australia${count(n.widen, " doctors")}`} onClick={onWiden} />
        <Cell tint title={`Add telehealth-only doctors${count(n.telehealth, "")}`} onClick={onTelehealth} />
        <Cell tint title="Change what you need" onClick={onChange} />
      </Group>
      <Dock bottom={16}>
        <Cta fixed={false} onClick={onClosest} disabled={busy}>
          Show closest fits
        </Cta>
      </Dock>
    </div>
  );
}
