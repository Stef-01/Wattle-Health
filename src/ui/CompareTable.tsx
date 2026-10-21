"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { sourceLabel, topicsOf, type DoctorRecord } from "@/src/data/types";
import { clearCompare, getCompare } from "./store";
import { doctorHref } from "@/src/data/doctor-slug";

type Cell = string;
const SPECIALTY: Record<string, string> = { psychiatry: "Psychiatrist", paediatrics: "Paediatrician", "obstetrics-gynaecology": "Obstetrician and gynaecologist" };

function rows(d: DoctorRecord): Array<[string, Cell]> {
  const ND = "Not declared";
  return [
    ["Specialty", SPECIALTY[d.specialty] ?? d.specialty.replace(/-/g, " ")],
    ["Register", d.register ? "On the Ahpra register" : "Not yet verified"],
    ["Focus", d.focusTags.value.slice(0, 4).join(", ") || ND],
    ["Taking new patients", d.declared.capacity ? (d.capacity.value === "closed" ? "No" : d.waitTimeText ?? "Yes") : ND],
    ["Telehealth", d.declared.telehealth ? (d.telehealth.value === "none" ? "No" : "Yes") : ND],
    ["Languages", d.languages?.value.join(", ") ?? ND],
    ["Rooms", d.rooms.map((r) => r.suburb).join(", ") || ND],
    ["Research", d.publications.length ? `${d.publications.length} verified` : topicsOf(d).length ? "Topics inferred" : ND],
    ["Personal profile", d.personal ? (d.personal.status === "illustrative" ? "Illustrative example" : d.personal.status === "published" ? "Their website" : "From the doctor") : ND],
    ["Source", d.sources[0] ? `${sourceLabel(d.sources[0].source)} · ${d.sources[0].observedAt.slice(0, 10)}` : ND],
  ];
}

export function CompareTable() {
  const [pair, setPair] = useState<DoctorRecord[] | null>(null);
  useEffect(() => setPair(getCompare()), []);
  if (pair === null) return null;
  if (pair.length === 0) {
    return (
      <p className="pt-6 text-ink-soft">
        Nothing to compare yet. <Link href="/results" className="text-foliage underline underline-offset-4">Pick two from your results.</Link>
      </p>
    );
  }
  const left = rows(pair[0]!);
  const right = pair[1] ? rows(pair[1]) : null;
  return (
    <section className="rise flex flex-col gap-4 pt-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">Compare</h1>
        <button type="button" onClick={() => { clearCompare(); setPair([]); }} className="min-h-11 px-2 text-sm text-foliage underline-offset-4 hover:underline">Clear</button>
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="w-28 p-2 text-left text-xs text-ink-soft" />
            {pair.map((d) => (
              <th key={d.id} className="p-2 text-left align-top">
                <Link href={doctorHref(d.id)} className="display text-lg underline-offset-4 hover:underline">{d.name.display}</Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {left.map(([label, a], i) => (
            <tr key={label} className="border-t border-line align-top">
              <th scope="row" className="p-2 text-left text-xs font-normal text-ink-soft">{label}</th>
              <td className="p-2">{a}</td>
              {right && <td className="p-2">{right[i]![1]}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
