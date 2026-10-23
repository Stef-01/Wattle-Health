"use client";
// C07 What to share (Figma 227:248). Subtitles come from the interview answers.
import { Cta, Divider, Screen } from "@/src/ui/kit";
import { Asset, DevBanner, SmallPill, StepHeader, StepProgress, StepTitle } from "./parts";
import { QUESTIONS, TOTAL, useJoin, type ShareKey } from "./session";

const ROWS: { key: ShareKey; title: string }[] = [
  { key: "lived", title: "Lived experience" },
  { key: "outside", title: "Outside work" },
  { key: "books", title: "Books and music" },
  { key: "why", title: "Why I became a doctor" },
];

/** "Dr Reilly shares lived experience of endometriosis in their family." → "Endometriosis in their family". */
function short(text: string | undefined, lead: string): string | undefined {
  if (!text) return undefined;
  let t = text.replace(new RegExp(`^Dr\\s+\\S+\\s+(?:${lead.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+)?`), "").replace(/\.$/, "");
  t = t.charAt(0).toUpperCase() + t.slice(1);
  return t.length > 48 ? `${t.slice(0, 45).trimEnd()}…` : t;
}

export function ShareScreen() {
  const { state, update, ready } = useJoin();
  return (
    <Screen>
      <StepHeader back={`/join/draft/${TOTAL}`} right={`${TOTAL} of ${TOTAL}`} />
      <div className="h-6" />
      <StepProgress step={TOTAL} of={TOTAL} />
      <div className="h-10" />
      <DevBanner backend={ready ? state.backend : undefined} />
      <StepTitle sub="Optional. Only what you choose is shown.">What would you like to share?</StepTitle>
      <div className="h-7" />
      {ROWS.map((r) => {
        const q = QUESTIONS.find((x) => x.share === r.key);
        const sub = short(q ? state.answers[q.n]?.draft : undefined, q?.lead ?? "");
        const on = state.shares[r.key];
        return (
          <div key={r.key}>
            <div className="flex items-center gap-[14px] py-[14px]">
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-body text-charcoal">{r.title}</span>
                {sub ? <span className="truncate text-subhead text-grey">{sub}</span> : null}
              </span>
              <SmallPill role="switch" label={r.title} on={on} onClick={() => update((s) => ({ shares: { ...s.shares, [r.key]: !s.shares[r.key] } }))}>
                {on ? "On" : "Off"}
              </SmallPill>
            </div>
            <Divider />
          </div>
        );
      })}
      <Cta href="/join/review">
        Continue
      </Cta>
    </Screen>
  );
}
