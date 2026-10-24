import { getDoctors } from "@/src/data/providers";
import type { DoctorRecord } from "@/src/data/types";
import { currentMode, scopeRoster } from "@/src/server/mode";
import { Home, type Face } from "@/src/ui/screens/patient-a/Home";

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

// The mode decides the roster (src/mode.ts), so this page is rendered per request.
export default async function HomePage() {
  const mode = await currentMode();
  const roster = scopeRoster(await getDoctors(), mode);
  return <Home mode={mode} faces={faces(roster)} count={roster.filter((d) => d.personal?.status === "published").length} />;
}
