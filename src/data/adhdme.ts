// The ADHDme network card on a Wattle record: the fee notes, the booking link and the facts the
// network page lists. No fs here: the profile (server) and the contact sheet (client) both import it.
//
// FEE NOTES ARE HTML ON THE SOURCE PAGE (an <a> to the MBS item, a <strong> on the funding sum).
// They are never rendered as HTML here. `noteSegments` reads exactly three things out of a note,
// plain text, <strong> and <a href="https://…">, and drops every other tag, so a note can carry its
// Medicare and JobAccess links without the page ever injecting markup.
import type { AdhdmeCard, NoteSegment } from "./types";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", ndash: "–", mdash: "—" };

function decode(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&([a-z]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m);
}

function strip(s: string): string {
  return decode(s.replace(/<[^>]*>/g, ""));
}

/** One fee note → safe segments. Adjacent text merges; empty pieces are dropped. */
export function noteSegments(html: string): NoteSegment[] {
  const out: NoteSegment[] = [];
  const push = (seg: NoteSegment) => {
    if (!seg.text) return;
    const last = out[out.length - 1];
    if (seg.kind === "text" && last?.kind === "text") last.text += seg.text;
    else out.push(seg);
  };
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>|<strong\b[^>]*>([\s\S]*?)<\/strong>/gi;
  let at = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    push({ kind: "text", text: strip(html.slice(at, m.index)) });
    if (m[2] !== undefined) {
      const href = /\bhref\s*=\s*"([^"]+)"/i.exec(m[1] ?? "")?.[1];
      const text = strip(m[2]);
      if (href && /^https?:\/\//i.test(href)) push({ kind: "link", text, href: decode(href) });
      else push({ kind: "text", text });
    } else {
      push({ kind: "strong", text: strip(m[3] ?? "") });
    }
    at = m.index + m[0].length;
  }
  push({ kind: "text", text: strip(html.slice(at)) });
  return out;
}

/**
 * "Fees are set and charged by the practice. ADHDme takes no commission." closes every ADHDme fee
 * block. It is a statement about the ADHDme site, not a fact about the provider, and it reads wrong
 * under the Wattle name, so it stays on adhdme.au.
 */
export function isSiteBoilerplate(text: string): boolean {
  return /ADHDme takes no commission/i.test(text);
}

/** The generator's snake_case card → the record's camelCase card. */
export type RawCard = {
  id: string;
  slug: string;
  category: string;
  role?: string;
  summary?: string;
  chips?: string[];
  qualifications?: string | null;
  experience?: string[];
  pathway?: { step: string; detail: string }[];
  works_with?: string[];
  fees?: { heading?: string; figures?: { amount: string; label: string }[]; notes?: string[] };
  booking?: { url: string; hint?: string | null } | null;
  links?: { kind: string; label: string; url: string }[];
  details?: { label: string; value: string }[];
  disclosure?: string | null;
  assesses?: boolean;
  bulk_billed?: boolean;
  evidence_unclear?: boolean;
  profile_url: string;
};

export function cardFrom(raw: RawCard, observedAt: string): AdhdmeCard {
  const notes = (raw.fees?.notes ?? []).map(noteSegments).filter((segs) => segs.length > 0 && !isSiteBoilerplate(segs.map((s) => s.text).join("")));
  const booking = raw.booking?.url && /^https?:\/\//.test(raw.booking.url) ? { url: raw.booking.url, hint: raw.booking.hint ?? null } : null;
  return {
    id: raw.id,
    slug: raw.slug,
    category: raw.category,
    role: raw.role ?? "",
    summary: raw.summary ?? "",
    chips: raw.chips ?? [],
    qualifications: raw.qualifications ?? null,
    experience: raw.experience ?? [],
    pathway: (raw.pathway ?? []).map((p) => ({ step: p.step, detail: strip(p.detail) })),
    worksWith: (raw.works_with ?? []).map(strip),
    fees: { heading: raw.fees?.heading ?? "What it costs", figures: raw.fees?.figures ?? [], notes },
    booking,
    links: (raw.links ?? []).filter((l) => /^https?:\/\//.test(l.url)),
    details: (raw.details ?? []).map((d) => ({ label: d.label, value: strip(d.value) })),
    disclosure: raw.disclosure ?? null,
    assesses: raw.assesses !== false,
    bulkBilled: raw.bulk_billed === true,
    evidenceUnclear: raw.evidence_unclear === true,
    profileUrl: raw.profile_url,
    observedAt,
  };
}

/** A fact ADHDme lists under the card, by its label ("Wheelchair access"), or null. */
export function cardDetail(card: Pick<AdhdmeCard, "details">, label: string): string | null {
  return card.details.find((d) => d.label.toLowerCase() === label.toLowerCase())?.value ?? null;
}
