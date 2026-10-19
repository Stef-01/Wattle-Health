// Healthspan landing and guided match. Offerings read from data/discover/offerings.json.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Offering } from "@/src/ui/screens/patient-b/Discover";
import { HealthspanLanding } from "@/src/ui/screens/patient-b/HealthspanLanding";

export const metadata = { title: "Healthspan · Wattle", description: "More years in good health. Find a Queensland doctor who works on prevention and reads your wearable and bloodwork with you." };

function offerings(): Offering[] {
  const file = path.join(process.cwd(), "data", "discover", "offerings.json");
  if (!existsSync(file)) return [];
  return ((JSON.parse(readFileSync(file, "utf8")) as { offerings?: Offering[] }).offerings ?? []).filter((o) => o.url && o.name);
}

export default function HealthspanPage() {
  return <HealthspanLanding offerings={offerings()} />;
}
