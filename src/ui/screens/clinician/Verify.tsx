"use client";
// C02 Verify registration (Figma 227:68). Looks the number up in our own data first; the register
// check itself is a Wattle-side step, so the card says so unless we already hold register-tier data.
import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Cta, Screen } from "@/src/ui/kit";
import { createClaim, lookupDoctor, type Lookup } from "@/src/server/clinician";
import { Asset, DevBanner, Field, Label, Note, StepHeader, StepTitle } from "./parts";
import { useJoin } from "./session";

export function VerifyScreen() {
  const { state, update, ready } = useJoin();
  const router = useRouter();
  const params = useSearchParams();
  const doctorParam = params.get("doctor");
  const [ahpra, setAhpra] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<Lookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!ready) return;
    setAhpra(state.ahpra ?? "");
    setName(state.name ?? "");
    setEmail(state.email ?? "");
    if (state.name && state.specialtyLine) {
      setResult({ found: Boolean(state.doctorId), doctorId: state.doctorId ?? null, name: state.name, specialtyLine: state.specialtyLine, registerChecked: Boolean(state.registerChecked), registered: Boolean(state.registered), conditions: Boolean(state.conditions), backend: state.backend ?? "memory" });
    }
    // Arrived from /claim/[id] or /doctor/[id]: prefill from our record.
    const id = doctorParam ?? state.doctorId;
    if (id && !state.name) {
      lookupDoctor({ ahpra: "", name: "", doctorId: id })
        .then((r) => {
          if (!r.found) return;
          setName(r.name);
          setResult(r);
          update({ name: r.name, backend: r.backend, doctorId: r.doctorId, specialtyLine: r.specialtyLine, registerChecked: r.registerChecked, registered: r.registered, conditions: r.conditions });
        })
        .catch(() => undefined);
    }
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  function lookUp() {
    setError(null);
    start(async () => {
      try {
        const r = await lookupDoctor({ ahpra, name });
        setResult(r);
        setName(r.found ? r.name : name);
        update({ ahpra, name: r.name, backend: r.backend, doctorId: r.doctorId, specialtyLine: r.specialtyLine, registerChecked: r.registerChecked, registered: r.registered, conditions: r.conditions });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not look that up");
      }
    });
  }

  function thatsMe() {
    if (!result) return lookUp();
    setError(null);
    start(async () => {
      try {
        const c = await createClaim({ ahpra, name: result.name, email, doctorId: result.doctorId });
        update({ ahpra, email, practitionerId: c.practitionerId, claimId: c.claimId, backend: c.backend });
        router.push("/join/practice");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save your claim");
      }
    });
  }

  const registerLine = result
    ? result.registerChecked
      ? result.registered
        ? result.conditions
          ? "Registered, conditions apply"
          : "Registered, no conditions"
        : "Registration status needs a check"
      : "Not yet checked against the register. We verify before publishing."
    : null;

  return (
    <Screen>
      <StepHeader back="/join" right="1 of 4" />
      <div className="h-10" />
      <DevBanner backend={ready ? state.backend : undefined} />
      <StepTitle sub="We check it against the public register.">Your AHPRA number</StepTitle>
      <div className="h-9" />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          lookUp();
        }}
        className="flex flex-col"
      >
        <Field name="ahpra" value={ahpra} onChange={setAhpra} placeholder="MED0001234567" autoComplete="off" icon={<button type="submit" aria-label="Look up" className="inline-flex size-6 items-center justify-center"><Asset name="search" size={24} /></button>} />
        <div className="h-5" />
        <Label>Your name as registered</Label>
        <Field name="name" value={name} onChange={setName} placeholder="Dr Nathan Reilly" autoComplete="name" />
        <div className="h-5" />
        <Label>Practice email</Label>
        <Field name="email" type="email" inputMode="email" value={email} onChange={setEmail} placeholder="you@yourpractice.com.au" autoComplete="email" />
        <Note className="mt-2">We keep the domain only, to match your practice.</Note>
      </form>
      <div className="h-7" />
      {result ? (
        <div className="flex flex-col gap-3 rounded-card bg-surface-soft p-4" aria-live="polite">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-[34px] shrink-0 items-center justify-center rounded-control bg-surface"><Asset name="check" size={17} /></span>
            <span className="text-body text-charcoal">{result.name}</span>
          </div>
          <Note>{result.specialtyLine}</Note>
          <Note>{registerLine}</Note>
        </div>
      ) : null}
      {error ? <p role="alert" className="mt-3 text-subhead text-danger">{error}</p> : null}
      <Cta onClick={thatsMe} disabled={pending || !ahpra || !name || !email}>
        {result ? "That’s me" : "Look me up"}
      </Cta>
    </Screen>
  );
}
