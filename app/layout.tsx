import type { Metadata, Viewport } from "next";
import "./globals.css";
import { OpeningsWatcher } from "@/src/ui/OpeningsWatcher";

export const metadata: Metadata = {
  title: "Wattle",
  description: "Doctors who listen. Find a doctor you can trust, from one sentence. Queensland first.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ffffff" };

// Every screen is its own 430-wide phone frame (src/ui/kit Screen); the layout adds no chrome.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU">
      <body>
        {children}
        <OpeningsWatcher />
      </body>
    </html>
  );
}
