"use client";
import { Brand, BRANDS, setBrand, useMode, type BrandId } from "@/src/ui/brand";
// Tab pages: /recent (localStorage recent searches), /saved (wattle.saved.v1 ids → cards),
// /me (name, join as a doctor, about). Each sits under the TabBar with its own dot.
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { lookup } from "@/src/data/api";
import { doctorHref } from "@/src/data/doctor-slug";
import type { DoctorRecord } from "@/src/data/types";
import { Body, Button, Cell, Clock, FaceStack, FigmaIcon, Group, GroupHeader, LargeTitle, Leaf, NavBar, Screen, Segmented, Toggle } from "@/src/ui/kit";
import { getOpeningsState, setOpeningsState } from "@/src/ui/openings";
import { Portrait } from "@/src/ui/screens/patient-a/DoctorCard";
import Link from "next/link";
import { getName, getPlace, getRecent, getRequest, getSavedContext, getSavedIds, setName, setPlace, setRequest, toggleSavedId, type RecentSearch } from "@/src/ui/store";
import { Space } from "./bits";
import { drName, placeOf, practicalChips, providerTitle, quoteOf } from "./facts";

const day = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
};

export function Recent() {
  const router = useRouter();
  const [rows, setRows] = useState<RecentSearch[] | null>(null);
  useEffect(() => setRows(getRecent()), []);
  const open = (r: RecentSearch) => {
    const req = getRequest(r.id);
    if (req) {
      setRequest(req);
      router.push("/results");
    } else router.push("/");
  };
  const groups = groupRecent(rows ?? []);
  const [only, setOnly] = useState<string | null>(null);
  const shown = only ? groups.filter((g) => g.condition === only) : groups;
  return (
    <Screen tone="grouped" padBottom="pb-[110px]">
      <NavBar title="Recent" collapse />
      <LargeTitle>Recent</LargeTitle>
      {rows && rows.length === 0 ? (
        <div className="mt-2 flex flex-col items-start gap-4">
          <Body>No searches yet.</Body>
          <Button href="/" size="medium">Start a search</Button>
        </div>
      ) : null}
      {groups.length > 1 ? <FilterChips label="Filter by condition" items={[null, ...groups.map((g) => g.condition)].map((c) => ({ key: c, label: c ?? "All", n: c === null ? rows?.length ?? 0 : groups.find((g) => g.condition === c)!.rows.length }))} value={only} onChange={setOnly} /> : null}
      {shown.map((g) => (
        <section key={g.condition}>
          {groups.length > 1 && !only ? <GroupHeader>{g.condition}</GroupHeader> : <div className="h-4" />}
          <Group sep={58}>
            {g.rows.map((r) => (
              <Cell key={r.id} bare={Boolean(r.faces?.length)} icon={r.faces?.length ? <FaceStack urls={r.faces} size={26} /> : <Clock size={17} />} title={groups.length > 1 && r.label.toLowerCase().startsWith(`${g.condition.toLowerCase()}, `) ? r.label.slice(g.condition.length + 2) : r.label} sub={`${r.matches} ${r.matches === 1 ? "pick" : "picks"}${day(r.at) ? `, ${day(r.at)}` : ""}`} onClick={() => open(r)} accessory="chevron" />
            ))}
          </Group>
        </section>
      ))}
    </Screen>
  );
}

