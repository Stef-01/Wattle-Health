// Duolingo-style burst: a ring plus a spray of dots from the last tap point. DOM-only, no deps,
// skipped under reduced motion. Called on save, booking and calendar connect.
let last = { x: 0, y: 0 };
if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", (e) => { last = { x: e.clientX, y: e.clientY }; }, { capture: true, passive: true });
}
const COLORS = ["#1b1b1b", "#f5b700", "#ff7a59", "#4c9aff", "#2bb673"];
export function celebrate(count = 14) {
  if (typeof window === "undefined" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const { x, y } = last.x || last.y ? last : { x: innerWidth / 2, y: innerHeight / 2 };
  const host = document.createElement("div");
  host.className = "burst";
  host.style.left = `${x}px`;
  host.style.top = `${y}px`;
  host.innerHTML = `<i class="burst-ring"></i>`;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const d = 38 + Math.random() * 34;
    const p = document.createElement("i");
    p.className = "burst-dot";
    p.style.setProperty("--dx", `${Math.cos(a) * d}px`);
    p.style.setProperty("--dy", `${Math.sin(a) * d}px`);
    p.style.setProperty("--s", `${0.6 + Math.random() * 0.8}`);
    p.style.background = COLORS[i % COLORS.length] ?? "#1b1b1b";
    host.appendChild(p);
  }
  document.body.appendChild(host);
  if (navigator.vibrate) navigator.vibrate(12);
  window.setTimeout(() => host.remove(), 800);
}
