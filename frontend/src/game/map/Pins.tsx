// Screen-space overlay of the world map: pins (dark glass + coloured ring + lucide icon + state badges),
// collision-free name chips, the route to the next quest location, grid ticks and the player beacon.
import { memo } from "react";
import { Check, Lock } from "lucide-react";
import type { StationId } from "../worldConfig";
import { PIN_ICON } from "./pinIcons";
import type { Rect } from "./mapGeo";
import type { StationStatus } from "./status";

export type PinModel = {
  id: StationId;
  name: string;
  color: string;
  status: StationStatus;
  isNext: boolean;
  isHere: boolean;
  hot: boolean;
  /** ground point, px */
  gx: number;
  gy: number;
  /** head centre, px */
  hx: number;
  hy: number;
  R: number;
  /** chip text + rect (null = icon only) */
  chip: Rect | null;
  chipText: string;
  interactive: boolean;
};

const NEXT = "#38e1ff";
const LOCKED = "#8a93a8";
const DONE = "#46c37b";
const TODO = "#f6c177";

const statusDot = (k: StationStatus["kind"]) => (k === "done" ? DONE : k === "todo" ? TODO : k === "locked" ? LOCKED : "#7fb6d4");

function PinView({
  m,
  onClick,
  onKey,
  onEnter,
  onLeave,
  onFocus,
  onBlur,
}: {
  m: PinModel;
  onClick: (id: StationId) => void;
  onKey: (id: StationId, e: React.KeyboardEvent) => void;
  onEnter: (id: StationId, e: React.PointerEvent) => void;
  onLeave: (id: StationId, e: React.PointerEvent) => void;
  onFocus: (id: StationId) => void;
  onBlur: (id: StationId) => void;
}) {
  const { R, status: st } = m;
  const ring = m.isNext ? NEXT : st.kind === "locked" ? LOCKED : m.color;
  const Icon = PIN_ICON[m.id];
  const is = Math.round(R * 1.08);
  const hitR = Math.max(R + 6, 23);
  return (
    <g
      className="tf-wm-pin"
      data-hot={m.hot ? "true" : undefined}
      role="button"
      tabIndex={0}
      aria-label={`${m.name}. ${st.chip}${m.isNext ? ". Next quest location" : ""}${m.isHere ? ". You are here" : ""}. Travel here`}
      onClick={() => onClick(m.id)}
      onKeyDown={(e) => onKey(m.id, e)}
      onPointerEnter={(e) => onEnter(m.id, e)}
      onPointerLeave={(e) => onLeave(m.id, e)}
      onFocus={() => onFocus(m.id)}
      onBlur={() => onBlur(m.id)}
    >
      {/* ground anchor + stem */}
      <ellipse cx={m.gx} cy={m.gy} rx={6.5} ry={2.7} fill={ring} fillOpacity={0.35} stroke="#070b1a" strokeOpacity={0.6} strokeWidth={1} />
      <circle cx={m.gx} cy={m.gy} r={2.4} fill={ring} stroke="#070b1a" strokeWidth={1} />
      <line x1={m.gx} y1={m.gy} x2={m.hx} y2={m.hy + R} stroke="#070b1a" strokeOpacity={0.55} strokeWidth={4} strokeLinecap="round" />
      <line x1={m.gx} y1={m.gy} x2={m.hx} y2={m.hy + R} stroke={ring} strokeWidth={2} strokeLinecap="round" />

      <g transform={`translate(${m.hx} ${m.hy})`}>
        <g className="tf-wm-phead">
          {m.isNext && (
            <>
              <circle className="tf-wm-pulse" r={R + 4} fill="none" stroke={NEXT} strokeWidth={2.5} />
              <circle className="tf-wm-pulse" r={R + 4} fill="none" stroke={NEXT} strokeWidth={2} style={{ animationDelay: "0.9s" }} />
            </>
          )}
          <circle r={R + 7} fill={ring} fillOpacity={m.hot || m.isNext ? 0.3 : 0.18} />
          <circle r={R} fill="url(#wm-glass)" stroke={ring} strokeWidth={m.hot ? 3.4 : 2.6} />
          <circle r={R - 3.2} fill="none" stroke="#fff" strokeOpacity={0.1} strokeWidth={1} />
          <circle className="tf-wm-focus" r={R + 5} fill="none" stroke="#fff" strokeWidth={2.4} />
          <Icon x={-is / 2} y={-is / 2} width={is} height={is} color="#fff" strokeWidth={2} opacity={st.kind === "locked" ? 0.6 : 1} />
          {m.isHere && <circle className="tf-wm-spin" r={R + 6.5} fill="none" stroke="#fff" strokeOpacity={0.9} strokeWidth={1.8} strokeDasharray="3 4.5" strokeLinecap="round" />}
          {/* state badge */}
          {st.kind === "done" && (
            <g transform={`translate(${R * 0.74} ${-R * 0.74})`}>
              <circle r={9.5} fill={DONE} stroke="#0b1226" strokeWidth={2} />
              <Check x={-6} y={-6} width={12} height={12} color="#06210f" strokeWidth={3.4} />
            </g>
          )}
          {st.kind === "todo" && (
            <g transform={`translate(${R * 0.74} ${-R * 0.74})`}>
              <circle r={9.5} fill={TODO} stroke="#0b1226" strokeWidth={2} />
              <text y={4} textAnchor="middle" fontSize={11.5} fontWeight={800} fontFamily="Inter, system-ui, sans-serif" fill="#2a1a05">
                {st.open > 9 ? "9+" : st.open}
              </text>
            </g>
          )}
          {st.kind === "locked" && (
            <g transform={`translate(${R * 0.74} ${-R * 0.74})`}>
              <circle r={9.5} fill="#3a4258" stroke="#0b1226" strokeWidth={2} />
              <Lock x={-5.5} y={-5.5} width={11} height={11} color="#e6e9f2" strokeWidth={2.6} />
            </g>
          )}
        </g>
        <circle r={hitR} fill="transparent" pointerEvents="all" style={{ cursor: "pointer" }} />
      </g>

    </g>
  );
}


