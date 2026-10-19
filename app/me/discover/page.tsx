// Settings › Discover. Offerings are read at build/request time from data/discover/offerings.json.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Discover, type Offering } from "@/src/ui/screens/patient-b/Discover";

export const metadata = { title: "Discover · Wattle" };

function offerings(): Offering[] {
  const file = path.join(process.cwd(), "data", "discover", "offerings.json");
  if (!existsSync(file)) return [];
  const parsed = JSON.parse(readFileSync(file, "utf8")) as { offerings?: Offering[] };
  return (parsed.offerings ?? []).filter((o) => o.url && o.name && o.category);
}

export default function DiscoverPage() {
  return <Discover offerings={offerings()} />;
}
