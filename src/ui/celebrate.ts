// A rare-moment acknowledgement (booking, calendar connected). Apple pass 2026-10-23: the particle
// burst from the playful pass is gone; the moment is a short haptic tap where the device has one,
// and the screen's own drawn tick (.tick) carries it visually, as Apple Pay does. Skipped under
// reduced motion. `count` is kept for callers and ignored.
export function celebrate(_count = 0) {
  void _count;
  if (typeof window === "undefined" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (navigator.vibrate) navigator.vibrate(10);
}