/** Capsule filters with counts (Photos, Mail): the selected one filled in ink. */
function FilterChips<T extends string | null>({ items, value, onChange, label }: { items: { key: T; label: string; n: number }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="bleed chrome mt-2 flex gap-2 overflow-x-auto py-1 [scrollbar-width:none]">
      {items.map((it) => {
        const on = value === it.key;
        return (
          <button key={it.key ?? "all"} type="button" role="tab" aria-selected={on} onClick={() => onChange(it.key)} className={`press hit inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-subhead ${on ? "bg-ink text-white" : "bg-cell text-ink"}`}>
            {it.label} <span className={`tnum ${on ? "text-white/70" : "text-grey"}`}>{it.n}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Group by condition (from the search, else the label before its comma); biggest and most recent first. */
export function groupRecent(rows: RecentSearch[]): { condition: string; rows: RecentSearch[] }[] {
  const map = new Map<string, RecentSearch[]>();
  for (const r of rows) {
    const c = (r.condition ?? r.label.split(",")[0] ?? "Other").trim() || "Other";
    const key = c.charAt(0).toUpperCase() + c.slice(1);
    map.set(key, [...(map.get(key) ?? []), r]);
  }
  const latest = (g: RecentSearch[]) => Math.max(...g.map((r) => Date.parse(r.at) || 0));
  return [...map.entries()]
    .map(([condition, rs]) => ({ condition, rows: rs.sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0)) }))
    .sort((a, b) => b.rows.length - a.rows.length || latest(b.rows) - latest(a.rows));
}

export function Saved() {
  const [ids, setIds] = useState<string[] | null>(null);
  const [doctors, setDoctors] = useState<DoctorRecord[]>([]);
  useEffect(() => {
    const saved = getSavedIds();
    setIds(saved);
    if (saved.length === 0) return;
    lookup(saved)
      .then(setDoctors)
      .catch(() => setDoctors([]));
  }, []);
  const remove = (id: string) => {
    const next = toggleSavedId(id);
    setIds(next);
    setDoctors((ds) => ds.filter((d) => next.includes(d.id)));
  };
  const ctx = typeof window === "undefined" ? {} : getSavedContext();
  const groups = groupSaved(doctors, ctx);
  const [only, setOnly] = useState<string | null>(null);
  const [watch, setWatch] = useState<string[]>([]);
  useEffect(() => setWatch(getOpeningsState().muted ?? []), []);
  const muted = new Set(watch);
  const toggleWatch = (ids: string[], on: boolean) => {
    const next = on ? [...muted].filter((x) => !ids.includes(x)) : [...new Set([...muted, ...ids])];
    setWatch(next);
    setOpeningsState({ muted: next });
  };
  const shown = only ? groups.filter((g) => g.category === only) : groups;
  return (
    <Screen tone="grouped" padBottom="pb-[110px]">
      <NavBar onBack={only ? () => setOnly(null) : undefined} title={only ?? "Saved"} collapse />
      <LargeTitle>{only ?? "Saved"}</LargeTitle>
      {ids && ids.length === 0 ? <Body className="mt-2">Nothing saved yet. Tap the heart on a pick to keep them here and watch for openings.</Body> : null}
      {groups.length > 1 ? <FilterChips label="Filter saved doctors" items={[null, ...groups.map((g) => g.category)].map((c) => ({ key: c, label: c ?? "All", n: c === null ? doctors.length : groups.find((g) => g.category === c)!.doctors.length }))} value={only} onChange={setOnly} /> : null}
      {only ? (
        <div className="mt-4 flex flex-col gap-8">
          {shown.flatMap((g) => g.doctors).map((d, i) => (
            <div key={d.id}>
              <SavedCard doctor={d} index={i} onRemove={() => remove(d.id)} />
              <div className="mt-3">
                <Group>
                  <Cell title={`Openings from ${drName(d).split(" ").slice(0, 2).join(" ")}`} accessory={<Toggle on={!muted.has(d.id)} onChange={(v) => toggleWatch([d.id], v)} label={`Watch ${drName(d)} for openings`} />} />
                </Group>
              </div>
            </div>
          ))}
        </div>
      ) : shown.length ? (
        <div className="mt-4">
          <Group sep={16}>
            {shown.map((g) => {
              const watching = g.doctors.filter((d) => !muted.has(d.id)).length;
              return (
                <Cell
                  key={g.category}
                  bare
                  icon={<FaceStack urls={g.doctors.slice(0, 3).map((d) => d.photo?.url ?? "")} names={g.doctors.slice(0, 3).map((d) => d.name.display)} size={36} />}
                  title={g.category}
                  sub={
                    <>
                      <span className="block truncate">{g.doctors.map((d) => drName(d).replace(/^Dr /, "")).join(", ")}</span>
                      <span className="block">{watching ? `Watching ${watching} for openings` : "Not watching for openings"}</span>
                    </>
                  }
                  onClick={() => setOnly(g.category)}
                  accessory="chevron"
                />
              );
            })}
          </Group>
        </div>
      ) : null}
    </Screen>
  );
}

/** Saved doctors grouped by why they were saved (the search's condition), else their first listed condition, else specialty. */
/** Provider group for Saved (founder 2026-10-19: "My doctors", "My psychologists"…). */
export function providerGroup(d: DoctorRecord): string {
  const prof = ((d as { profession?: string }).profession ?? "").toLowerCase();
  if (d.specialty === "psychology") return "psychologists";
  if (d.specialty === "occupational-therapy") return "occupational therapists";
  if (d.specialty === "allied-health") {
    if (prof.includes("coach")) return "coaches";
    if (prof.includes("physio")) return "physios";
    if (prof.includes("dietitian")) return "dietitians";
    if (prof.includes("social worker")) return "social workers";
    if (prof.includes("counsell")) return "counsellors";
    if (prof.includes("exercise")) return "exercise physiologists";
    return "allied health providers";
  }
  return "doctors";
}

/** Saved providers grouped by kind: My doctors, My psychologists, … (doctors first, then by size). */
export function groupSaved(doctors: DoctorRecord[], _ctx: Record<string, string>): { category: string; doctors: DoctorRecord[] }[] {
  void _ctx;
  const map = new Map<string, DoctorRecord[]>();
  for (const d of doctors) {
    const c = `My ${providerGroup(d)}`;
    map.set(c, [...(map.get(c) ?? []), d]);
  }
  return [...map.entries()].map(([category, ds]) => ({ category, doctors: ds })).sort((a, b) => Number(b.category === "My doctors") - Number(a.category === "My doctors") || b.doctors.length - a.doctors.length || a.category.localeCompare(b.category));
}

export function Me() {
  const [name, setNameState] = useState("");
  const [place, setPlaceState] = useState("");
  const adhd = useMode() === "adhdme";
  useEffect(() => {
    setNameState(getName() ?? "");
    setPlaceState(getPlace() ?? "");
  }, []);
  return (
    <Screen tone="grouped" padBottom="pb-[110px]">
      <NavBar title="Profile" collapse />
      <LargeTitle>Profile</LargeTitle>
      <GroupHeader>Your name</GroupHeader>
      <Group>
        <label className="flex min-h-[52px] items-center px-4">
          <span className="sr-only">Your name</span>
          <input
            value={name}
            onChange={(e) => {
              setNameState(e.target.value);
              setName(e.target.value);
            }}
            placeholder="Name"
            autoComplete="given-name"
            className="h-[52px] w-full bg-transparent text-body text-ink outline-none placeholder:text-grey"
          />
        </label>
      </Group>
      <GroupHeader>Where you are</GroupHeader>
      <Group>
        <label className="flex min-h-[52px] items-center px-4">
          <span className="sr-only">Your suburb or postcode</span>
          <input
            value={place}
            onChange={(e) => {
              setPlaceState(e.target.value);
              setPlace(e.target.value);
            }}
            placeholder="Suburb or postcode"
            autoComplete="postal-code"
            className="h-[52px] w-full bg-transparent text-body text-ink outline-none placeholder:text-grey"
          />
        </label>
      </Group>
      <p className="px-4 pt-2 text-footnote text-grey">Searches start here. Leave it blank to search all of Australia.</p>
      <div className="h-8" />
      <Group sep={58}>
        {adhd ? null : <Cell icon={<Leaf size={18} />} title="Healthspan" sub="Doctors who work on prevention with you" href="/healthspan" />}
        <Cell icon={<FigmaIcon name="clock" size={17} />} title="Openings" sub="Times from saved doctors that fit your week" href="/me/openings" />
        <Cell icon={<FigmaIcon name="sliders" size={17} />} title="Your health context" sub={<>Bring it from ChatGPT, or use <Brand /> inside it</>} href="/me/context" />
        {adhd ? null : <Cell icon={<FigmaIcon name="book" size={17} />} title="Discover" sub="Healthspan, biomarkers, wearables, menopause care" href="/me/discover" />}
      </Group>
      <div className="h-8" />
      <Group sep={58}>
        <Cell icon={<FigmaIcon name="file" size={17} />} title="Join as a provider" sub="Claim or add your profile" href="/join" />
      </Group>
      <BrandSwitch />
      <GroupHeader>About <Brand /></GroupHeader>
      <p className="px-4 text-subhead text-grey">We pick on how providers say they work. Every fact names its source. No one pays to be listed.</p>
    </Screen>
  );
}

function SavedCard({ doctor: d, index, onRemove }: { doctor: DoctorRecord; index: number; onRemove: () => void }) {
  const quote = quoteOf(d);
  const practical = [providerTitle(d), placeOf(d), ...practicalChips(d).slice(0, 2)].filter(Boolean);
  return (
    <article className="rise" style={{ "--i": index } as React.CSSProperties}>
      <Link href={doctorHref(d.id)} className="press-soft block">
        <Portrait d={d} height={300} saved onSave={onRemove} />
        {quote ? <p className="mt-3 font-display text-quote text-ink">“{quote.text}”</p> : null}
        <p className="mt-1.5 text-subhead text-grey">{practical.join(" · ")}</p>
      </Link>
    </article>
  );
}

/**
 * Settings › Mode: Wattle or ADHDme (founder 2026-10-19), as an iOS segmented control. ADHDme
 * narrows the whole app to ADHD support (src/mode.ts); the server reads the cookie, so the screens
 * are refreshed once it is set.
 */
function BrandSwitch() {
  const router = useRouter();
  const current = useMode();
  return (
    <section aria-label="Mode">
      <GroupHeader>Mode</GroupHeader>
      <Segmented label="Mode" value={current} onChange={(id) => { setBrand(id); router.refresh(); }} items={(Object.keys(BRANDS) as BrandId[]).map((id) => ({ value: id, label: BRANDS[id] }))} />
      <p className="px-4 pt-2 text-footnote text-grey">{current === "adhdme" ? "ADHDme shows ADHD support only: assessment, medication, therapy and coaching." : "Wattle lists every kind of provider. ADHDme shows ADHD support only."}</p>
    </section>
  );
}
