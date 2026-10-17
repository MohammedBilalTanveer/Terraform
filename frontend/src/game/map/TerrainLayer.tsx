// The static art layer of the world map (metre coordinates, y = world z). Memoised: it only re-renders when the
// baked terrain bitmap arrives. No filters — the relief/contours/grain live in the baked bitmap.
import { memo, useMemo } from "react";
import { STATIONS, TERRACE_LINES, WORLD, stationById } from "../worldConfig";
import { EXTENT, POND, buildDecor, buildTrails, channelPath } from "./mapGeo";

const grid: number[] = [];
for (let g = -80; g <= 80; g += 10) grid.push(g);

function Tent({ x, z }: { x: number; z: number }) {
  return (
    <g transform={`translate(${x} ${z + 0.6})`}>
      <ellipse cx={0.4} cy={1.9} rx={3.4} ry={0.9} fill="#1a0a06" opacity={0.35} />
      <path d="M-2.4,1.7 L0,-2.2 L2.4,1.7 Z" fill="#e9dcc3" stroke="#4a2a18" strokeWidth={0.14} strokeLinejoin="round" />
      <path d="M0,-2.2 L0.9,1.7 L-0.9,1.7 Z" fill="#8a5a3a" />
      <path d="M0,-2.2 L2.4,1.7 L0.9,1.7 Z" fill="#000" opacity={0.12} />
      {/* campfire + log seats */}
      <circle cx={4.2} cy={1.2} r={1.6} fill="#f6a23a" opacity={0.22} />
      <circle cx={4.2} cy={1.2} r={0.55} fill="#ffd27a" />
      <circle cx={4.2} cy={1.2} r={1.05} fill="none" stroke="#3a2012" strokeWidth={0.2} strokeDasharray="0.45 0.35" />
      <rect x={2.4} y={2.7} width={1.8} height={0.5} rx={0.25} fill="#5a3a22" />
      <rect x={4.8} y={2.7} width={1.8} height={0.5} rx={0.25} fill="#5a3a22" />
    </g>
  );
}

function Board({ x, z }: { x: number; z: number }) {
  return (
    <g transform={`translate(${x} ${z + 0.3})`}>
      <ellipse cx={0} cy={1.2} rx={1.6} ry={0.5} fill="#1a0a06" opacity={0.35} />
      <rect x={-1.1} y={-0.2} width={0.22} height={1.4} fill="#4a2a18" />
      <rect x={0.9} y={-0.2} width={0.22} height={1.4} fill="#4a2a18" />
      <rect x={-1.5} y={-1.2} width={3} height={1.7} rx={0.2} fill="#7a4a2c" stroke="#2a140a" strokeWidth={0.1} />
      <rect x={-1.15} y={-0.9} width={1} height={0.5} fill="#f1e6cf" />
      <rect x={0.05} y={-0.95} width={1} height={0.6} fill="#f1e6cf" />
      <rect x={-1.1} y={-0.25} width={2.2} height={0.18} fill="#f1e6cf" opacity={0.7} />
    </g>
  );
}

function Soil({ x, z }: { x: number; z: number }) {
  return (
    <g transform={`translate(${x} ${z + 0.2})`}>
      {[
        [-2.6, 0.8, 1.15],
        [0, 1.6, 1.0],
        [2.5, 0.5, 1.25],
      ].map(([dx, dz, r], i) => (
        <g key={i}>
          <circle cx={dx} cy={dz} r={r} fill="#3d1d12" opacity={0.7} />
          <circle cx={dx} cy={dz} r={r} fill="none" stroke="#e8c9a4" strokeWidth={0.16} strokeDasharray="0.5 0.4" />
        </g>
      ))}
      <path d="M2.5,0.5 L3.9,-1.3" stroke="#b78a58" strokeWidth={0.2} strokeLinecap="round" />
      <circle cx={-0.4} cy={-1.1} r={0.45} fill="#e8d7bc" stroke="#4a2a18" strokeWidth={0.1} />
    </g>
  );
}

