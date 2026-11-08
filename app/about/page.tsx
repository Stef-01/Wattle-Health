import { getDoctors } from "@/src/data/providers";
import { STATES } from "@/src/data/types";
import { scopeRoster } from "@/src/server/mode";
import { ByMode } from "@/src/ui/ByMode";
import { Disclosure, NavBar, Screen } from "@/src/ui/kit";

export const metadata = { title: "About · Wattle Health" };
// Apple pass: progressive disclosure keeps the first screen inside the 20-60 word budget; each point opens in place.

const POINTS = [
  { title: "Picked for how they work", body: "We pick providers on what they treat and how they work: their approach, why they chose medicine, and life outside the clinic. It all comes from their own words on their own pages." },
  { title: "Every fact has a source", body: "Each fact links to where it came from, the doctor’s practice page or a public listing, with the date we read it." },
  { title: "Reviews", body: "For now, reviews here are labelled demo examples. Real ones will come only from patients who saw the doctor, and a person checks each one first." },
  { title: "Nobody pays", body: "No doctor or service pays to be listed, picked or ranked." },
];

// Static: the one line that differs by mode is built for both and picked in the browser (ByMode), so the
// page is served from the edge instead of a per-request function (4 to 5 s cold).
export default async function AboutPage() {
  const all = await getDoctors();
  const line = (mode: "wattle" | "adhdme") => {
    const roster = scopeRoster(all, mode);
    const own = roster.filter((d) => d.personal?.status === "published").length;
    return `${roster.length} ${mode === "adhdme" ? "ADHD providers" : "doctors"} listed across Australia, ${own} in their own words.`;
  };
  return (
    <Screen>
      <NavBar back="/me" />
      <h1 className="display rise mt-4 text-large-title font-medium text-ink">A doctor who fits you as well as your condition.</h1>
      <p className="mt-3 text-body text-grey"><ByMode wattle={line("wattle")} adhdme={line("adhdme")} /></p>
      <a href="/about/coverage" className="press-soft mt-2 flex min-h-11 items-center text-body text-accent">Who sees people in each of the {STATES.length} states</a>
      <div className="mt-8">
        {POINTS.map((p) => (
          <Disclosure key={p.title} title={p.title}>
            <p className="text-body leading-read text-ink">{p.body}</p>
          </Disclosure>
        ))}
      </div>
    </Screen>
  );
}
