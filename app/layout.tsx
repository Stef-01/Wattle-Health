import type { Metadata, Viewport } from "next";
import "./globals.css";
import { OpeningsWatcher } from "@/src/ui/OpeningsWatcher";
import { OpeningPrompt } from "@/src/ui/OpeningPrompt";
import { BrandTitle } from "@/src/ui/brand";
import { AppNav } from "@/src/ui/AppNav";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { defaultMode, MODE_COOKIE } from "@/src/mode";
import { inter, newsreader } from "./fonts";

export const metadata: Metadata = {
  title: "Wattle",
  description: "Doctors who listen. Say what you need in one sentence and meet doctors across Australia in their own words.",
  applicationName: "Wattle",
  appleWebApp: { capable: true, title: "Wattle", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", interactiveWidget: "resizes-content", themeColor: "#ffffff" };

// Every screen is its own 430-wide phone frame (src/ui/kit Screen); the layout adds no chrome.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU" data-mode={defaultMode()} className={`${inter.variable} ${newsreader.variable}`} suppressHydrationWarning>
      <head>
        {/* The mode from the cookie, on <html> before anything paints, so a static page can show one mode's
            markup (src/ui/ByMode.tsx) without a frame of the other. Reading it here keeps every page static. */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){var m=(document.cookie.match(/(?:^|; )${MODE_COOKIE.replace(".", "\\.")}=(adhdme|wattle)/)||[])[1];if(m)document.documentElement.dataset.mode=m;})()` }} />
        {/* Whether this visitor has saved doctors, a current search and a compare pair, on <html> before anything
            paints: the static HTML carries each page's empty state and its skeleton, and CSS shows the one that
            applies (globals.css [data-pre]). The screens then hydrate into the real state with no blank frame. */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var d=document.documentElement,L=localStorage,S=sessionStorage,n=function(k){try{return JSON.parse(L.getItem(k)||"[]").length>0}catch(e){return false}};d.dataset.saved=n("wattle.saved.v1")?"some":"none";d.dataset.named=L.getItem("wattle.name")?"some":"none";d.dataset.compare=n("wattle.compare")?"some":"none";d.dataset.search=S.getItem("wattle.req.current")?"some":"none"}catch(e){}})()` }} />
      </head>
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
