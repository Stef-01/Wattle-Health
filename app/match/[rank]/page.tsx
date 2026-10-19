import { redirect } from "next/navigation";

export const metadata = { title: "Your picks · Wattle" };

/** The swipe-through match screen was retired in v4; every rank now lands on the results list. */
export default function MatchPage() {
  redirect("/results");
}
