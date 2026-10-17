"use client";
// P04 Your match (225:94): the hero card for rank N with back and bookmark circles over the
// photo (initials when there is none), the caption with place and fee, the heading tabs, the
// declared stats and one paragraph built only from the match's closed-vocabulary reasons.
// Swipe left / right arrow moves to the next rank; after the third it goes to the list.
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Card } from "@/src/data/search-types";
import { ArrowLeft, Body, Bookmark, Circle, Clock, Cta, File, Gap, HeadingTabs, MapPin, PhotoCard, Screen, Stat, Video } from "@/src/ui/kit";
import { getCurrentRequest, isSavedId, toggleSavedId } from "@/src/ui/store";
import { Dock } from "./Dock";
import { familyOf, feeOf, hasTelehealth, needsReferral, paragraphFor, placeLine, yearsOf } from "./lib";
import { doctorHref } from "@/src/data/doctor-slug";

const RANKS = 3;

export function Match({ rank }: { rank: number }) {
  const router = useRouter();
  const [card, setCard] = useState<Card | null>(null);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [count, setCount] = useState(0);
  const [missing, setMissing] = useState(false);
  const [saved, setSaved] = useState(false);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    const req = getCurrentRequest();
    const cards = req?.response.cards ?? [];
    const c = cards[rank - 1] ?? null;
    if (!req || !c) {
      if (req && rank > 1 && cards.length > 0) router.replace("/results");
      else setMissing(true);
      return;
    }
    setCount(Math.min(cards.length, RANKS));
    setCard(c);
    setLabels(req.response.conditionLabels ?? {});
    setSaved(isSavedId(c.doctor.id));
  }, [rank, router]);

  function go(delta: number) {
    const next = rank + delta;
    if (next < 1) return router.push("/heard");
    if (next > count) return router.push("/results");
    router.push(`/match/${next}`);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (missing) {
    return (
      <Screen>
        <Body>No match to show yet.</Body>
      </Screen>
    );
  }
  if (!card) return <Screen>{null}</Screen>;

  const d = card.doctor;
  const fee = feeOf(d);
  const years = yearsOf(d);
  const place = placeLine(card);
  const stats = [
    years !== null ? { key: "years", icon: <Clock size={17} />, label: `${years} yrs` } : null,
    hasTelehealth(d) ? { key: "tele", icon: <Video size={17} />, label: "Telehealth" } : null,
    needsReferral(d) ? { key: "ref", icon: <File size={17} />, label: "Referral" } : null,
  ].filter((s): s is NonNullable<typeof s> => s !== null);

  return (
    <Screen padBottom="pb-[150px]" className="pt-0">
      <div
        className="-mt-[6px]"
        onTouchStart={(e) => {
          touchX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const start = touchX.current;
          const end = e.changedTouches[0]?.clientX;
          touchX.current = null;
          if (start === null || end === undefined) return;
          if (end - start < -60) go(1);
          if (end - start > 60) go(-1);
        }}
      >
        <PhotoCard
          name={d.name.display}
          photo={d.photo?.url ?? null}
          height={460}
          caption={false}
          topLeft={
            <Circle over label="Back" onClick={() => go(-1)}>
              <ArrowLeft size={22} />
            </Circle>
          }
          topRight={
            <Circle over label={saved ? "Remove bookmark" : "Bookmark"} onClick={() => setSaved(toggleSavedId(d.id).includes(d.id))}>
              <Bookmark size={22} fill={saved ? "currentColor" : "none"} />
            </Circle>
          }
        >
          <div className="absolute inset-x-[21px] top-[327px] flex h-[104px] items-center gap-2.5 rounded-[15px] bg-caption px-4 py-[18px] text-white shadow-[0_5px_4.5px_rgba(0,0,0,0.1)] backdrop-blur-[20px]">
            <span className="flex min-w-0 flex-1 flex-col gap-2.5">
              <span className={`truncate font-inter font-semibold leading-normal ${d.name.display.length > 16 ? "text-[20px]" : "text-[24px]"}`}>{d.name.display}</span>
              {place ? (
                <span className="inline-flex items-center gap-1.5 text-[18px] leading-normal text-caption-text">
                  <MapPin size={18} />
                  <span className="truncate">{place}</span>
                </span>
              ) : null}
            </span>
            {fee ? (
              <span className="flex shrink-0 flex-col items-end gap-1.5 whitespace-nowrap">
                <span className="text-[16px] leading-normal text-caption-text">Fee</span>
                <span className="text-[24px] font-medium leading-normal">{fee}</span>
              </span>
            ) : null}
          </div>
        </PhotoCard>
      </div>
      <Gap h={40} />
      <HeadingTabs items={[{ label: "Why you’ll connect", active: true }, { label: "Profile", href: doctorHref(d.id) }]} />
      <Gap h={32} />
      {stats.length > 0 ? (
        <>
          <div className="flex items-start justify-between">
            {stats.map((s) => (
              <Stat key={s.key} icon={s.icon}>
                {s.label}
              </Stat>
            ))}
          </div>
          <Gap h={34} />
        </>
      ) : null}
      <Body>{paragraphFor(card, labels)}</Body>
      <Dock>
        <Cta fixed={false} href={doctorHref(d.id)}>
          Get to know Dr {familyOf(d)}
        </Cta>
      </Dock>
    </Screen>
  );
}
