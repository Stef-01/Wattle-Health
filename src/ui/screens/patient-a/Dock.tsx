// Fixed bottom slot for a CTA, at the exact frame offset the Figma screens use: the CTA's bottom
// edge sits 56 px up (P03/P04, top 810) or 94 px up when the tab bar is under it (P02, top 772).
import type { ReactNode } from "react";

export function Dock({ children, bottom = 56 }: { children: ReactNode; bottom?: number }) {
  return (
    <div className="dock frame-fixed pointer-events-none bottom-0 z-20">
      <div className="pointer-events-auto frame-pad" style={{ paddingBottom: bottom }}>
        {children}
      </div>
    </div>
  );
}
