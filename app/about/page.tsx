import { getDoctors, rosterCounts } from "@/src/data/providers";
import { ChevronLeft, Circle, Screen } from "@/src/ui/kit";

export const metadata = { title: "About · Wattle Health" };
export const revalidate = 3600;

const POINTS = [
  { title: "Picked for how they work", body: "We pick providers on what they treat and how they work: their approach, why they chose medicine, and life outside the clinic. It all comes from their own words on their own pages." },
  { title: "Every fact has a source", body: "Each fact links to where it came from, the doctor’s practice page or a public listing, with the date we read it." },
  { title: "Reviews", body: "For now, reviews here are labelled demo examples. Real ones will come only from patients who saw the doctor, and a person checks each one first." },
  { title: "Nobody pays", body: "No doctor or service pays to be listed, picked or ranked." },
];

export default async function AboutPage() {
  const counts = await rosterCounts();
  const own = (await getDoctors()).filter((d) => d.personal?.status === "published").length;
  return (
    <Screen>
      <div className="flex h-11 items-center"><Circle href="/me" label="Back"><ChevronLeft size={22} strokeWidth={2} /></Circle></div>
      <h1 className="display rise mt-6 text-hero text-ink">A doctor who fits you as well as your condition.</h1>
      <div className="mt-10 flex flex-col gap-7">
        {POINTS.map((p, i) => (
          <div key={p.title} className="rise" style={{ "--i": i } as React.CSSProperties}>
            <h2 className="display text-title2 text-ink">{p.title}</h2>
            <p className="mt-1.5 text-body leading-read text-charcoal">{p.body}</p>
          </div>
        ))}
      </div>
      <p className="mt-10 text-subhead text-grey">{counts.total} doctors listed across Australia, {own} in their own words.</p>
    </Screen>
  );
}
