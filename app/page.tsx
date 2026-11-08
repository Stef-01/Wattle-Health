import { getDoctors } from "@/src/data/providers";
import type { DoctorRecord } from "@/src/data/types";
import { scopeRoster } from "@/src/server/mode";
import { Home, type Face, type HomeByMode } from "@/src/ui/screens/patient-a/Home";

export const metadata = { title: "Wattle" };

/** Five doctors with a published profile and a practice portrait, in a stable order. */
function faces(all: DoctorRecord[]): Face[] {
  return all
    .filter((d) => d.photo && d.personal?.status === "published")
    .sort((a, b) => a.id.localeCompare(b.id))
    .filter((_, i) => i % 7 === 0)
    .slice(0, 5)
    .map((d) => ({ id: d.id, name: d.name.display, url: d.photo!.url }));
}

// Static: Home is the screen every tab bar hop returns to, so it is built once and served from the
// edge instead of rendered per request (reading the mode cookie here made it a 0.5 to 1 s function
// call on every return home). Both modes' faces ship in the page and the client picks by the cookie.
export default async function HomePage() {
  const all = await getDoctors();
  const byMode = Object.fromEntries(
    (["wattle", "adhdme"] as const).map((mode) => {
      const roster = scopeRoster(all, mode);
      return [mode, { faces: faces(roster), count: roster.filter((d) => d.personal?.status === "published").length }];
    }),
  ) as HomeByMode;
  return <Home byMode={byMode} />;
}
