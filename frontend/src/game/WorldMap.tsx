// Full world map: live player position, the next quest destination, every location. Tap / click a location
// (on the map or in the list) to teleport there. Presentation only — no agricultural content.
import { useEffect, useState, type KeyboardEvent } from "react";
import { Navigation, X } from "lucide-react";
import { playerState, useGame } from "./gameStore";
import { distanceTo, teleportTo } from "./teleport";
import { CHANNEL, POND, STATIONS, WORLD, type StationId } from "./worldConfig";
import { cx } from "./ui/kit";

const S = 600; // svg viewBox size
const R = WORLD.radius + 8;
const K = S / (2 * R); // world units → svg units
const toXY = (x: number, z: number) => [(x / R * 0.5 + 0.5) * S, (z / R * 0.5 + 0.5) * S] as const;

const ICON: Record<StationId, string> = {
  camp: "⛺",
  board: "📋",
  soil: "🔍",
  plot: "🌱",
  compost: "♻️",
  water: "💧",
  terraces: "⛰️",
  gully: "🏜️",
  outpost: "🏛️",
  harvest: "🌾",
  grove: "🌳",
  waterhole: "💦",
};

/** Teleport button list order: places you work at first, scenery last. */
const ORDER: StationId[] = ["camp", "board", "soil", "compost", "water", "plot", "terraces", "gully", "outpost", "harvest", "grove", "waterhole"];
const SORTED = ORDER.map((id) => STATIONS.find((s) => s.id === id)!).filter(Boolean);

