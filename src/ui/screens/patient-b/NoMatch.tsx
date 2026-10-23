"use client";
// P10 No match (226:308). The results owner imports this; /results/none mounts it for QA.
// Header "Your picks" + "Edit", 30 px "No strong pick yet", 20 px Inter place line, three
// rows (map-pin, video, sliders), CTA "Show closest fits" at y=810.
import { Cta, Divider, FigmaIcon, Row, Screen, TopBar } from "@/src/ui/kit";
import { Space } from "./bits";

export interface NoMatchProps {
  radiusKm: number;
  /** How many doctors widening the radius would restore; null when the engine did not say. */
  widenCount: number | null;
  telehealthCount: number | null;
  onWiden: () => void;
  onTelehealth: () => void;
  /** Place name for "Within N km of X". */
  place?: string;
  widenToKm?: number;
  onChange?: () => void;
  changeHref?: string;
  onClosest?: () => void;
  editHref?: string;
  backHref?: string;
  busy?: boolean;
}

const doctors = (n: number | null) => (n === null ? undefined : `${n} ${n === 1 ? "doctor" : "doctors"}`);

export function NoMatch({ radiusKm, widenCount, telehealthCount, onWiden, onTelehealth, place = "Brisbane", widenToKm = 50, onChange, changeHref = "/adjust", onClosest, editHref = "/heard", backHref = "/", busy = false }: NoMatchProps) {
  return (
    <Screen padBottom="pb-[140px]">
      <TopBar title="Your picks" back={backHref} right="Edit" rightHref={editHref} />
      <Space h={40} />
      <h1 className="font-sans text-title1 text-charcoal">No strong pick yet</h1>
      <Space h={8} />
      <p className="font-inter text-title3 text-grey">
        Within {radiusKm} km of {place}
      </p>
      <Space h={36} />
      <div style={busy ? { opacity: 0.5 } : undefined}>
        <Row icon={<FigmaIcon name="map-pin-17" size={17} />} title={`Widen to ${widenToKm} km`} sub={doctors(widenCount)} onClick={onWiden} />
        <Divider />
        <Row icon={<FigmaIcon name="video" size={17} />} title="Add telehealth-only doctors" sub={doctors(telehealthCount)} onClick={onTelehealth} />
        <Divider />
        {onChange ? (
          <Row icon={<FigmaIcon name="sliders" size={17} />} title="Change what you need" onClick={onChange} />
        ) : (
          <Row icon={<FigmaIcon name="sliders" size={17} />} title="Change what you need" href={changeHref} />
        )}
        <Divider />
      </div>
      <Cta onClick={onClosest ?? onWiden} disabled={busy}>Show closest fits</Cta>
    </Screen>
  );
}