function Plot({ x, z }: { x: number; z: number }) {
  const w = 9.2;
  const h = 6.4;
  const lines: number[] = [];
  for (let i = 1; i < 10; i++) lines.push(-w / 2 + (w / 10) * i);
  return (
    <g transform={`translate(${x} ${z + 0.8})`}>
      <rect x={-w / 2 - 0.5} y={-h / 2 - 0.5} width={w + 1} height={h + 1} rx={0.9} fill="#1a0a06" opacity={0.3} transform="translate(0.3 0.4)" />
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={0.6} fill="#4a2517" opacity={0.92} />
      {lines.map((lx) => (
        <line key={lx} x1={lx} y1={-h / 2 + 0.4} x2={lx} y2={h / 2 - 0.4} stroke="#9a5a3c" strokeWidth={0.34} strokeLinecap="round" />
      ))}
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={0.6} fill="none" stroke="#e6d6b6" strokeWidth={0.34} strokeDasharray="0.9 0.5" strokeLinecap="round" />
    </g>
  );
}

function Compost({ x, z }: { x: number; z: number }) {
  return (
    <g transform={`translate(${x} ${z + 0.6})`}>
      {[
        [-1.6, 0.4, 1.7],
        [1.2, 0.9, 1.3],
        [0.2, -1.2, 1.05],
      ].map(([dx, dz, r], i) => (
        <g key={i}>
          <circle cx={dx + 0.2} cy={dz + 0.3} r={r} fill="#1a0a06" opacity={0.3} />
          <circle cx={dx} cy={dz} r={r} fill="#4a2b18" stroke="#9a6a40" strokeWidth={0.14} />
          <circle cx={dx - r * 0.25} cy={dz - r * 0.3} r={r * 0.4} fill="#7a4e2e" opacity={0.8} />
        </g>
      ))}
    </g>
  );
}

function Water({ x, z }: { x: number; z: number }) {
  return (
    <g transform={`translate(${x} ${z + 0.5})`}>
      {[
        [-1.8, 0, 1.7],
        [1.7, 0.8, 1.35],
      ].map(([dx, dz, r], i) => (
        <g key={i}>
          <ellipse cx={dx + 0.3} cy={dz + 0.5} rx={r} ry={r * 0.9} fill="#1a0a06" opacity={0.3} />
          <circle cx={dx} cy={dz} r={r} fill="#2c6f94" stroke="#bfe6f2" strokeWidth={0.18} />
          <circle cx={dx} cy={dz} r={r * 0.62} fill="none" stroke="#bfe6f2" strokeWidth={0.1} opacity={0.6} />
          <circle cx={dx - r * 0.3} cy={dz - r * 0.3} r={r * 0.22} fill="#fff" opacity={0.35} />
        </g>
      ))}
      <path d="M-0.2,0.2 q1,0.4 1.1,0.9" stroke="#bfe6f2" strokeWidth={0.2} fill="none" strokeLinecap="round" />
    </g>
  );
}

function Harvest({ x, z }: { x: number; z: number }) {
  return (
    <g transform={`translate(${x} ${z + 0.6})`}>
      {[-2.4, -0.8, 0.8].map((dx) => (
        <g key={dx}>
          <rect x={dx} y={-0.5} width={1.3} height={2.6} rx={0.2} fill="#8a5a28" opacity={0.85} />
          {[0, 0.5, 1, 1.5].map((dz) => (
            <line key={dz} x1={dx + 0.2} y1={dz} x2={dx + 1.1} y2={dz} stroke="#f6d27a" strokeWidth={0.2} strokeLinecap="round" />
          ))}
        </g>
      ))}
      <rect x={2.4} y={0.6} width={1.5} height={1.3} rx={0.15} fill="#a9794a" stroke="#4a2a18" strokeWidth={0.1} />
      <rect x={2.8} y={-0.5} width={1.3} height={1.1} rx={0.15} fill="#b98a58" stroke="#4a2a18" strokeWidth={0.1} />
    </g>
  );
}