export default function WorldMap({ onClose, target }: { onClose: () => void; target: StationId | null }) {
  const area = useGame((s) => s.area);
  const [pos, setPos] = useState({ x: playerState.x, z: playerState.z, rot: playerState.rot });
  const [hover, setHover] = useState<StationId | null>(null);

  // live position (timer, not rAF, so it also updates in throttled tabs)
  useEffect(() => {
    const t = window.setInterval(() => setPos({ x: playerState.x, z: playerState.z, rot: playerState.rot }), 200);
    return () => window.clearInterval(t);
  }, []);

  const [px, py] = toXY(pos.x, pos.z);
  const channel = CHANNEL.map(([x, z]) => toXY(x, z).join(",")).join(" ");
  const [pondX, pondY] = toXY(POND.x, POND.z);
  const worldR = WORLD.radius * K;
  const grid: number[] = [];
  for (let g = -60; g <= 60; g += 20) grid.push(g);

  const go = (id: StationId) => teleportTo(id);
  const onKey = (id: StationId) => (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      go(id);
    }
  };

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-40 grid place-items-center bg-[#050814]/85 p-2 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="World map"
    >
      <div
        className="tf-map flex max-h-full w-full max-w-[980px] flex-col overflow-y-auto rounded-2xl border border-cyan-300/25 bg-[#0a1124] shadow-[0_0_50px_rgba(7,11,26,0.7)] md:flex-row md:overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ---- the map ---- */}
        <div className="tf-map-body flex min-w-0 flex-1 flex-col p-3 sm:p-4">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div>
              <div className="font-display text-[11px] tracking-[0.3em] text-cyan-300/90">WORLD MAP</div>
              <div className="font-heading text-[13px] text-ivory/70">Tap a place to travel there instantly.</div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close map (Esc)"
              className="grid min-h-11 min-w-11 place-items-center rounded-lg border border-white/15 text-ivory/80 hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="relative mx-auto w-full" style={{ maxWidth: "min(640px, 72dvh)" }}>
            <svg
              viewBox={`0 0 ${S} ${S}`}
              className="tf-map-svg block h-auto w-full rounded-xl border border-white/10 bg-[#120a08]"
              style={{ aspectRatio: "1 / 1" }}
              role="img"
              aria-label="Map of the valley"
            >
              <defs>
                <radialGradient id="wm-ground" cx="50%" cy="50%" r="55%">
                  <stop offset="0%" stopColor="#b5603a" />
                  <stop offset="70%" stopColor="#8f4429" />
                  <stop offset="100%" stopColor="#6a301d" />
                </radialGradient>
                <clipPath id="wm-clip">
                  <circle cx={S / 2} cy={S / 2} r={worldR} />
                </clipPath>
              </defs>

              {/* escarpment ring + ground */}
              <circle cx={S / 2} cy={S / 2} r={worldR + 18} fill="#3a1a10" />
              <circle cx={S / 2} cy={S / 2} r={worldR + 18} fill="none" stroke="#1f0e08" strokeWidth={3} strokeDasharray="4 7" />
              <circle cx={S / 2} cy={S / 2} r={worldR} fill="url(#wm-ground)" />
              <g clipPath="url(#wm-clip)">
                {grid.map((g) => {
                  const [gx] = toXY(g, 0);
                  const [, gy] = toXY(0, g);
                  return (
                    <g key={g} stroke="#fff" strokeOpacity={0.06}>
                      <line x1={gx} y1={0} x2={gx} y2={S} />
                      <line x1={0} y1={gy} x2={S} y2={gy} />
                    </g>
                  );
                })}
                <polyline points={channel} fill="none" stroke="#4a1c10" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" opacity={0.75} />
                <polyline points={channel} fill="none" stroke="#7a3320" strokeWidth={3} strokeLinecap="round" strokeDasharray="2 9" />
                <ellipse cx={pondX} cy={pondY} rx={POND.r * K * 1.15} ry={POND.r * K} fill="#3f8fb5" stroke="#9fd8ee" strokeWidth={2} opacity={0.9} />
                {SORTED.map((s) => {
                  const [x, y] = toXY(s.pos[0], s.pos[1]);
                  return <circle key={s.id} cx={x} cy={y} r={s.areaR * K} fill={s.color} fillOpacity={0.11} />;
                })}
              </g>
              <text x={S / 2} y={22} textAnchor="middle" fontSize={17} fill="#ffd9c4" fontFamily="Orbitron, sans-serif" letterSpacing={3}>N</text>
              <path d={`M${S / 2},28 l-6,10 h12 z`} fill="#ffd9c4" />
              <text x={S / 2} y={S - 8} textAnchor="middle" fontSize={11} fill="#c79a85" opacity={0.7} fontFamily="Orbitron, sans-serif" letterSpacing={4}>ESCARPMENT</text>

              {/* locations */}
              {SORTED.map((s) => {
                const [x, y] = toXY(s.pos[0], s.pos[1]);
                const isT = s.id === target;
                const isHere = s.id === area;
                const active = hover === s.id;
                const showLabel = isT || isHere || active;
                const anchor = x < 110 ? "start" : x > S - 110 ? "end" : "middle";
                const lx = anchor === "start" ? x - 14 : anchor === "end" ? x + 14 : x;
                return (
                  <g
                    key={s.id}
                    className="tf-mk cursor-pointer outline-none"
                    role="button"
                    tabIndex={0}
                    aria-label={`Travel to ${s.name}`}
                    onClick={() => go(s.id)}
                    onKeyDown={onKey(s.id)}
                    onPointerEnter={() => setHover(s.id)}
                    onPointerLeave={() => setHover(null)}
                    onFocus={() => setHover(s.id)}
                    onBlur={() => setHover(null)}
                  >
                    <circle cx={x} cy={y} r={28} fill="transparent" />
                    {isT && <circle cx={x} cy={y} r={24} fill="none" stroke="#38e1ff" strokeWidth={3} className="animate-pulse" />}
                    <circle
                      cx={x}
                      cy={y}
                      r={s.interactive ? 16 : 13}
                      fill={s.color}
                      stroke={active ? "#ffffff" : "#070b1a"}
                      strokeWidth={active ? 3.5 : 2.5}
                    />
                    <text x={x} y={y + 6} textAnchor="middle" fontSize={s.interactive ? 17 : 14} style={{ pointerEvents: "none" }}>
                      {ICON[s.id]}
                    </text>
                    <g className={cx(showLabel ? "" : "max-md:hidden")} style={{ pointerEvents: "none" }}>
                      <text
                        x={lx}
                        y={y + 36}
                        textAnchor={anchor}
                        fontSize={15}
                        fontFamily="Space Grotesk, Inter, sans-serif"
                        fontWeight={600}
                        fill="#fff"
                        stroke="#120a08"
                        strokeWidth={4}
                        paintOrder="stroke"
                      >
                        {s.name.replace("Unknown Land — Cultivation Plot", "Unknown Land")}
                      </text>
                    </g>
                  </g>
                );
              })}

              {/* the player */}
              <g transform={`translate(${px} ${py}) rotate(${180 - (pos.rot * 180) / Math.PI})`} style={{ pointerEvents: "none" }}>
                <circle r={17} fill="#f4efe6" fillOpacity={0.18} className="animate-pulse" />
                <path d="M0,-13 L9,10 L0,5 L-9,10 Z" fill="#f4efe6" stroke="#070b1a" strokeWidth={2} strokeLinejoin="round" />
              </g>
            </svg>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ivory/65">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rotate-0 rounded-sm bg-[#f4efe6]" style={{ clipPath: "polygon(50% 0, 100% 100%, 50% 75%, 0 100%)" }} /> You
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 animate-pulse rounded-full border-2 border-cyan-300" /> Next quest step
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-1 w-4 rounded bg-[#4a1c10]" /> Dry runoff channel
            </span>
          </div>
        </div>

        {/* ---- the list (always usable by touch: 44px+ rows) ---- */}
        <aside className="tf-map-list flex shrink-0 flex-col border-t border-white/10 md:w-[300px] md:border-l md:border-t-0">
          <div className="px-3 pb-1 pt-3 font-display text-[10px] tracking-[0.28em] text-amber-200/90">LOCATIONS</div>
          <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 pb-3 md:overflow-y-auto">
            {SORTED.map((s) => {
              const d = Math.round(distanceTo(s.id));
              const isT = s.id === target;
              const here = s.id === area;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => go(s.id)}
                    onPointerEnter={() => setHover(s.id)}
                    onPointerLeave={() => setHover(null)}
                    className={cx(
                      "flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors",
                      isT ? "border-cyan-300/60 bg-cyan-400/10" : "border-white/10 bg-white/[0.03] hover:border-white/30 hover:bg-white/[0.07]",
                      hover === s.id && "border-white/40 bg-white/[0.08]",
                    )}
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[18px]" style={{ background: s.color + "55", boxShadow: `inset 0 0 0 2px ${s.color}` }}>
                      {ICON[s.id]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-heading text-[13.5px] font-semibold text-ivory">{s.name}</span>
                      <span className="block truncate text-[11.5px] text-ivory/55">{s.interactive ? s.verb : "Scenic spot"}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      {here ? (
                        <span className="block text-[10.5px] font-semibold text-emerald-300">● you’re here</span>
                      ) : (
                        <span className="block text-[11px] text-ivory/50">{d} m</span>
                      )}
                      {isT && (
                        <span className="mt-0.5 inline-flex items-center gap-1 text-[10.5px] font-semibold text-cyan-200">
                          <Navigation className="h-3 w-3" /> next
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
      </div>
    </div>
  );
}

/** Short fade that hides the jump when the player is teleported. */
export function TeleportVeil() {
  const t = useGame((s) => s.teleportFx);
  if (!t) return null;
  return <div key={t} className="tf-teleport-veil pointer-events-none absolute inset-0 z-[55]" aria-hidden />;
}