/** Name chips + the NEXT flag draw above every pin (so the DOM order of the interactive pins never changes). */
function PinTop({ m }: { m: PinModel }) {
  const { R, status: st } = m;
  const ring = m.isNext ? NEXT : st.kind === "locked" ? LOCKED : m.color;
  return (
    <g pointerEvents="none">
      <g transform={`translate(${m.hx} ${m.hy})`}>
        {m.isNext && (
          <g className="tf-wm-next" pointerEvents="none">
            <g transform={`translate(0 ${-R - 31})`}>
              <rect x={-24} y={-10} width={48} height={20} rx={10} fill={NEXT} stroke="#06202a" strokeWidth={1.5} />
              <text y={4.3} textAnchor="middle" fontSize={11} fontWeight={800} letterSpacing={1.2} fontFamily="Orbitron, Inter, sans-serif" fill="#04202a">
                NEXT
              </text>
            </g>
            <g className="tf-wm-chev" transform={`translate(0 ${-R - 12})`}>
              <path d="M-7,-5 L0,3 L7,-5" fill="none" stroke="#06202a" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
              <path d="M-7,-5 L0,3 L7,-5" fill="none" stroke={NEXT} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          </g>
        )}
      </g>
      {/* name chip */}
      {m.chip && (
        <g transform={`translate(${m.chip.x} ${m.chip.y})`} pointerEvents="none">
          <rect width={m.chip.w} height={m.chip.h} rx={m.chip.h / 2} fill="#0a1124" fillOpacity={0.9} stroke={ring} strokeOpacity={0.65} strokeWidth={1.3} />
          <circle cx={11} cy={m.chip.h / 2} r={3.6} fill={statusDot(st.kind)} />
          <text x={20} y={m.chip.h / 2 + 4.2} fontSize={12} fontWeight={600} fontFamily='"Space Grotesk", Inter, system-ui, sans-serif' fill="#fff">
            {m.chipText}
          </text>
        </g>
      )}
    </g>
  );
}

type PinHandlers = {
  onClick: (id: StationId) => void;
  onKey: (id: StationId, e: React.KeyboardEvent) => void;
  onEnter: (id: StationId, e: React.PointerEvent) => void;
  onLeave: (id: StationId, e: React.PointerEvent) => void;
  onFocus: (id: StationId) => void;
  onBlur: (id: StationId) => void;
};

export function PinLayer({ pins, handlers }: { pins: PinModel[]; handlers: PinHandlers }) {
  return (
    <>
      {pins.map((m) => (
        <PinView key={m.id} m={m} {...handlers} />
      ))}
      {pins.map((m) => (
        <PinTop key={m.id} m={m} />
      ))}
    </>
  );
}

