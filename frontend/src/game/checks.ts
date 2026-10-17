// No-lab diagnostic checks as game data. The KB/API supply `phase` and `where` (v1.5); until they land we
// fall back to id keywords. Only routing lives here — every word the player reads comes from the check record.
import type { AnalysisResponse, CheckCard, CheckPhase, CheckWhere, PlanResponse } from "../types/terraform";
import { CHECK_PLACE } from "./places";
import type { StationId } from "./worldConfig";

export function checkWhere(c: CheckCard): CheckWhere {
  if (c.where) return c.where;
  const k = c.id.toLowerCase();
  if (/seed|sprout|float/.test(k)) return "seeds";
  if (/trial|hunger|leaf|watch_trial/.test(k)) return "trial_plot";
  if (/water_hole|drain/.test(k)) return "water_hole";
  if (/soaking/.test(k)) return "ground";
  if (/rain|runoff|pool|pour|slope/.test(k)) return "runoff_path";
  if (/vegetation/.test(k)) return "vegetation";
  if (/neighbour|neighbor|local|ask/.test(k)) return "neighbours";
  if (/inventory|resource|supplies/.test(k)) return "supplies";
  return "ground"; // probe / rock / fizz / baking / everything else
}

export function checkPhase(c: CheckCard): CheckPhase {
  if (c.phase) return c.phase;
  const w = checkWhere(c);
  if (w === "seeds") return "pre_plant";
  if (w === "trial_plot") return "post_sow";
  return "diagnose";
}

export const checkStation = (c: CheckCard): StationId => CHECK_PLACE[checkWhere(c)];

// The API only lists the checks that are relevant to the currently UNRESOLVED unknowns, so the list shrinks as the player
// answers. The quest must stay stable, so every check ever seen in this session is remembered (first-seen order).
const seenChecks: { session: string | null; byId: Map<string, CheckCard> } = { session: null, byId: new Map() };

/** Every applicable check (all phases), deduped and stable. Plan checks win; analysis checks fill the gaps. */
export function collectChecks(analysis: AnalysisResponse | null, plan: PlanResponse | null): CheckCard[] {
  const sid = analysis?.session_id ?? plan?.session_id ?? null;
  if (seenChecks.session !== sid) {
    seenChecks.session = sid;
    seenChecks.byId = new Map();
  }
  for (const c of [...(plan?.workflow.checks ?? []), ...(analysis?.missing_analysis.checks ?? [])]) {
    const old = seenChecks.byId.get(c.id);
    // keep the first-seen position, but prefer the newest card (it may carry phase/where/user_outcome)
    seenChecks.byId.set(c.id, old && !(plan?.workflow.checks ?? []).some((x) => x.id === c.id) ? { ...c, ...old, user_outcome: c.user_outcome } : c);
  }
  return [...seenChecks.byId.values()];
}

// Visit order on the map: camp → soil → gully → waterhole → grove → outpost (keeps the KB order inside a place)
const PLACE_ORDER: StationId[] = ["camp", "soil", "gully", "waterhole", "grove", "outpost", "plot"];
export function sortChecks(list: CheckCard[]): CheckCard[] {
  return list
    .map((c, i) => ({ c, i }))
    .sort((a, b) => PLACE_ORDER.indexOf(checkStation(a.c)) - PLACE_ORDER.indexOf(checkStation(b.c)) || a.i - b.i)
    .map((x) => x.c);
}

export type CheckState = { outcome: string | null; unable: boolean; done: boolean };
export function checkState(c: CheckCard, outcomes: { check_id: string; outcome_id: string }[], unable: string[]): CheckState {
  const outcome = outcomes.find((o) => o.check_id === c.id)?.outcome_id ?? c.user_outcome ?? null;
  const un = unable.includes(c.id);
  return { outcome, unable: un, done: !!outcome || un };
}
