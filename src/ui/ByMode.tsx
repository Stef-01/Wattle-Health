// Lets a server page stay static while still differing by mode. Both modes' markup is built; a one-line
// script in <head> (app/layout.tsx) stamps `data-mode` on <html> from the cookie before first paint, and
// CSS (app/globals.css) hides the other branch. No JavaScript runs for the switch, so an ADHDme reader never
// sees a frame of Wattle content. Reading the cookie on the server made About and Coverage per-request
// function calls (4 to 5 s cold on Vercel) for a line of text.
import type { ReactNode } from "react";

/** `block` for block children (a Group of rows); the default span sits inside a paragraph without breaking it. */
export function ByMode({ wattle, adhdme, block = false }: { wattle: ReactNode; adhdme: ReactNode; block?: boolean }) {
  const Tag = block ? "div" : "span";
  return (
    <>
      <Tag className="contents" data-mode="wattle">{wattle}</Tag>
      <Tag className="contents" data-mode="adhdme">{adhdme}</Tag>
    </>
  );
}
