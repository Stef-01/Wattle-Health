// Retired 2026-10-19: everything here now lives in the profile's About tab (Zocdoc layout).
import { redirect } from "next/navigation";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/doctor/${id}`);
}
