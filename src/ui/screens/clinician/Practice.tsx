"use client";
// C03 Practice details (Figma 227:102).
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Cta, Pill, Pills, Screen } from "@/src/ui/kit";
import { savePractice } from "@/src/server/clinician";
import { Asset, DevBanner, Field, Label, Note, StepHeader, StepTitle } from "./parts";
import { useJoin } from "./session";

export function PracticeScreen() {
  const { state, update, ready } = useJoin();
  const router = useRouter();
  const [practice, setPractice] = useState("");
  const [fee, setFee] = useState("");
  const [telehealth, setTelehealth] = useState(false);
  const [referral, setReferral] = useState(false);
  const [bulk, setBulk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!ready) return;
    setPractice(state.practice ?? "");
    setFee(state.fee ?? "");
    setTelehealth(Boolean(state.telehealth));
    setReferral(Boolean(state.referral));
    setBulk(Boolean(state.bulkBilling));
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  function submit() {
    setError(null);
    start(async () => {
      try {
        const feeDollars = fee.trim() ? Number(fee.replace(/[^0-9.]/g, "")) : null;
        const r = await savePractice({ practitionerId: state.practitionerId ?? "local", practice, feeDollars, telehealth, referral, bulkBilling: bulk });
        update({ practice, fee, telehealth, referral, bulkBilling: bulk, backend: r.backend });
        router.push("/join/interview");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save");
      }
    });
  }

  const pill = (label: string, on: boolean, set: (v: boolean) => void) => (
    <span className={on ? "drop-shadow-[0_9px_9.5px_rgba(0,0,0,0.15)]" : undefined}>
      <Pill on={on} onClick={() => set(!on)}>{label}</Pill>
    </span>
  );

  return (
    <Screen>
      <StepHeader back="/join/verify" right="2 of 4" />
      <div className="h-10" />
      <DevBanner backend={ready ? state.backend : undefined} />
      <StepTitle>Where you practise</StepTitle>
      <div className="h-8" />
      <Label>Practice</Label>
      <Field name="practice" value={practice} onChange={setPractice} placeholder="Spring Hill Specialist Centre" autoComplete="organization" icon={<Asset name="map-pin-24" size={24} />} />
      <div className="h-5" />
      <Label>Initial consult fee</Label>
      <Field name="fee" value={fee} onChange={setFee} placeholder="280" inputMode="decimal" prefix="$" />
      <div className="h-7" />
      <Pills>
        {pill("Telehealth", telehealth, setTelehealth)}
        {pill("GP referral", referral, setReferral)}
        {pill("Bulk billing", bulk, setBulk)}
      </Pills>
      <Note className="mt-[18px]">Tap to turn on.</Note>
      {error ? <p role="alert" className="mt-3 text-subhead text-danger">{error}</p> : null}
      <Cta onClick={submit} disabled={pending || !practice.trim()}>
        Continue
      </Cta>
    </Screen>
  );
}
