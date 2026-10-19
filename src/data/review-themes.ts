// Reviews, amalgamated (2026-10-18): one "What patients say" paragraph and the themes behind it,
// read deterministically from the review text (no model). Themes are counted, not invented: a
// theme appears only when reviews mention it, with how many did.
export type ReviewLike = { rating: number; body: string };

const THEMES: { id: string; label: string; phrase: string; cues: RegExp }[] = [
  { id: "listens", label: "Listens", phrase: "listens properly", cues: /listen|heard|took me seriously|believed me/i },
  { id: "explains", label: "Explains clearly", phrase: "explains things clearly", cues: /explain|plain|made sense|understand/i },
  { id: "time", label: "Unhurried", phrase: "takes time and doesn’t rush", cues: /rush|time|unhurried|long(er)? appointment/i },
  { id: "warm", label: "Warm and kind", phrase: "is warm and kind", cues: /warm|kind|gentle|caring|compassion/i },
  { id: "plan", label: "Clear plan", phrase: "leaves you with a clear plan", cues: /plan|next step|follow[- ]?up/i },
  { id: "together", label: "Decides with you", phrase: "involves you in decisions", cues: /together|options|my say|involved|collaborat/i },
  { id: "gets-it", label: "Understands from experience", phrase: "understands what it’s like", cues: /gets it|lived experience|been there|understood what it/i },
  { id: "telehealth", label: "Easy telehealth", phrase: "makes telehealth easy", cues: /telehealth|video|from home/i },
];

export function reviewThemes(rows: ReviewLike[]): { id: string; label: string; count: number }[] {
  return THEMES.map((t) => ({ id: t.id, label: t.label, count: rows.filter((r) => t.cues.test(r.body)).length }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count);
}

/** "Most of 7 reviewers say Dr Wilson listens properly and explains things clearly. Several mention…". */
export function reviewCommentary(rows: ReviewLike[], name: string): string | null {
  if (rows.length === 0) return null;
  const themes = reviewThemes(rows);
  if (themes.length === 0) return null;
  const phrase = (id: string) => THEMES.find((t) => t.id === id)!.phrase;
  const share = (n: number) => (n === rows.length ? "Every reviewer" : n / rows.length >= 0.6 ? "Most reviewers" : n / rows.length >= 0.3 ? "Several reviewers" : "A few reviewers");
  const [a, b, c] = themes;
  const first = b && share(b.count) === share(a!.count) ? `${share(a!.count)} say ${name} ${phrase(a!.id)} and ${phrase(b.id)}.` : `${share(a!.count)} say ${name} ${phrase(a!.id)}.`;
  const restTheme = b && share(b.count) === share(a!.count) ? c : b;
  const second = restTheme ? ` ${share(restTheme.count)} mention that ${name.split(" ").slice(0, 2).join(" ")} ${phrase(restTheme.id)}.` : "";
  return first + second;
}
