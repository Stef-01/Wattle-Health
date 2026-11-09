// Both families through next/font/local (2026-11-08): the same Fontsource woff2 files as before, but the
// HTML head now preloads them, so they start with the document instead of after the stylesheet. Measured on
// production with observed 4G/4x-CPU throttling: the fonts were discovered at 1.3 s and landed at ~3.1 s,
// and the swap re-rendered every page's title, which is what moved LCP to 3.1–3.8 s while first paint was
// 1.5 s. next/font also sizes the fallback face so the swap does not shift the layout.
import localFont from "next/font/local";

export const inter = localFont({
  // Upright only: nothing in the app sets italic (checked 2026-11-08), and the italic files were 273 KB
  // of the 422 KB the head was preloading on a 1.6 Mbps link.
  src: "../node_modules/@fontsource-variable/inter/files/inter-latin-opsz-normal.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-inter-v",
  adjustFontFallback: "Arial",
});

export const newsreader = localFont({
  src: "../node_modules/@fontsource-variable/newsreader/files/newsreader-latin-opsz-normal.woff2",
  style: "normal",
  weight: "200 800",
  display: "swap",
  variable: "--font-newsreader-v",
  adjustFontFallback: "Times New Roman",
});
