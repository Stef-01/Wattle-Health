import { CompareTable } from "@/src/ui/CompareTable";
import { Screen, TopBar } from "@/src/ui/kit";

// Reads localStorage in the browser (CompareTable is a client component); nothing here is per request.
export const metadata = { title: "Compare · Wattle Health" };

export default function ComparePage() {
  return (
    <Screen>
      <TopBar title="Compare" back="/results" />
      <CompareTable />
    </Screen>
  );
}