function Outpost({ x, z }: { x: number; z: number }) {
  return (
    <g transform={`translate(${x} ${z + 1})`}>
      <rect x={-6} y={-3.4} width={12} height={8} rx={0.5} fill="none" stroke="#c9b9a0" strokeWidth={0.2} strokeDasharray="0.7 0.5" opacity={0.65} />
      <rect x={-4.6} y={-1.4} width={5.4} height={3.4} rx={0.25} fill="#1a0a06" opacity={0.3} transform="translate(0.4 0.5)" />
      <rect x={-4.6} y={-1.4} width={5.4} height={3.4} rx={0.25} fill="#4a5a7a" stroke="#1f2a44" strokeWidth={0.14} />
      <path d="M-4.6,-1.4 L0.8,-1.4 L0.8,-0.2 L-4.6,-0.2 Z" fill="#6d7fa6" />
      <rect x={-3.4} y={0.5} width={1} height={1.5} fill="#e9c27a" />
      <rect x={2} y={-0.6} width={3} height={2.6} rx={0.25} fill="#5a4a7a" stroke="#2a2044" strokeWidth={0.14} />
      <rect x={2.5} y={0.4} width={0.9} height={0.9} fill="#e9c27a" />
      <line x1={-1.2} y1={-1.4} x2={-1.2} y2={-3.1} stroke="#c9d6f0" strokeWidth={0.18} />
      <circle cx={-1.2} cy={-3.2} r={0.34} fill="#8b5cf6" />
      <circle cx={-1.2} cy={-3.2} r={0.9} fill="none" stroke="#b9a2fa" strokeWidth={0.12} opacity={0.7} />
      <circle cx={3.9} cy={-1.6} r={0.95} fill="#cfd6e6" stroke="#4a5a7a" strokeWidth={0.14} />
      <circle cx={3.9} cy={-1.6} r={0.3} fill="#4a5a7a" />
    </g>
  );
}

function Grove({ x, z }: { x: number; z: number }) {
  const trees = [
    [-3.4, -1.8, 2.2],
    [0.4, -3, 2.5],
    [3.6, -1, 2],
    [-2, 1.6, 1.9],
    [1.8, 1.9, 2.3],
    [-5, 1, 1.5],
    [5, 2.4, 1.6],
  ];
  return (
    <g transform={`translate(${x} ${z})`}>
      {trees.map(([dx, dz, r], i) => (
        <g key={i}>
          <ellipse cx={dx + 0.5} cy={dz + 0.7} rx={r} ry={r * 0.85} fill="#1a0a06" opacity={0.3} />
          <circle cx={dx} cy={dz} r={r} fill={i % 2 ? "#5a6a38" : "#4a5a30"} stroke="#2a3418" strokeWidth={0.14} />
          <circle cx={dx - r * 0.28} cy={dz - r * 0.3} r={r * 0.55} fill="#7a8a4a" opacity={0.75} />
          <circle cx={dx} cy={dz} r={0.2} fill="#3a2012" />
        </g>
      ))}
    </g>
  );
}

