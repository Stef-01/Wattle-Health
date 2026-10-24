import { adminEnabled } from "@/src/admin-session";
import { Screen } from "@/src/ui/kit";
import { SignIn } from "@/src/ui/admin/client";

export default function AdminLogin() {
  return (
    <Screen>
      <h1 className="mt-10 text-large-title text-ink">Wattle admin</h1>
      <p className="mt-1 mb-6 text-subhead text-grey">Review new categories, train the decision tree, test a transcript.</p>
      <SignIn enabled={adminEnabled()} />
    </Screen>
  );
}
