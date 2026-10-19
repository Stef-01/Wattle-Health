import { getDoctors, rosterCounts } from "@/src/data/providers";
import { ArrowLeft, Circle, Screen } from "@/src/ui/kit";

export const metadata = { title: "About · Wattle Health" };
export const revalidate = 3600;

const POINTS = [
  { title: "Matched on how they work", body: "Doctors are matched by what they treat and by how they work: their approach, why they do it, and life outside the clinic. Their own words, from their own pages." },
  { title: "Every fact has a source", body: "Each fact links to where it came from, the doctor's practice page or a public listing, with the date we read it." },
  { title: "Reviews, honestly", body: "Reviews here are labelled demo examples for now. Real ones will come only from patients who saw the doctor, checked before they appear." },
  { title: "Nobody pays", body: "No doctor or service pays to be listed, matched or ranked." },
];

export default async function AboutPage() {
  const counts = await rosterCounts();
  const own = (await getDoctors()).filter((d) => d.personal?.status === "published").length;
  return (
    <Screen>
      <div className="flex h-11 items-center"><Circle href="/me" label="Back"><ArrowLeft size={20} /></Circle></div>
      <h1 className="display rise mt-8 text-[36px] leading-[1.1] text-ink">A doctor who fits you, not just your condition.</h1>
      <div className="mt-10 flex flex-col gap-7">
        {POINTS.map((p, i) => (
          <div key={p.title} className="rise" style={{ "--i": i } as React.CSSProperties}>
            <h2 className="display text-[21px] text-ink">{p.title}</h2>
            <p className="mt-1.5 text-[16px] leading-[1.5] text-charcoal">{p.body}</p>
          </div>
        ))}
      </div>
      <p className="mt-10 text-[14px] text-grey">{counts.total} Queensland doctors listed, {own} in their own words.</p>
    </Screen>
  );
}
