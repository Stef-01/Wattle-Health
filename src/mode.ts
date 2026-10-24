// The app's mode (founder 2026-10-19 named it; 2026-10-24 made it mean something). "wattle" is the
// whole national directory. "adhdme" is the same app narrowed to one job: access to ADHD support.
// In ADHDme mode the roster is the ADHD cohort only, searches about anything else say so instead of
// returning ADHD providers, and the surfaces that are about other things (Healthspan, Discover)
// are hidden. No fs and no next/headers here: server and client both import it.
//
// Where the mode comes from, first match wins:
//   ?mode=adhdme | ?mode=wattle   middleware.ts writes the cookie, so a shared link sets it
//   the `wattle.mode` cookie      set by the Profile switch; the server reads it per request
//   NEXT_PUBLIC_APP_MODE          the deployment's default (an adhdme.au build sets "adhdme")
import type { Discipline } from "@/src/disciplines/load";

export const MODES = { wattle: "Wattle", adhdme: "ADHDme" } as const;
export type AppMode = keyof typeof MODES;
export const MODE_COOKIE = "wattle.mode";

export function parseMode(value: unknown): AppMode | null {
  return value === "adhdme" || value === "wattle" ? value : null;
}

export function defaultMode(): AppMode {
  return parseMode(process.env.NEXT_PUBLIC_APP_MODE) ?? "wattle";
}

/** Conditions that put a search, or a provider, inside ADHD support. Autism is here because AuDHD is one presentation, assessed together. */
export const ADHD_SCOPE = ["adhd", "autism"] as const;

const ids = (v: { value: string[] } | string[] | undefined): string[] => (Array.isArray(v) ? v : (v?.value ?? []));

/**
 * In the ADHD cohort: everyone in the ADHDme network, plus any provider whose own declared
 * conditions include ADHD or autism. Nobody is added on a guess from their specialty.
 */
export function isAdhdSupport(d: { adhdme?: unknown; conditions: { value: string[] }; clinicalInterests?: { value: string[] } | string[] }): boolean {
  if (d.adhdme) return true;
  return [...d.conditions.value, ...ids(d.clinicalInterests)].some((c) => (ADHD_SCOPE as readonly string[]).includes(c));
}

/**
 * Whether a read sentence is about ADHD support. A sentence that asks for no condition at all
 * ("someone who listens", "a woman GP in Perth") is: in ADHDme mode every provider is an ADHD
 * provider. One that asks only for conditions outside ADHD ("endometriosis") is not.
 */
export function onTopic(conditions: readonly string[]): boolean {
  return conditions.length === 0 || conditions.some((c) => (ADHD_SCOPE as readonly string[]).includes(c));
}

/** The note an off-topic ADHDme search shows instead of results. */
export function offTopicNote(conditions: readonly string[], discipline: Discipline): string {
  const label = discipline.conditions.find((c) => c.id === conditions[0])?.label ?? "that";
  return `ADHDme only covers ADHD support, so it doesn’t list providers for ${label.toLowerCase()}. If ADHD is part of it, add that. For anything else, switch to Wattle in Profile.`;
}

/** Routes that are about something other than ADHD support, hidden in ADHDme mode. */
export const NON_ADHD_ROUTES = ["/healthspan", "/me/discover"] as const;

export function hiddenIn(mode: AppMode, path: string): boolean {
  return mode === "adhdme" && NON_ADHD_ROUTES.some((r) => path === r || path.startsWith(`${r}/`));
}
