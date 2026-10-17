// Lucide icon for each map location + short chip names.
import { ClipboardList, Droplet, Droplets, FlaskConical, Layers, Radio, Recycle, Sprout, Tent, TreePine, Waves, Wheat, type LucideIcon } from "lucide-react";
import type { StationId } from "../worldConfig";

export const PIN_ICON: Record<StationId, LucideIcon> = {
  camp: Tent,
  board: ClipboardList,
  soil: FlaskConical,
  plot: Sprout,
  compost: Recycle,
  water: Droplets,
  terraces: Layers,
  gully: Waves,
  outpost: Radio,
  harvest: Wheat,
  grove: TreePine,
  waterhole: Droplet,
};

/** compact chip names for the map (hover / focus / next / here use the full name) */
export const SHORT_NAME: Record<StationId, string> = {
  camp: "Survivor Camp",
  board: "Observation Board",
  soil: "Soil Inspection",
  plot: "Unknown Land",
  compost: "Compost & Mulch",
  water: "Water Storage",
  terraces: "Stone-Line Terraces",
  gully: "Runoff Gully",
  outpost: "Research Outpost",
  harvest: "Harvest Point",
  grove: "Cashew Grove",
  waterhole: "Waterhole",
};

/** list order: places you work at first, scenery last */
export const ORDER: StationId[] = ["camp", "board", "soil", "compost", "water", "plot", "terraces", "gully", "outpost", "harvest", "grove", "waterhole"];

export const fullName = (name: string) => name.replace("Unknown Land — Cultivation Plot", "Unknown Land");
