"use client";
// The doctor profile page on the Zocdoc provider-page layout (founder's screenshot, 2026-10-19):
// the same panel as a match, under an iOS back circle in place of the match ordinal.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Card } from "@/src/data/search-types";
import { NavBar, Screen } from "@/src/ui/kit";
import { getSavedIds, toggleSavedId } from "@/src/ui/store";
import { MatchPanel } from "../patient-a/MatchPanel";

export function DoctorPage({ card, labels }: { card: Card; labels: Record<string, string> }) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  useEffect(() => setSaved(getSavedIds().includes(card.doctor.id)), [card.doctor.id]);
  return (
    <Screen padBottom="pb-[120px]" className="frame-wide">
      <div className="mb-3">
        <NavBar onBack={() => (window.history.length > 1 ? router.back() : router.push("/"))} />
      </div>
      <MatchPanel variant="profile" card={card} index={0} total={1} labels={labels} saved={saved} onSave={() => setSaved(toggleSavedId(card.doctor.id).includes(card.doctor.id))} />
    </Screen>
  );
}
