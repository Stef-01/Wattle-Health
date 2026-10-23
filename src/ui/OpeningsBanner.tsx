"use client";
// Home: "2 times fit your week" with the first saved doctor's face, linking to Me › Openings.
import Link from "next/link";
import { useEffect, useState } from "react";
import { Face } from "./kit";
import { checkOpenings, getOpeningsState, savedDoctorIds, whenLabel, type FitOpening } from "./openings";

export function OpeningsBanner() {
  const [fit, setFit] = useState<FitOpening[]>([]);
  useEffect(() => {
    if (savedDoctorIds().length && getOpeningsState().calendar) void checkOpenings().then((r) => setFit(r.fit)).catch(() => undefined);
  }, []);
  if (!fit.length) return null;
  const first = fit[0]!;
  return (
    <Link href="/me/openings" className="rise cell mt-4 flex min-h-[64px] items-center gap-3 rounded-card bg-surface-soft px-4 py-3">
      <Face url={first.doctor.photo?.url} name={first.doctor.name.display} size={40} />
      <span className="min-w-0 flex-1">
        <span className="block text-headline text-ink">{fit.length} {fit.length === 1 ? "opening fits" : "openings fit"} your calendar</span>
        <span className="block truncate text-subhead text-grey">{first.doctor.name.display}, {whenLabel(first.start)}</span>
      </span>
      <span className="text-body text-accent">See</span>
    </Link>
  );
}
