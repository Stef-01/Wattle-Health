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
const TINTS = [
  ["#eef1ea", "#3c4a35"],
  ["#f3ece4", "#5a4632"],
  ["#e9eef3", "#34465a"],
  ["#f2ebee", "#5a3744"],
  ["#eeeaf3", "#43395a"],
] as const;
export function tintFor(name: string): readonly [string, string] {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return TINTS[Math.abs(h) % TINTS.length]!;
}

