"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { search } from "@/src/data/api";
import { DEFAULT_WEIGHTS, type Chip, type SearchResponse, type Weights } from "@/src/data/search-types";
import type { DoctorRecord } from "@/src/data/types";
import { DoctorCard } from "./DoctorCard";
import { getAsk, getCompare, getResults, getSaved, setAsk, setResults, toggleCompare, toggleSaved, type Ask } from "./store";

const CHIP_GROUP: Record<Chip["kind"], string> = {
  condition: "Condition",
  specialty: "Specialties considered",
  must: "Must have",
  preference: "Preference",
  population: "For",
  human: "Human fit",
};
const SLIDERS: Array<{ key: keyof Weights; label: string }> = [
  { key: "clinical", label: "Clinical evidence" },
  { key: "communication", label: "Communication style" },
  { key: "lived", label: "Lived experience" },
  { key: "research", label: "Research" },
];

async function fetchMatch(ask: Ask): Promise<SearchResponse> {
  return search(ask);
}

export function Results() {
  const router = useRouter();
  const [ask, setAskState] = useState<Ask | null>(null);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState<DoctorRecord[]>([]);
  const [compare, setCompare] = useState<DoctorRecord[]>([]);
  const timer = useRef<number | null>(null);

  const run = useCallback(async (next: Ask) => {
    setBusy(true);
    setFailed(false);
    setAsk(next);
    setAskState(next);
    try {
      const r = await fetchMatch(next);
      setResults(r);
      setData(r);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const prior = getAsk();
    setSaved(getSaved());
    setCompare(getCompare());
    if (!prior) {
      router.replace("/");
      return;
    }
    const cached = getResults();
    if (cached) {
      setAskState(prior);
      setData(cached);
      setBusy(false);
    } else void run(prior);
  }, [router, run]);

  if (!ask) return <p className="pt-6 text-ink-soft">Loading…</p>;

  if (data?.emergency) {
    return (
      <section className="rise mx-auto flex max-w-xl flex-col gap-4 pt-10">
        <h1 className="text-4xl">Call 000 now.</h1>
        <p className="text-lg">{data.emergency.note}</p>
        <a href="tel:000" className="flex min-h-12 items-center justify-center rounded-full bg-foliage text-base font-medium text-paper">Call 000</a>
        <Link href="/" className="text-foliage underline-offset-4 hover:underline">Start again</Link>
      </section>
    );
  }

  const removeChip = (chip: Chip) => void run({ ...ask, removed: [...ask.removed, chip.id] });
  const clearFilters = () => void run({ ...ask, removed: [], weights: DEFAULT_WEIGHTS });
  const setWeight = (key: keyof Weights, value: number) => {
    const next = { ...ask, weights: { ...ask.weights, [key]: value } };
    setAskState(next);
    setAsk(next);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void run(next), 250);
  };

  const groups = new Map<Chip["kind"], Chip[]>();
  for (const chip of data?.chips ?? []) groups.set(chip.kind, [...(groups.get(chip.kind) ?? []), chip]);
  const filtersOn = ask.removed.length > 0 || SLIDERS.some(({ key }) => ask.weights[key] !== DEFAULT_WEIGHTS[key]);

  return (
    <div className="flex flex-col gap-6 pt-4 lg:grid lg:grid-cols-[1fr_320px] lg:gap-8">
      <div className="flex flex-col gap-6">
        <section aria-labelledby="read" className="rounded-card border border-line bg-mist/60 p-4">
          <div className="flex items-center justify-between">
            <h1 id="read" className="text-xl">How we read it</h1>
            <button type="button" onClick={() => router.push("/")} className="min-h-11 px-2 text-sm text-foliage underline-offset-4 hover:underline">
              Search again
            </button>
          </div>
          {groups.size === 0 ? (
            <p className="mt-2 text-sm text-ink-soft">No clinical terms we recognise yet. Everyone listed near {data?.place.suburb ?? ask.suburb} is shown.</p>
          ) : (
            <dl className="mt-2 flex flex-col gap-2">
              {[...groups.entries()].map(([kind, chips]) => (
                <div key={kind} className="flex flex-wrap items-center gap-2">
                  <dt className="w-full text-xs text-ink-soft sm:w-auto">{CHIP_GROUP[kind]}</dt>
                  {chips.map((chip) => (
                    <dd key={chip.id} className="m-0">
                      <span className="inline-flex min-h-9 items-center rounded-full border border-line bg-white pl-3 text-sm">
                        {chip.label.charAt(0).toUpperCase() + chip.label.slice(1)}
                        {chip.removable ? (
                          <button type="button" onClick={() => removeChip(chip)} aria-label={`Remove ${chip.label}`} className="flex size-9 items-center justify-center text-ink-soft">
                            ×
                          </button>
                        ) : (
                          <span className="w-3" />
                        )}
                      </span>
                    </dd>
                  ))}
                </div>
              ))}
            </dl>
          )}
        </section>

        {failed && <p className="text-sm text-ink-soft">Something went wrong. <button type="button" onClick={() => void run(ask)} className="text-foliage underline">Try again</button></p>}
        {data && (
          <p className="text-sm text-ink-soft" aria-live="polite">
            {data.orderNote}
            {data.place.suburb === null ? ` We couldn’t find "${data.place.typed}", so distances are off.` : ""}
          </p>
        )}

        <section aria-label="Doctors" className={`flex flex-col gap-4 ${busy ? "opacity-60" : ""}`} aria-busy={busy}>
          {data?.cards.map((card, i) => (
            <DoctorCard
              key={card.doctor.id}
              card={card}
              rank={i + 1}
              saved={saved.some((d) => d.id === card.doctor.id)}
              comparing={compare.some((d) => d.id === card.doctor.id)}
              onSave={() => setSaved(toggleSaved(card.doctor))}
              onCompare={() => setCompare(toggleCompare(card.doctor))}
            />
          ))}
          {data && data.cards.length === 0 && !busy && (
            <p className="text-sm">
              Nobody listed yet.
              {data.unserved?.map((u) => (
                <span key={u.ask} className="block text-ink-soft">
                  Without “{u.ask}”: {u.restoreCount} more
                </span>
              ))}
            </p>
          )}
        </section>
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
        <section aria-labelledby="matters" className="rounded-card border border-line bg-white p-4">
          <h2 id="matters" className="text-lg">What matters most</h2>
          <div className="mt-2 flex flex-col gap-1">
            {SLIDERS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-3 text-sm">
                <span className="w-40 shrink-0">{label}</span>
                <input type="range" min={0} max={1} step={0.25} value={ask.weights[key]} onChange={(e) => setWeight(key, Number(e.target.value))} className="w-full" />
              </label>
            ))}
          </div>
          {filtersOn && (
            <button type="button" onClick={clearFilters} className="mt-2 min-h-11 text-sm text-foliage underline-offset-4 hover:underline">
              Clear filters
            </button>
          )}
        </section>
        {compare.length > 0 && (
          <Link href="/compare" className="flex min-h-11 items-center justify-center rounded-full border border-foliage text-sm text-foliage">
            Compare {compare.length === 2 ? "two" : "one"}
          </Link>
        )}
      </aside>
    </div>
  );
}
