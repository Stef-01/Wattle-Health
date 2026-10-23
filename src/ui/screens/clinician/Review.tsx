"use client";
// C08 Review and publish (Figma 227:296) and the confirmation state after Publish.
// Publish writes personal_profiles as 'draft' with consent_at; 'doctor-approved' is set by Wattle after the register check.
import { useRef, useState, useTransition } from "react";
import { Cta, Divider, PhotoCard, Row, Screen } from "@/src/ui/kit";
import { publishProfile } from "@/src/server/clinician";
import { Asset, DevBanner, Loading, Note, StepHeader, StepTitle } from "./parts";
import { QUESTIONS, profileFrom, useJoin } from "./session";

export function ReviewScreen() {
  const { state, update, ready } = useJoin();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const file = useRef<HTMLInputElement>(null);

  if (!ready) return <Screen><Loading /></Screen>;
  if (state.submitted) return <Submitted backend={state.backend} />;

  const name = state.name ?? "Your name";
  const verified = Boolean(state.registerChecked && state.registered && !state.conditions);
  const outside = QUESTIONS.filter((q) => q.share && state.shares[q.share] && state.answers[q.n]?.draft && state.answers[q.n]?.show).length;
  const interview = QUESTIONS.filter((q) => !q.share && state.answers[q.n]?.draft && state.answers[q.n]?.show).length;

  function pickPhoto(f: File | undefined) {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => update({ photo: typeof reader.result === "string" ? reader.result : undefined });
    reader.readAsDataURL(f);
  }

  function publish() {
    setError(null);
    start(async () => {
      try {
        const r = await publishProfile({ practitionerId: state.practitionerId ?? "local", profile: profileFrom(state) });
        update({ submitted: true, backend: r.backend });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not submit");
      }
    });
  }

  return (
    <Screen>
      <StepHeader back="/join/share" right="4 of 4" />
      <div className="h-8" />
      <DevBanner backend={state.backend} />
      <StepTitle>Review your profile</StepTitle>
      <div className="h-6" />
      <PhotoCard
        name={name}
        photo={state.photo ?? null}
        height={240}
        caption={false}
        topRight={
          <button type="button" aria-label="Add a photo" onClick={() => file.current?.click()} className="inline-flex size-11 items-center justify-center rounded-full bg-white/90">
            <Asset name="pencil" size={20} />
          </button>
        }
      >
        <div className="absolute left-5 top-[145px] flex h-[75px] w-[224px] items-center rounded-card bg-caption px-4 py-3 text-white backdrop-blur-[20px] shadow-[0_5px_4.5px_rgba(0,0,0,0.1)]">
          <span className="flex min-w-0 flex-col gap-2">
            <span className="truncate text-body">{name}</span>
            <span className="inline-flex items-center gap-1.5 text-subhead text-caption-text">
              <Asset name="map-pin-16" size={16} />
              <span className="truncate">{state.practice || "Practice not set"}</span>
            </span>
          </span>
        </div>
      </PhotoCard>
      <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => pickPhoto(e.target.files?.[0])} />
      <div className="h-[18px]" />
      <Row icon={<Asset name="check" size={17} className={verified ? undefined : "opacity-30"} />} title={verified ? "Registration verified" : "Registration check pending"} sub={verified ? undefined : "We check the register before publishing."} />
      <Divider />
      <Row icon={<Asset name="check" size={17} />} title="Practice details" meta={<span className="text-subhead">Edit</span>} href="/join/practice" chevron={false} />
      <Divider />
      <Row icon={<Asset name="check" size={17} className={interview ? undefined : "opacity-30"} />} title="How you practise" sub={interview ? "From your interview" : "Not answered yet"} meta={<span className="text-subhead">Edit</span>} href="/join/interview/1" chevron={false} />
      <Divider />
      <Row icon={<Asset name="check" size={17} className={outside ? undefined : "opacity-30"} />} title="Outside medicine" sub={`${outside} shared`} meta={<span className="text-subhead">Edit</span>} href="/join/share" chevron={false} />
      <Divider />
      {error ? <p role="alert" className="mt-3 text-subhead text-danger">{error}</p> : null}
      <Cta onClick={publish} disabled={pending}>
        Publish
      </Cta>
    </Screen>
  );
}

function Submitted({ backend }: { backend?: "supabase" | "memory" }) {
  return (
    <Screen>
      <StepHeader back="/join/review" right="Done" />
      <div className="h-10" />
      <DevBanner backend={backend} />
      <StepTitle sub="We verify your registration before anything is published.">Submitted.</StepTitle>
      <div className="h-9" />
      <Row icon={<Asset name="check" size={17} />} title="Claim received" sub="Matched to your practice email domain" />
      <Divider />
      <Row icon={<Asset name="check" size={17} />} title="Profile saved as a draft" sub="Only you and Wattle can see it" />
      <Divider />
      <Row icon={<Asset name="shield" size={17} />} title="Register check next" sub="AHPRA public register" />
      <Divider />
      <Note className="mt-[22px]">You can edit anything until it goes live.</Note>
      <Cta href="/">
        Done
      </Cta>
    </Screen>
  );
}
