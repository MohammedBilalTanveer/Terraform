// What each map location is FOR. Navigation/game copy only — no agricultural advice (advice always comes from the KB plan).
// Every location must give the player something to do or learn; the map, the quest and the panels all read this.
import type { CheckWhere } from "../types/terraform";
import type { StationId } from "./worldConfig";

export type PlaceInfo = {
  /** 3–5 word label for lists and tooltips */
  short: string;
  /** one or two sentences: why would I go here? */
  why: string;
  /** which diagnostic-check `where` values are done here */
  checks: CheckWhere[];
};

export const PLACE_INFO: Record<StationId, PlaceInfo> = {
  camp: {
    short: "Rest, ask TERRA, talk to locals",
    why: "Your base. Ask TERRA anything (answers come only from the knowledge base), note what neighbours say grows here, and take stock of what you have.",
    checks: ["neighbours"],
  },
  board: {
    short: "Log what you see",
    why: "Describe the land in your own words, add a photo if you like. TERRA repeats back only what you said and what is still unknown.",
    checks: [],
  },
  soil: {
    short: "Hands-on soil tests",
    why: "Tests with a stick, a stone and household items: how deep the hard layer goes, rock lumps, and the baking-soda (sodium bicarbonate) fizz test.",
    checks: ["ground"],
  },
  plot: {
    short: "Your cultivation plot",
    why: "Where it all comes together: readiness tests, choosing a crop, testing your seeds, planting, and caring for the crop through every growth stage.",
    checks: ["seeds", "trial_plot"],
  },
  compost: {
    short: "Build soil: compost & mulch",
    why: "Gather and mix the organic matter that gives thin, poor soil something to grow in, and the mulch that keeps it covered.",
    checks: [],
  },
  water: {
    short: "Store rainwater",
    why: "Set up covered containers and water capture so the short rainy season's water is not all lost to runoff.",
    checks: [],
  },
  terraces: {
    short: "Stone lines slow the runoff",
    why: "Lay stone lines and catchments across the slope so rain slows down, spreads and soaks in instead of rushing off.",
    checks: [],
  },
  gully: {
    short: "Watch where the rain runs",
    why: "A dry runoff channel. Watch where water rushes, spreads or pools — it decides where stone lines, beds and overflow paths should go.",
    checks: ["runoff_path"],
  },
  outpost: {
    short: "Field terminal & supplies",
    why: "Your plan at a glance, plus a supplies check: what you have on hand decides which options the plan uses.",
    checks: ["supplies"],
  },
  harvest: {
    short: "Harvest & rebuild the soil",
    why: "When the crop is ready: ripeness signs, harvesting, storing, and the steps that rebuild the land for next season.",
    checks: [],
  },
  grove: {
    short: "Lookout over the valley",
    why: "A lookout above the old cashew trees. Observe what grows here, and study the long-term tree options and what they need to succeed on this land.",
    checks: ["vegetation"],
  },
  waterhole: {
    short: "Hand-deep drainage test",
    why: "A shallow natural hollow. Try the hand-deep water-hole test to see how quickly water drains away, and learn how this land holds water.",
    checks: ["water_hole"],
  },
};

/** `where` → location (used by the quest and the panels) */
export const CHECK_PLACE: Record<CheckWhere, StationId> = {
  ground: "soil",
  water_hole: "waterhole",
  runoff_path: "gully",
  vegetation: "grove",
  neighbours: "camp",
  supplies: "outpost",
  seeds: "plot",
  trial_plot: "plot",
};
