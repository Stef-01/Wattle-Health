"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { DoctorRecord } from "@/src/data/types";
import { ObservedBadge } from "./Badge";
import { getSaved, toggleSaved } from "./store";
import { doctorHref } from "@/src/data/doctor-slug";

export function SavedList() {
  const [saved, setSaved] = useState<DoctorRecord[] | null>(null);
  useEffect(() => setSaved(getSaved()), []);
  if (saved === null) return null;
  if (saved.length === 0) {
    return (
      <p className="pt-6 text-ink-soft">
        Nothing saved yet. <Link href="/" className="text-foliage underline underline-offset-4">Start a search.</Link>
      </p>
    );
  }
  return (
    <section className="rise flex flex-col gap-4 pt-4">
      <h1 className="text-2xl">Saved</h1>
      <ul className="flex flex-col gap-3">
        {saved.map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-3 rounded-card border border-line bg-white p-4">
            <div className="flex min-w-0 flex-col gap-1">
              <Link href={doctorHref(d.id)} className="display text-xl underline-offset-4 hover:underline">{d.name.display}</Link>
              <span className="text-sm text-ink-soft">{d.rooms[0]?.suburb ?? "Australia"}</span>
              <ObservedBadge o={d.focusTags} />
            </div>
            <button type="button" onClick={() => setSaved(toggleSaved(d))} className="min-h-11 shrink-0 rounded-full border border-line px-4 text-sm">Remove</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
