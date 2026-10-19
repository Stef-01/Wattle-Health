"use client";
import { Brand, BRANDS, setBrand, useBrandName, type BrandId } from "@/src/ui/brand";
// Tab pages: /recent (localStorage recent searches), /saved (wattle.saved.v1 ids → cards),
// /me (name, join as a doctor, about). Each sits under the TabBar with its own dot.
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { lookup } from "@/src/data/api";
import { doctorHref } from "@/src/data/doctor-slug";
import type { DoctorRecord } from "@/src/data/types";
import { Body, Divider, FaceStack, FieldBox, FigmaIcon, initialsOf, Row, Screen, SectionTitle, TabBar, Toggle } from "@/src/ui/kit";
import { getOpeningsState, setOpeningsState } from "@/src/ui/openings";
import { Portrait } from "@/src/ui/screens/patient-a/DoctorCard";
import Link from "next/link";
import { getName, getRecent, getRequest, getSavedContext, getSavedIds, setName, setRequest, toggleSavedId, type RecentSearch } from "@/src/ui/store";
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
    <Screen padBottom="pb-[110px]">
      <SectionTitle>Recent</SectionTitle>
      <Space h={16} />
      {rows && rows.length === 0 ? <Body>No searches yet.</Body> : null}
      {groups.length > 1 ? (
        <div role="tablist" aria-label="Filter by condition" className="-mx-1 flex gap-1 overflow-x-auto pb-2">
          {[null, ...groups.map((g) => g.condition)].map((c) => {
            const on = only === c;
            const n = c === null ? rows?.length ?? 0 : groups.find((g) => g.condition === c)!.rows.length;
            return (
              <button key={c ?? "all"} type="button" role="tab" aria-selected={on} onClick={() => setOnly(c)} className={`press shrink-0 rounded-full px-3.5 py-2 text-[15px] ${on ? "bg-ink text-white" : "text-charcoal"}`}>
                {c ?? "All"} <span className={on ? "text-white/70" : "text-grey"}>{n}</span>
              </button>
            );
          })}
        </div>
      ) : null}
      <div className="mt-2 flex flex-col gap-6">
        {shown.map((g) => (
          <section key={g.condition}>
            {groups.length > 1 && !only ? <h2 className="text-[18px] text-ink">{g.condition}</h2> : null}
            {g.rows.map((r) => (
              <div key={r.id}>
                <Row icon={r.faces?.length ? <FaceStack urls={r.faces} /> : <FigmaIcon name="clock" size={17} />} title={groups.length > 1 && r.label.toLowerCase().startsWith(`${g.condition.toLowerCase()}, `) ? r.label.slice(g.condition.length + 2) : r.label} sub={`${r.matches} ${r.matches === 1 ? "pick" : "picks"}${day(r.at) ? `, ${day(r.at)}` : ""}`} onClick={() => open(r)} />
                <Divider />
              </div>
            ))}
          </section>
        ))}
      </div>
      <TabBar active="/recent" />
    </Screen>
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
    <Screen padBottom="pb-[110px]">
      <SectionTitle>Saved</SectionTitle>
      <Space h={16} />
      {ids && ids.length === 0 ? <Body>Nothing saved yet. Tap the heart on a pick to keep them here and watch for openings.</Body> : null}
      {groups.length > 1 ? (
        <div role="tablist" aria-label="Filter saved doctors" className="-mx-1 flex gap-1 overflow-x-auto pb-2">
          {[null, ...groups.map((g) => g.category)].map((c) => {
            const on = only === c;
            const n = c === null ? doctors.length : groups.find((g) => g.category === c)!.doctors.length;
            return (
              <button key={c ?? "all"} type="button" role="tab" aria-selected={on} onClick={() => setOnly(c)} className={`press shrink-0 rounded-full px-3.5 py-2 text-[15px] ${on ? "bg-ink text-white" : "text-charcoal"}`}>
                {c ?? "All"} <span className={on ? "text-white/70" : "text-grey"}>{n}</span>
              </button>
            );
          })}
        </div>
      ) : null}
      <div className="mt-3 flex flex-col gap-4">
        {shown.map((g) => {
          const watching = g.doctors.filter((d) => !muted.has(d.id)).length;
          return only ? (
            <div key={g.category} className="flex flex-col gap-7">
              {g.doctors.map((d, i) => (
                <div key={d.id}>
                  <SavedCard doctor={d} index={i} onRemove={() => remove(d.id)} />
                  <div className="mt-3 flex items-center justify-between rounded-[6px] bg-[#f4f4f4] px-4 py-2.5">
                    <span className="text-[14px] text-charcoal">Tell me when {drName(d).split(" ").slice(0, 2).join(" ")} has openings</span>
                    <Toggle on={!muted.has(d.id)} onChange={(v) => toggleWatch([d.id], v)} label={`Watch ${drName(d)} for openings`} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <button key={g.category} type="button" onClick={() => setOnly(g.category)} className="press press-soft flex items-center gap-4 rounded-[8px] border border-hairline px-4 py-4 text-left">
              <span className="flex shrink-0 -space-x-3">
                {g.doctors.slice(0, 3).map((d) =>
                  d.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={d.id} src={d.photo.url} alt="" referrerPolicy="no-referrer" className="size-12 rounded-full border-2 border-white object-cover object-top" />
                  ) : (
                    <span key={d.id} className="inline-flex size-12 items-center justify-center rounded-full border-2 border-white bg-[#f4f4f4] text-[14px] text-[#1b1b1b]">{initialsOf(d.name.display)}</span>
                  ),
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[18px] font-semibold tracking-[-0.01em] text-ink">{g.category}</span>
                <span className="block truncate text-[14px] text-grey">{g.doctors.map((d) => drName(d).replace(/^Dr /, "")).join(", ")}</span>
                <span className="mt-0.5 block text-[14px] font-medium text-[#1b1b1b]">{watching ? `Watching ${watching} for openings` : "Not watching for openings"}</span>
              </span>
              <span className="text-grey">›</span>
            </button>
          );
        })}
      </div>
      <TabBar active="/saved" />
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
  useEffect(() => setNameState(getName() ?? ""), []);
  return (
    <Screen padBottom="pb-[110px]">
      <SectionTitle>Profile</SectionTitle>
      <Space h={24} />
      <label className="flex flex-col gap-2">
        <span className="text-[14px] text-grey">Your name</span>
        <FieldBox>
          <input
            value={name}
            onChange={(e) => {
              setNameState(e.target.value);
              setName(e.target.value);
            }}
            placeholder="Name"
            autoComplete="given-name"
            className="h-[54px] w-full bg-transparent px-5 text-[16px] font-medium text-charcoal outline-none placeholder:text-grey"
          />
        </FieldBox>
      </label>
      <Space h={30} />
      <Row icon={<FigmaIcon name="check" size={17} />} title="Healthspan" sub="Doctors who work on prevention with you" href="/healthspan" />
      <Divider />
      <Row icon={<FigmaIcon name="clock" size={17} />} title="Openings" sub="Times from saved doctors that fit your week" href="/me/openings" />
      <Divider />
      <Row icon={<FigmaIcon name="sliders" size={17} />} title="Your health context" sub={<>Bring it from ChatGPT, or use <Brand /> inside it</>} href="/me/context" />
      <Divider />
      <Row icon={<FigmaIcon name="book" size={17} />} title="Discover" sub="Healthspan, biomarkers, wearables, menopause care" href="/me/discover" />
      <Divider />
      <Row icon={<FigmaIcon name="file" size={17} />} title="Join as a provider" sub="Claim or add your profile" href="/join" />
      <Divider />
      <Space h={30} />
      <BrandSwitch />
      <Space h={30} />
      <h2 className="display text-[20px] text-charcoal">About <Brand /></h2>
      <Space h={8} />
      <p className="text-[14px] leading-[1.5] text-grey">We pick on how providers say they work. Every fact names its source. No one pays to be listed.</p>
      <TabBar active="/me" />
    </Screen>
  );
}

function SavedCard({ doctor: d, index, onRemove }: { doctor: DoctorRecord; index: number; onRemove: () => void }) {
  const quote = quoteOf(d);
  const practical = [providerTitle(d), placeOf(d), ...practicalChips(d).slice(0, 2)].filter(Boolean);
  return (
    <article className="rise" style={{ "--i": index } as React.CSSProperties}>
      <Link href={doctorHref(d.id)} className="press press-soft block">
        <Portrait d={d} height={300} saved onSave={onRemove} />
        {quote ? <p className="mt-4 font-display text-[19px] leading-[1.35] text-ink">“{quote.text}”</p> : null}
        <p className="mt-2 text-[14px] text-grey">{practical.join(" · ")}</p>
      </Link>
    </article>
  );
}

/** Settings › App name: Wattle or ADHDme (founder 2026-10-19). */
function BrandSwitch() {
  const name = useBrandName();
  return (
    <section aria-label="App name">
      <p className="text-[14px] text-grey">App name</p>
      <div role="radiogroup" aria-label="App name" className="mt-2 grid grid-cols-2 overflow-hidden rounded-[6px] border border-ink">
        {(Object.keys(BRANDS) as BrandId[]).map((id, i) => {
          const on = name === BRANDS[id];
          return (
            <button key={id} type="button" role="radio" aria-checked={on} onClick={() => setBrand(id)} className={`press h-11 text-[16px] ${i ? "border-l border-ink" : ""} ${on ? "bg-ink font-semibold text-white" : "text-ink"}`}>
              {BRANDS[id]}
            </button>
          );
        })}
      </div>
    </section>
  );
}
