"use client";
// C01 Join as a doctor (Figma 227:9).
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Cta, Divider, Row, Screen } from "@/src/ui/kit";
import { backendMode } from "@/src/server/clinician";
import { Asset, DevBanner, StepHeader, StepTitle } from "./parts";
import { useJoin } from "./session";

const STEPS = [
  { icon: "shield", title: "Verify registration", sub: "AHPRA public register", meta: "2 min" },
  { icon: "building", title: "Practice details", sub: "Location, fees, telehealth", meta: "3 min" },
  { icon: "mic-17", title: "Interview", sub: "How you practise, in your words", meta: "10 min" },
];

export function JoinScreen() {
  const { state, update, ready } = useJoin();
  const params = useSearchParams();
  const doctor = params.get("doctor");
  useEffect(() => {
    if (!ready) return;
    backendMode().then((backend) => update({ backend })).catch(() => undefined);
    if (doctor) update({ doctorId: doctor });
  }, [ready, doctor, update]);

  return (
    <Screen>
      <StepHeader back="/" right="Log in" rightHref="/me" />
      <div className="h-10" />
      <DevBanner backend={ready ? state.backend : undefined} />
      <StepTitle sub="Verified, then a short interview.">Join as a doctor</StepTitle>
      <div className="h-10" />
      {STEPS.map((s) => (
        <div key={s.title}>
          <Row icon={<Asset name={s.icon} size={17} />} title={s.title} sub={s.sub} meta={<span className="text-subhead">{s.meta}</span>} />
          <Divider />
        </div>
      ))}
      <Cta href={doctor ? `/join/verify?doctor=${encodeURIComponent(doctor)}` : "/join/verify"}>
        Get started
      </Cta>
    </Screen>
  );
}
