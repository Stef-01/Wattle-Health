"use client";
// P03 What we heard (225:64): the quoted sentence and the pills the engine read from it. Dark
// pills are must-haves (filters), light ones preferences (ranking). Tapping a pill turns it off
// and re-runs the search without it; "Edit" returns home with the text prefilled.
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronLeft, Body, Circle, Cta, Gap, Screen } from "@/src/ui/kit";
import { getCurrentRequest, getRequest, setDraft, setRequest, type StoredRequest } from "@/src/ui/store";
import { Dock } from "./Dock";
import { heardPills, withoutPill } from "./lib";

export function Heard() {
  const router = useRouter();
  const params = useSearchParams();
  const [req, setReq] = useState<StoredRequest | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const id = params.get("req");
    const found = (id ? getRequest(id) : null) ?? getCurrentRequest();
    if (!found) {
      setMissing(true);
      return;
    }
    if (id) setRequest(found);
    setReq(found);
  }, [params]);

  async function toggle(pillId: string) {
    if (!req || busy) return;
    setBusy(pillId);
    try {
      setReq(await withoutPill(req, pillId));
    } finally {
      setBusy(null);
    }
  }

  const pills = req ? heardPills(req) : [];
  const matches = req?.response.cards.length ?? 0;

  return (
    <Screen padBottom="pb-[150px]">
      <div className="flex h-11 items-center gap-4">
        <Circle href="/" label="Back">
          <ChevronLeft size={22} strokeWidth={2} />
        </Circle>
        <h1 className="flex-1 text-title3 text-ink">What we heard</h1>
        <Link
          href="/"
          onClick={() => {
            if (req) setDraft(req.sentence);
          }}
          className="text-body font-semibold text-grey"
        >
          Edit
        </Link>
      </div>
      <Gap h={34} />
      {req ? (
        <>
          <Body>&ldquo;{req.sentence}&rdquo;</Body>
          <div style={{ height: 36 }} aria-hidden="true" />
          {pills.map((p) => (
            <div key={p.id} className="flex items-center justify-between border-b border-divider py-3.5" style={busy === p.id ? { opacity: 0.5 } : undefined}>
              <span className="text-body text-ink">{p.label}<span className="text-grey">{p.must ? " · must" : ""}</span></span>
              {p.removable ? (
                <button type="button" onClick={() => void toggle(p.id)} className="press-dim text-subhead text-accent">Remove</button>
              ) : null}
            </div>
          ))}
          {req.response.emergency ? (
            <>
              <Gap h={24} />
              <Body>{req.response.emergency.note}</Body>
            </>
          ) : null}
          {req.response.careGuidance ? (
            <>
              <Gap h={24} />
              <Body className="text-body">{req.response.careGuidance}</Body>
            </>
          ) : null}
        </>
      ) : missing ? (
        <Body>Nothing heard yet.</Body>
      ) : null}
      <Dock>
        <Cta fixed={false} onClick={() => router.push(matches > 0 ? "/match/1" : "/results")} disabled={!req || busy !== null}>
          Meet your matches
        </Cta>
      </Dock>
    </Screen>
  );
}
