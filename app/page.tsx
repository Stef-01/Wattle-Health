import { getDoctors } from "@/src/data/providers";
import { Home, type Face } from "@/src/ui/screens/patient-a/Home";

export const metadata = { title: "Wattle" };
export const revalidate = 3600;

/** Five doctors with a published profile and a practice portrait, in a stable order. */
async function faces(): Promise<Face[]> {
  const all = await getDoctors();
  return all
    .filter((d) => d.photo && d.personal?.status === "published")
    .sort((a, b) => a.id.localeCompare(b.id))
    .filter((_, i) => i % 7 === 0)
    .slice(0, 5)
    .map((d) => ({ id: d.id, name: d.name.display, url: d.photo!.url }));
}

export default async function HomePage() {
  return <Home faces={await faces()} count={(await getDoctors()).filter((d) => d.personal?.status === "published").length} />;
}
