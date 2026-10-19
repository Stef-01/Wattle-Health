import type { Metadata, Viewport } from "next";
import "./globals.css";
import { OpeningsWatcher } from "@/src/ui/OpeningsWatcher";
import { OpeningPrompt } from "@/src/ui/OpeningPrompt";

export const metadata: Metadata = {
  title: "Wattle",
  description: "Doctors who listen. Say what you need in one sentence and meet Queensland doctors in their own words.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ffffff" };

// Every screen is its own 430-wide phone frame (src/ui/kit Screen); the layout adds no chrome.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU">
      <body>
        {children}
        <OpeningsWatcher />
        <OpeningPrompt />
      </body>
    </html>
  );
}