function TerrainLayerImpl({ imageUrl }: { imageUrl: string | null }) {
  const decor = useMemo(buildDecor, []);
  const trails = useMemo(buildTrails, []);
  const chan = useMemo(channelPath, []);
  const R = WORLD.radius;
  const terr = stationById("terraces").pos;
  const pos = (id: string) => STATIONS.find((s) => s.id === id)!.pos;
  return (
    <g>
      <defs>
        <radialGradient id="wm-ground" cx="50%" cy="46%" r="60%">
          <stop offset="0%" stopColor="#bb6b47" />
          <stop offset="70%" stopColor="#97492d" />
          <stop offset="100%" stopColor="#6a301d" />
        </radialGradient>
        <radialGradient id="wm-water" cx="40%" cy="38%" r="70%">
          <stop offset="0%" stopColor="#9fe0f5" />
          <stop offset="55%" stopColor="#4aa6cf" />
          <stop offset="100%" stopColor="#2a6f99" />
        </radialGradient>
        {STATIONS.map((s) => (
          <radialGradient key={s.id} id={`wm-area-${s.id}`}>
            <stop offset="0%" stopColor={s.color} stopOpacity={0.3} />
            <stop offset="70%" stopColor={s.color} stopOpacity={0.12} />
            <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
          </radialGradient>
        ))}
      </defs>
      <rect x={-EXTENT} y={-EXTENT} width={EXTENT * 2} height={EXTENT * 2} fill="#0b1226" />
      {imageUrl ? (
        <image href={imageUrl} x={-EXTENT} y={-EXTENT} width={EXTENT * 2} height={EXTENT * 2} preserveAspectRatio="none" />
      ) : (
        <circle r={R + 6} fill="url(#wm-ground)" />
      )}

      {/* grid */}
      <g className="tf-wm-ns" stroke="#fff" strokeWidth={1} fill="none">
        {grid.map((g) => (
          <g key={g} strokeOpacity={g % 20 === 0 ? 0.1 : 0.045}>
            <line x1={g} y1={-EXTENT} x2={g} y2={EXTENT} />
            <line x1={-EXTENT} y1={g} x2={EXTENT} y2={g} />
          </g>
        ))}
      </g>

      {/* escarpment: hatching + rim */}
      <path d={decor.hatch} fill="none" stroke="#24100a" strokeOpacity={0.5} strokeWidth={0.2} strokeLinecap="round" />
      <path d={decor.rim} fill="none" stroke="#1a0a06" strokeOpacity={0.75} strokeWidth={0.45} strokeLinejoin="round" />
      <path d={decor.rimInner} fill="none" stroke="#f2c29c" strokeOpacity={0.35} strokeWidth={0.3} strokeDasharray="1.2 0.9" strokeLinejoin="round" />

      {/* station service areas */}
      {STATIONS.map((s) => (
        <g key={s.id}>
          <circle cx={s.pos[0]} cy={s.pos[1]} r={s.areaR} fill={`url(#wm-area-${s.id})`} />
          <circle className="tf-wm-ns" cx={s.pos[0]} cy={s.pos[1]} r={s.areaR} fill="none" stroke={s.color} strokeOpacity={0.4} strokeWidth={1} strokeDasharray="2 6" />
        </g>
      ))}

      {/* trails (faint dotted) */}
      <g className="tf-wm-ns" fill="none" strokeLinecap="round">
        {trails.map((t) => (
          <g key={t.a + t.b}>
            <path d={t.d} stroke="#2a120a" strokeOpacity={0.35} strokeWidth={4} />
            <path d={t.d} stroke="#f3dcbc" strokeOpacity={0.7} strokeWidth={2} strokeDasharray="0.1 7" />
          </g>
        ))}
      </g>

      {/* stone-line arcs at the terraces */}
      <g transform={`translate(${terr[0]} ${terr[1]})`} fill="none" strokeLinecap="round">
        {TERRACE_LINES.map((l, i) => {
          const d = `M${-l.half - 0.8},${l.z + 0.4} Q0,${l.z - 1.9} ${l.half + 0.8},${l.z + 0.4}`;
          return (
            <g key={i}>
              <path d={d} stroke="#1a0a06" strokeOpacity={0.4} strokeWidth={1.1} strokeDasharray="1 0.55" transform="translate(0.25 0.35)" />
              <path d={d} stroke="#ead9b8" strokeWidth={0.95} strokeDasharray="1 0.55" />
            </g>
          );
        })}
      </g>

      {/* dry runoff channel (ribbon + flowing dashes) */}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={chan} stroke="#2b1008" strokeOpacity={0.45} strokeWidth={5.6} />
        <path d={chan} stroke="#7a3a22" strokeOpacity={0.85} strokeWidth={3.5} />
        <path d={chan} stroke="#d9a272" strokeOpacity={0.5} strokeWidth={1.9} />
        <path className="tf-wm-flow" d={chan} stroke="#bfe6f2" strokeOpacity={0.8} strokeWidth={0.36} strokeDasharray="0.9 2.2" />
      </g>

      {/* waterhole */}
      <g transform={`translate(${POND.x} ${POND.z})`}>
        <ellipse rx={POND.r * 1.15 + 1.5} ry={POND.r + 1.4} fill="#d6a574" opacity={0.7} />
        <ellipse rx={POND.r * 1.15 + 0.5} ry={POND.r + 0.4} fill="#6b4a38" opacity={0.7} />
        <ellipse rx={POND.r * 1.15} ry={POND.r} fill="url(#wm-water)" stroke="#d4f1fb" strokeWidth={0.28} />
        <ellipse className="tf-wm-ripple" rx={POND.r * 0.7} ry={POND.r * 0.6} fill="none" stroke="#fff" strokeWidth={1} style={{ animationDelay: "0s" }} />
        <ellipse className="tf-wm-ripple" rx={POND.r * 0.7} ry={POND.r * 0.6} fill="none" stroke="#fff" strokeWidth={1} style={{ animationDelay: "1.4s" }} />
        <path d={`M${-POND.r * 0.6},${-POND.r * 0.3} q${POND.r * 0.4},${-POND.r * 0.35} ${POND.r * 0.9},${-POND.r * 0.2}`} fill="none" stroke="#fff" strokeOpacity={0.55} strokeWidth={0.35} strokeLinecap="round" />
      </g>

      {/* stones, tufts, thorn shrubs */}
      <g>
        {decor.stones.map((s, i) => (
          <g key={i} transform={`translate(${s.x} ${s.y}) rotate(${s.rot})`}>
            <ellipse cx={0.12} cy={0.14} rx={s.rx} ry={s.ry} fill="#1a0a06" opacity={0.35} />
            <ellipse rx={s.rx} ry={s.ry} fill={s.t > 0.5 ? "#c99a78" : "#b27c5c"} stroke="#4a2415" strokeWidth={0.08} />
            <ellipse cx={-s.rx * 0.25} cy={-s.ry * 0.25} rx={s.rx * 0.45} ry={s.ry * 0.4} fill="#fff" opacity={0.18} />
          </g>
        ))}
      </g>
      <path d={decor.tuftShadow} stroke="#2a120a" strokeOpacity={0.22} strokeWidth={0.2} strokeLinecap="round" fill="none" />
      <path d={decor.tufts} stroke="#e3c677" strokeOpacity={0.85} strokeWidth={0.13} strokeLinecap="round" fill="none" />
      {decor.shrubs.map((s, i) => (
        <g key={i}>
          <path d={s.thorns} stroke="#3a2a14" strokeWidth={0.1} strokeLinecap="round" />
          <circle cx={s.x + 0.1} cy={s.y + 0.16} r={s.r} fill="#1a0a06" opacity={0.3} />
          <circle cx={s.x} cy={s.y} r={s.r} fill="#6a6232" stroke="#2a2410" strokeWidth={0.1} />
          <circle cx={s.x - s.r * 0.3} cy={s.y - s.r * 0.3} r={s.r * 0.45} fill="#8d8444" opacity={0.7} />
        </g>
      ))}

      {/* station props */}
      <Tent x={pos("camp")[0]} z={pos("camp")[1]} />
      <Board x={pos("board")[0]} z={pos("board")[1]} />
      <Soil x={pos("soil")[0]} z={pos("soil")[1]} />
      <Plot x={pos("plot")[0]} z={pos("plot")[1]} />
      <Compost x={pos("compost")[0]} z={pos("compost")[1]} />
      <Water x={pos("water")[0]} z={pos("water")[1]} />
      <Harvest x={pos("harvest")[0]} z={pos("harvest")[1]} />
      <Outpost x={pos("outpost")[0]} z={pos("outpost")[1]} />
      <Grove x={pos("grove")[0]} z={pos("grove")[1]} />
    </g>
  );
}

export const TerrainLayer = memo(TerrainLayerImpl);
