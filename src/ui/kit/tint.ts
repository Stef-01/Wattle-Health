// Initials and the five muted tints, shared by server and client components (no "use client").
export function initialsFor(name: string): string {
  return name
    .replace(/^(dr|a\/prof|prof|associate professor|professor)\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/** Initials on a soft disc; a 2-letter mark that reads as a person without pretending to be a photo. */
/** Five muted tints, picked by name, so a list of initials reads as people rather than placeholders. */
/** The values live in app/globals.css (@theme --color-tint-N-bg / -fg); these are the references. */
const TINTS = [1, 2, 3, 4, 5].map((n) => [`var(--color-tint-${n}-bg)`, `var(--color-tint-${n}-fg)`] as const);
export function tintFor(name: string): readonly [string, string] {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return TINTS[Math.abs(h) % TINTS.length]! as readonly [string, string];
}

