// Rerank the Layer-1 survivors of a request with the person's "what matters most" choices.
// Pure over the roster and vocabulary it is handed: POST /adjust/rerank feeds it the server
// roster, the static build feeds it src/generated/roster.json in the browser. Without survivors
// in the body the request is matched first (same call as the search) and the survivors
// returned so the next adjustment needs no search.
import { match, rerank, shown, type HumanFitWeights } from "@/src/matching";
import type { Intent, Ranked } from "@/src/matching/types";
import type { Discipline } from "@/src/disciplines/load";
import { resolveSuburb } from "./places";
import { toCard } from "./search-core";
import type { Card, SearchResponse } from "./search-types";
import type { DoctorRecord } from "./types";

export interface RerankEdits {
  /** Drop survivors further than this with no telehealth. */
  maxKm?: number;
  telehealthOnly?: boolean;
  anyGender?: boolean;
  /** Closed human-fit labels to add to the intent (yaml `human_fit` ids). */
  humanFit?: string[];
}

export interface RerankBody {
  ask?: { sentence: string; suburb: string; removed: string[] };
  survivors?: Ranked[];
  intent?: Intent;
  weights?: Partial<HumanFitWeights>;
  edits?: RerankEdits;
  chips?: SearchResponse["chips"];
}

export interface RerankOut {
  response: SearchResponse;
  survivors: Ranked[];
  intent: Intent;
}

export class RerankBadRequest extends Error {}

export function rerankWith(doctors: readonly DoctorRecord[], discipline: Discipline, body: RerankBody): RerankOut {
  const byId = new Map(doctors.map((d) => [d.id, d]));

  let survivors: Ranked[] | undefined = Array.isArray(body.survivors) ? body.survivors : undefined;
  let intent: Intent | undefined = body.intent;
  let orderNote = "";
  let order: SearchResponse["order"] = "informed";
  let placeOut: SearchResponse["place"] = { typed: body.ask?.suburb ?? "", suburb: null };

  if (!survivors || !intent) {
    if (!body.ask || typeof body.ask.sentence !== "string" || !body.ask.sentence.trim()) {
      throw new RerankBadRequest("ask or survivors required");
    }
    const typed = (body.ask.suburb ?? "").trim();
    const place = typed ? resolveSuburb(typed, doctors) : null;
    const result = match(body.ask.sentence.slice(0, 1200), place, doctors, { discipline, weights: body.weights ?? {} });
    survivors = result.survivors;
    intent = result.intent ?? { conditions: [], constraints: {}, manner: [], urgency: "routine", referralInHand: false, refused: [] };
    orderNote = result.orderNote;
    order = result.order;
    placeOut = { typed, suburb: place?.suburb ?? null };
  }

  // Intent edits: extra human-fit labels, and the practical constraints.
  const edits = body.edits ?? {};
  const humanFit = [...new Set([...(intent.humanFit ?? []), ...(edits.humanFit ?? [])])];
  const constraints = { ...intent.constraints };
  if (edits.maxKm) constraints.maxKm = edits.maxKm;
  if (edits.telehealthOnly) constraints.telehealth = "only";
  if (edits.anyGender) delete constraints.gender;
  const edited: Intent = { ...intent, humanFit, constraints };

  // Practical filters on the survivors themselves (Layer 1 already ran; these only narrow).
  let kept = survivors;
  if (edits.maxKm) kept = kept.filter((r) => r.distanceKm === undefined || r.distanceKm <= edits.maxKm! || r.doctor.telehealth.value !== "none");
  if (edits.telehealthOnly) kept = kept.filter((r) => r.doctor.telehealth.value !== "none");

  const weights: Partial<HumanFitWeights> = body.weights ?? {};
  const reranked = rerank(kept, edited, weights, discipline);
  const labels = Object.fromEntries(discipline.conditions.map((c) => [c.id, c.label]));
  const cards = shown(reranked).map((r) => toCard(r, byId, edited, labels)).filter((c): c is Card => c !== null);

  const response: SearchResponse = {
    order: cards.length === 0 ? "unserved" : order,
    orderNote: cards.length === 0 ? "Nobody left after those choices. Loosen one to see doctors again." : orderNote || "Reordered by what matters most to you.",
    cards,
    chips: body.chips ?? [],
    clarifiers: [],
    place: placeOut,
    rosterSize: doctors.length,
  };
  return { response, survivors: reranked, intent: edited };
}
