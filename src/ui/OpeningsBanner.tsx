"use client";
// Home: "2 times fit your week" with the first saved doctor's face, linking to Me › Openings.
import Link from "next/link";
import { useEffect, useState } from "react";
import { checkOpenings, savedDoctorIds, whenLabel, type FitOpening } from "./openings";

export function OpeningsBanner() {
  const [fit, setFit] = useState<FitOpening[]>([]);
  useEffect(() => {
    if (savedDoctorIds().length) void checkOpenings().then((r) => setFit(r.fit)).catch(() => undefined);
  }, []);
  if (!fit.length) return null;
  const first = fit[0]!;
  return (
    <Link href="/me/openings" className="rise press-soft mt-5 flex items-center gap-3 rounded-[8px] bg-[#f5f8f6] px-4 py-3">
      {first.doctor.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={first.doctor.photo.url} alt="" referrerPolicy="no-referrer" className="size-11 shrink-0 rounded-full object-cover object-top" />
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium text-ink">{fit.length} {fit.length === 1 ? "opening fits" : "openings fit"} your calendar</span>
        <span className="block truncate text-[14px] text-grey">{first.doctor.name.display}, {whenLabel(first.start)} · demo</span>
      </span>
      <span className="text-[14px] text-accent">See</span>
    </Link>
  );
}
