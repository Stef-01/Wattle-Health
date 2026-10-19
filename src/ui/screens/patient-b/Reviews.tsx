"use client";
// Patient reviews on a profile (2026-10-18): a summary (average, count, "Highly recommended by
// Wattle patients" at 3+ reviews averaging 4.5+), the latest three with "Show all", and a "Write a
// review" sheet. Every review is checked before it appears; nothing is imported or invented.
import { useEffect, useState } from "react";
import { Cta, Sheet } from "@/src/ui/kit";

type Review = { id: string; rating: number; body: string; visited: string; created_at: string };
type Data = { reviews: Review[]; count: number; average: number | null; highlyRecommended: boolean };

const VISITED: Record<string, string> = { "this-month": "Visited this month", "this-year": "Visited this year", earlier: "Visited earlier" };

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" fill={i <= Math.round(value) ? "#2f5d3a" : "#e3e3e3"} />
        </svg>
      ))}
    </span>
  );
}

export function Reviews({ doctorId, name }: { doctorId: string; name: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [visited, setVisited] = useState("");
  const [text, setText] = useState("");
  const [saw, setSaw] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/reviews?doctor=${encodeURIComponent(doctorId)}`)
      .then((r) => r.json())
      .then((d: Data) => setData(d))
      .catch(() => setData({ reviews: [], count: 0, average: null, highlyRecommended: false }));
  }, [doctorId]);

  async function submit() {
    setState("sending");
    const res = await fetch("/api/reviews", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ doctorId, rating, body: text, visited, sawDoctor: saw }) }).catch(() => null);
    if (res?.ok) setState("sent");
    else {
      setState("error");
      setError(((await res?.json().catch(() => null)) as { error?: string } | null)?.error ?? "Could not send it just now.");
    }
  }

  const ready = rating > 0 && visited && text.trim().length >= 20 && saw;
  const shown = data ? (all ? data.reviews : data.reviews.slice(0, 3)) : [];

  return (
    <section aria-label={`Reviews of ${name}`} className="flex flex-col gap-3">
      <h2 className="display text-[19px] text-ink">Patient reviews</h2>
      {data && data.count > 0 ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-display text-[28px] leading-none text-ink">{data.average?.toFixed(1)}</span>
          <Stars value={data.average ?? 0} size={18} />
          <span className="text-[14px] text-grey">{data.count} verified {data.count === 1 ? "review" : "reviews"}</span>
          {data.highlyRecommended ? <span className="w-full text-[14px] font-medium text-[#2f5d3a]">Highly recommended by Wattle patients</span> : null}
        </div>
      ) : (
        <p className="text-[15px] leading-[1.5] text-grey">No reviews yet. Wattle only shows reviews from people who saw this doctor, and checks each one before it appears.</p>
      )}
      {shown.map((r) => (
        <article key={r.id} className="rounded-[18px] border border-hairline px-4 py-3">
          <div className="flex items-center justify-between">
            <Stars value={r.rating} />
            <span className="text-[13px] text-grey">{VISITED[r.visited] ?? ""}</span>
          </div>
          <p className="mt-2 text-[15px] leading-[1.5] text-charcoal">{r.body}</p>
        </article>
      ))}
      {data && data.count > 3 ? (
        <button type="button" onClick={() => setAll((v) => !v)} className="press-dim self-start text-[15px] font-medium text-accent">{all ? "Show fewer" : `Show all ${data.count} reviews`}</button>
      ) : null}
      <button type="button" onClick={() => setOpen(true)} className="press self-start rounded-full border border-hairline px-4 py-2.5 text-[15px] text-ink">Write a review</button>

      <Sheet open={open} onClose={() => setOpen(false)} title={state === "sent" ? "Thank you" : `Review ${name}`}>
        {state === "sent" ? (
          <>
            <p className="text-[16px] leading-[1.5] text-charcoal">Your review is with us. It appears after a quick check, usually within a few days.</p>
            <Cta fixed={false} onClick={() => setOpen(false)}>Done</Cta>
          </>
        ) : (
          <>
            <div className="flex gap-2" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((i) => (
                <button key={i} type="button" role="radio" aria-checked={rating === i} aria-label={`${i} star${i > 1 ? "s" : ""}`} onClick={() => setRating(i)} className="press">
                  <svg width={36} height={36} viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" fill={i <= rating ? "#2f5d3a" : "#e3e3e3"} /></svg>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(VISITED).map(([k, v]) => (
                <button key={k} type="button" onClick={() => setVisited(k)} className={`press rounded-full border px-3 py-2 text-[14px] ${visited === k ? "border-[#2f5d3a] bg-[#f5f8f6] text-ink" : "border-hairline text-grey"}`}>{v}</button>
              ))}
            </div>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={1000} placeholder="What was it like? How did they listen and explain things?" className="field w-full rounded-[16px] border-2 border-line p-3 text-[15px] outline-none" />
            <p className="text-[12px] leading-[1.45] text-grey">Describe how they communicated and how you felt. Please don’t name medicines or describe results; we remove those before publishing.</p>
            <label className="flex items-start gap-3 text-[14px] text-charcoal">
              <input type="checkbox" checked={saw} onChange={(e) => setSaw(e.target.checked)} className="mt-1 size-4 accent-[#2f5d3a]" />
              I saw this doctor, myself or with someone I care for.
            </label>
            {state === "error" ? <p className="text-[14px] text-danger">{error}</p> : null}
            <Cta fixed={false} disabled={!ready || state === "sending"} onClick={() => void submit()}>{state === "sending" ? "Sending" : "Send review"}</Cta>
          </>
        )}
      </Sheet>
    </section>
  );
}
