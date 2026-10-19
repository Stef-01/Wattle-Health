// Team › Outreach: who to call next and what to ask. Not linked from patient screens; noindex.
import { outreachQueue } from "@/src/data/outreach";
import { Screen } from "@/src/ui/kit";

export const metadata = { title: "Outreach · Wattle team", robots: { index: false, follow: false } };
export const revalidate = 3600;

export default async function OutreachPage() {
  const q = await outreachQueue();
  const published = q.filter((r) => r.status === "published");
  return (
    <Screen>
      <h1 className="display mt-6 text-[30px] text-ink">Outreach queue</h1>
      <p className="mt-2 text-[15px] text-grey">{q.length} doctors with gaps. {published.length} already in their own words need one short call. Thin profiles rank lower until filled. JSON: /api/outreach</p>
      <div className="mt-6 flex flex-col gap-3">
        {q.slice(0, 120).map((r) => (
          <details key={r.id} className="rounded-[18px] border border-hairline px-4 py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate text-[16px] text-ink">{r.name}</span>
                <span className="block text-[13px] text-grey">{r.specialty} · {r.suburb ?? "QLD"} · {Math.round(r.score * 100)}% · {r.status}</span>
              </span>
              <span className="shrink-0 text-[13px] text-grey">{r.missing.length} gaps</span>
            </summary>
            <ol className="mt-3 list-decimal pl-5 text-[14px] leading-[1.5] text-charcoal">
              {r.questions.map((x) => <li key={x}>{x}</li>)}
            </ol>
            <p className="mt-2 flex gap-4 text-[14px]">
              {r.phone ? <a className="text-accent" href={`tel:${r.phone.replace(/[^\d+]/g, "")}`}>{r.phone}</a> : null}
              {r.website ? <a className="text-accent" href={r.website} target="_blank" rel="noreferrer">Website</a> : null}
            </p>
          </details>
        ))}
      </div>
    </Screen>
  );
}
