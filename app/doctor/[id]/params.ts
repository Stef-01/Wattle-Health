// The [id] params the doctor page prerenders: every doctor with a published personal profile (the
// ones Home, search and Discover lead to; a cold on-demand render cost 4 to 5 s on Vercel) plus the
// first 40 of the roster. The rest render on first visit and are kept for an hour (revalidate).
import { doctorSlug } from "@/src/data/doctor-slug";
import { getDoctors } from "@/src/data/providers";

export async function doctorParams(): Promise<Array<{ id: string }>> {
  const doctors = await getDoctors();
  const ids = new Set<string>();
  for (const d of doctors) if (d.personal?.status === "published") ids.add(d.id);
  for (const d of doctors.slice(0, 40)) ids.add(d.id);
  return [...ids].map((id) => ({ id: doctorSlug(id) }));
}
