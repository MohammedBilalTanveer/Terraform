// Per-location status for the map, derived from the linear quest. Presentation only.
import { STATIONS, type StationId } from "../worldConfig";
import type { QuestStep } from "../planData";

export type StatusKind = "explore" | "done" | "todo" | "locked";

export type StationStatus = {
  kind: StatusKind;
  /** required steps still open here */
  open: number;
  /** required steps here (done or not) */
  total: number;
  /** short chip text, e.g. "2 steps left" */
  chip: string;
  /** what is blocking this place (kind === "locked") */
  lockText: string | null;
};

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const tidyLock = (s: string | null) => (s ? lowerFirst(s.replace(/\s+first$/i, "").replace(/\.$/, "")) : null);

export function stationStatuses(steps: QuestStep[]): Record<StationId, StationStatus> {
  const out = {} as Record<StationId, StationStatus>;
  for (const st of STATIONS) {
    const req = steps.filter((s) => s.station === st.id && !s.optional);
    const open = req.filter((s) => !s.done && !s.skipped); // skipped steps are not open
    // optional steps (skipped checks, optional repeats) that can be done right now still make a place worth visiting
    const optionalNow = steps.filter((s) => s.station === st.id && s.optional && !s.done && !s.blocked && !s.skipped);
    const optionalChip = { kind: "todo" as const, open: optionalNow.length, total: optionalNow.length, chip: `${optionalNow.length} optional ${optionalNow.length === 1 ? "step" : "steps"}`, lockText: null };
    if (req.length === 0) {
      out[st.id] = optionalNow.length
        ? optionalChip
        : { kind: "explore", open: 0, total: 0, chip: "Explore", lockText: null };
    } else if (open.length === 0) {
      out[st.id] = { kind: "done", open: 0, total: req.length, chip: "Done ✓", lockText: null };
    } else if (open.every((s) => s.blocked) && optionalNow.length) {
      out[st.id] = optionalChip; // required work here is locked for now, but optional checks can be done today
    } else if (open.every((s) => s.blocked)) {
      const why = tidyLock(open[0].blockedText);
      out[st.id] = { kind: "locked", open: open.length, total: req.length, chip: why ? `Locked: ${why}` : "Locked", lockText: why };
    } else {
      out[st.id] = { kind: "todo", open: open.length, total: req.length, chip: `${open.length} step${open.length === 1 ? "" : "s"} left`, lockText: null };
    }
  }
  return out;
}
