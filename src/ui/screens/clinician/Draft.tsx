"use client";
// C06 Draft answer (Figma 227:214). The draft is deterministic cleanup (tidy.ts): "Tidied, not rewritten".
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Cta, Screen } from "@/src/ui/kit";
import { Asset, DevBanner, Note, SmallPill, StepHeader, StepProgress, StepTitle } from "./parts";
import { QUESTIONS, TOTAL, drName, useJoin } from "./session";
import { draftFor } from "./tidy";

export function DraftScreen({ n }: { n: number }) {
  const q = QUESTIONS.find((x) => x.n === n) ?? QUESTIONS[0]!;
  const { state, update, ready } = useJoin();
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<"keep" | "edit">("keep");
  const [show, setShow] = useState(true);

  useEffect(() => {
    if (!ready) return;
    const a = state.answers[n];
    setDraft(a?.draft || draftFor(a?.raw ?? "", drName(state.name), q.lead));
    setShow(a?.show ?? true);
  }, [ready, n]); // eslint-disable-line react-hooks/exhaustive-deps

  function persist(extra?: Partial<{ draft: string; show: boolean }>) {
    update((s) => ({ answers: { ...s.answers, [n]: { raw: s.answers[n]?.raw ?? "", draft: extra?.draft ?? draft, show: extra?.show ?? show } } }));
  }

  function next() {
    persist();
    router.push(n < TOTAL ? `/join/interview/${n + 1}` : "/join/share");
  }

  function sayAgain() {
    update((s) => ({ answers: { ...s.answers, [n]: { raw: "", draft: "", show } } }));
    router.push(`/join/interview/${n}`);
  }

  return (
    <Screen>
      <StepHeader back={`/join/interview/${n}`} right={`${n} of ${TOTAL}`} />
      <div className="h-6" />
      <StepProgress step={n} of={TOTAL} />
      <div className="h-10" />
      <DevBanner backend={ready ? state.backend : undefined} />
      <StepTitle>Sound right?</StepTitle>
      <div className="h-6" />
      <div className="flex flex-col gap-4 rounded-card bg-surface-soft p-4">
        {mode === "edit" ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Edit the draft"
            rows={5}
            className="w-full resize-none bg-transparent text-body leading-read text-charcoal outline-none"
          />
        ) : (
          <p className="text-body leading-read text-charcoal">{draft || "Nothing to tidy yet. Say it again."}</p>
        )}
        <div className="flex gap-[10px]">
          <SmallPill on={mode === "keep"} onClick={() => { setMode("keep"); persist(); }}>Keep</SmallPill>
          <SmallPill on={mode === "edit"} onClick={() => setMode("edit")}>Edit</SmallPill>
          <SmallPill on={false} onClick={sayAgain}>Say it again</SmallPill>
        </div>
      </div>
      <Note className="mt-2">Tidied, not rewritten.</Note>
      <div className="h-7" />
      <div className="flex items-center justify-between">
        <span className="text-body text-charcoal">Show on my profile</span>
        <SmallPill role="switch" label="Show on my profile" on={show} onClick={() => { setShow(!show); persist({ show: !show }); }}>{show ? "On" : "Off"}</SmallPill>
      </div>
      <Cta onClick={next} disabled={!draft.trim()}>
        {n < TOTAL ? "Next question" : "Continue"}
      </Cta>
    </Screen>
  );
}