/** Shared <defs> for the overlay svg. */
export function OverlayDefs() {
  return (
    <defs>
      <radialGradient id="wm-glass" cx="35%" cy="28%" r="85%">
        <stop offset="0%" stopColor="#2b3a66" stopOpacity={0.98} />
        <stop offset="60%" stopColor="#101a36" stopOpacity={0.97} />
        <stop offset="100%" stopColor="#070d1f" stopOpacity={0.98} />
      </radialGradient>
      <linearGradient id="wm-cone" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stopColor="#38e1ff" stopOpacity={0.5} />
        <stop offset="100%" stopColor="#38e1ff" stopOpacity={0} />
      </linearGradient>
    </defs>
  );
}

/** Edge ticks (every 10 m, longer every 20 m) along the top and left of the map. */
export const GridTicks = memo(function GridTicks({ cx, cz, s, W, H }: { cx: number; cz: number; s: number; W: number; H: number }) {
  const step = s * 10 < 14 ? 20 : 10;
  const ticks: React.ReactNode[] = [];
  const x0 = Math.ceil((cx - W / 2 / s) / step) * step;
  for (let g = x0; g <= cx + W / 2 / s; g += step) {
    const x = (g - cx) * s + W / 2;
    ticks.push(<line key={`x${g}`} x1={x} y1={0} x2={x} y2={g % 20 === 0 ? 8 : 4} />);
  }
  const z0 = Math.ceil((cz - H / 2 / s) / step) * step;
  for (let g = z0; g <= cz + H / 2 / s; g += step) {
    const y = (g - cz) * s + H / 2;
    ticks.push(<line key={`z${g}`} x1={0} y1={y} x2={g % 20 === 0 ? 8 : 4} y2={y} />);
  }
  return (
    <g stroke="#f6d9bd" strokeOpacity={0.55} strokeWidth={1} pointerEvents="none">
      {ticks}
    </g>
  );
});

/** Player beacon (pulse + heading cone + arrow) and the route line to the next location. */
export const PlayerLayer = memo(function PlayerLayer({
  px,
  py,
  rot,
  route,
}: {
  px: number;
  py: number;
  rot: number;
  route: { tx: number; ty: number; metres: number; t: number } | null;
}) {
  const deg = 180 - (rot * 180) / Math.PI;
  const len = route ? Math.hypot(route.tx - px, route.ty - py) : 0;
  return (
    <g pointerEvents="none">
      {route && len > 6 && (
        <g>
          <line x1={px} y1={py} x2={route.tx} y2={route.ty} stroke="#38e1ff" strokeOpacity={0.2} strokeWidth={9} strokeLinecap="round" />
          <line x1={px} y1={py} x2={route.tx} y2={route.ty} stroke="#06202a" strokeOpacity={0.7} strokeWidth={5} strokeLinecap="round" />
          <line className="tf-wm-route" x1={px} y1={py} x2={route.tx} y2={route.ty} stroke="#38e1ff" strokeWidth={3} strokeLinecap="round" strokeDasharray="9 9" />
        </g>
      )}
      <g transform={`translate(${px} ${py})`}>
        <circle className="tf-wm-pulse" r={14} fill="#fff" fillOpacity={0.25} />
        <g transform={`rotate(${deg})`}>
          <path d="M0,0 L-24,-44 A50,50 0 0 1 24,-44 Z" fill="url(#wm-cone)" />
          <circle r={11} fill="#38e1ff" fillOpacity={0.25} />
          <path d="M0,-13 L9,10 L0,5 L-9,10 Z" fill="#fff" stroke="#06202a" strokeWidth={2.2} strokeLinejoin="round" />
        </g>
      </g>
    </g>
  );
});

/** Distance chip on the route line — drawn above the pins so it is always readable. */
export function RouteChip({ px, py, route }: { px: number; py: number; route: { tx: number; ty: number; metres: number; t: number } | null }) {
  if (!route || Math.hypot(route.tx - px, route.ty - py) <= 80) return null;
  const label = `${route.metres} m`;
  const w = label.length * 7 + 18;
  return (
    <g transform={`translate(${px + (route.tx - px) * route.t} ${py + (route.ty - py) * route.t})`} pointerEvents="none">
      <rect x={-w / 2} y={-11} width={w} height={22} rx={11} fill="#06202a" fillOpacity={0.96} stroke="#38e1ff" strokeWidth={1.4} />
      <text y={4.3} textAnchor="middle" fontSize={12} fontWeight={700} fontFamily="Inter, system-ui, sans-serif" fill="#c9f6ff">
        {label}
      </text>
    </g>
  );
}
