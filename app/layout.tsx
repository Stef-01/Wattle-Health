import type { Metadata, Viewport } from "next";
import "./globals.css";
import { OpeningsWatcher } from "@/src/ui/OpeningsWatcher";
import { OpeningPrompt } from "@/src/ui/OpeningPrompt";
import { BrandTitle } from "@/src/ui/brand";
import { AppNav } from "@/src/ui/AppNav";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata: Metadata = {
  title: "Wattle",
  description: "Doctors who listen. Say what you need in one sentence and meet doctors across Australia in their own words.",
  applicationName: "Wattle",
  appleWebApp: { capable: true, title: "Wattle", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#ffffff" };

// Every screen is its own 430-wide phone frame (src/ui/kit Screen); the layout adds no chrome.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU">
      <body>
        {children}
        <OpeningsWatcher />
        <OpeningPrompt />
        <BrandTitle />
        <AppNav />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
