// Fixed bottom slot for a CTA. Apple pass: it sits on the home-indicator inset (or just above the
// floating tab bar) via --dock-pb; `bottom` overrides that in px when a screen needs its own offset.
import type { ReactNode } from "react";

export function Dock({ children, bottom }: { children: ReactNode; bottom?: number }) {
  return (
    <div className="dock frame-fixed pointer-events-none bottom-0 z-20">
      <div className="pointer-events-auto frame-pad pt-2" style={{ paddingBottom: bottom ?? "var(--dock-pb)" }}>
        {children}
      </div>
    </div>
  );
}
