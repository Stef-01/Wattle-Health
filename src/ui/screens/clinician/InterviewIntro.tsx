"use client";
// C04 Interview intro (Figma 227:138).
import Link from "next/link";
import { Cta, Divider, Row, Screen } from "@/src/ui/kit";
import { Asset, DevBanner, Note, StepHeader, StepTitle } from "./parts";
import { useJoin } from "./session";

const TOPICS = [
  { icon: "file", title: "Your clinical interests" },
  { icon: "heart", title: "How you work with patients" },
  { icon: "leaf", title: "Outside medicine, if you like" },
];

export function InterviewIntroScreen() {
  const { state, ready } = useJoin();
  return (
    <Screen padBottom="pb-[170px]">
      <StepHeader back="/join/practice" right="3 of 4" />
      <div className="h-10" />
      <DevBanner backend={ready ? state.backend : undefined} />
      <StepTitle sub="Eight questions. Speak or type.">A short interview</StepTitle>
      <div className="h-9" />
      {TOPICS.map((t) => (
        <div key={t.title}>
          <Row icon={<Asset name={t.icon} size={17} />} title={t.title} />
          <Divider />
        </div>
      ))}
      <Note className="mt-[22px]">You choose what goes on your profile.</Note>
      <div className="frame-fixed pointer-events-none bottom-0 z-20">
        <div className="pointer-events-auto flex flex-col items-center gap-[26px] frame-pad pb-[26px] pt-3">
          <Link href="/join/share" className="text-body font-semibold text-grey">Skip for now</Link>
          <Cta href="/join/interview/1" fixed={false} icon={<Asset name="mic-22" size={22} />}>
            Start
          </Cta>
        </div>
      </div>
    </Screen>
  );
}
