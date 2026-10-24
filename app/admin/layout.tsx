// Every admin page is private and per request.
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin · Wattle", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
