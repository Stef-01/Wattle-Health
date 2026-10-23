// Scroll lock for sheets, ported from Apple's own web code (swift-docc-render module 4610, found with REA;
// docs/apple/REA.md). On iPhone and iPad a non-passive touchmove keeps the page still while the panel
// scrolls, and stops the panel's rubber-band at either end from dragging the page; a pinch still works.
// Elsewhere the body is pinned at its scroll offset and put back exactly on unlock.

const DISABLE_ATTR = "data-scroll-lock-disable";
let locked = false;
let startY = -1;
let savedTop = 0;
const panelHandlers = new WeakMap<HTMLElement, { start: (e: TouchEvent) => void; move: (e: TouchEvent) => void }>();

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iP(ad|hone|od)/.test(navigator.platform) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function preventPage(e: TouchEvent) {
  if (e.touches.length > 1) return;
  e.preventDefault();
}

const atBottom = (el: HTMLElement) => el.scrollHeight - el.scrollTop <= el.clientHeight;

export function lockScroll(panel: HTMLElement | null): void {
  if (locked) return;
  if (isIOS()) {
    document.addEventListener("touchmove", preventPage, { passive: false });
    if (panel) {
      const start = (e: TouchEvent) => {
        if (e.targetTouches.length === 1) startY = e.targetTouches[0]!.clientY;
      };
      const move = (e: TouchEvent) => {
        if (e.targetTouches.length !== 1) return;
        const dy = e.targetTouches[0]!.clientY - startY;
        const scroller = (e.target as Element | null)?.closest<HTMLElement>(`[${DISABLE_ATTR}]`) ?? panel;
        if ((scroller.scrollTop === 0 && dy > 0) || (atBottom(scroller) && dy < 0)) preventPage(e);
        else e.stopPropagation();
      };
      panel.addEventListener("touchstart", start, { passive: true });
      panel.addEventListener("touchmove", move, { passive: false });
      panelHandlers.set(panel, { start, move });
    }
  } else {
    savedTop = document.body.getBoundingClientRect().top;
    const s = document.body.style;
    s.overflow = "hidden scroll";
    s.top = `${savedTop}px`;
    s.position = "fixed";
    s.width = "100%";
  }
  locked = true;
}

export function unlockScroll(panel: HTMLElement | null): void {
  if (!locked) return;
  if (isIOS()) {
    const h = panel ? panelHandlers.get(panel) : undefined;
    if (panel && h) {
      panel.removeEventListener("touchstart", h.start);
      panel.removeEventListener("touchmove", h.move);
      panelHandlers.delete(panel);
    }
    document.removeEventListener("touchmove", preventPage);
  } else {
    const s = document.body.style;
    for (const k of ["overflow", "top", "position", "width"]) s.removeProperty(k);
    window.scrollTo(0, Math.abs(savedTop));
  }
  locked = false;
}
