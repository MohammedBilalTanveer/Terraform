// Hover / tap information card for a map location, anchored beside its pin and clamped inside the map.
import { useLayoutEffect, useRef, useState } from "react";
import { ArrowRight, Lock } from "lucide-react";
import { PLACE_INFO } from "../places";
import type { StationId } from "../worldConfig";
import { PIN_ICON } from "./pinIcons";
import type { PinModel } from "./Pins";
import { chipClass } from "./List";

export function PlaceCard({
  pin,
  W,
  H,
  distance,
  nextLabel,
  touch,
  onTravel,
  onEnter,
  onLeave,
}: {
  pin: PinModel;
  W: number;
  H: number;
  distance: number;
  nextLabel: string | null;
  touch: boolean;
  onTravel: (id: StationId) => void;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);
  const info = PLACE_INFO[pin.id];
  const Icon = PIN_ICON[pin.id];
  const st = pin.status;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const cw = el.offsetWidth;
    const ch = el.offsetHeight;
    const flag = pin.isNext ? 34 : 0;
    const topRoom = pin.hy - pin.R - 12 - flag;
    const below = topRoom < ch + 8 && H - (pin.gy + 14) > topRoom;
    let top = below ? pin.gy + 14 : pin.hy - pin.R - 12 - flag - ch;
    let left = pin.hx - cw / 2;
    left = Math.max(8, Math.min(W - cw - 8, left));
    top = Math.max(8, Math.min(H - ch - 8, top));
    setAt((o) => (o && Math.abs(o.left - left) < 0.5 && Math.abs(o.top - top) < 0.5 ? o : { left, top }));
  });

  return (
    <div
      ref={ref}
      className="tf-wm-card pointer-events-auto absolute z-20 overflow-y-auto rounded-2xl border border-white/15 bg-[#0a1124]/95 p-3 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.85)]"
      style={{ left: at?.left ?? 0, top: at?.top ?? 0, visibility: at ? "visible" : "hidden", width: Math.min(284, W - 16), maxHeight: H - 16, borderColor: `${pin.color}66` }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      onClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      role="group"
      aria-label={`${pin.name} details`}
    >
      <div className="flex items-start gap-2.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#101a36]" style={{ boxShadow: `inset 0 0 0 2px ${pin.color}` }}>
          <Icon className="h-5 w-5 text-white" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-heading text-[14.5px] font-semibold leading-tight text-ivory">{pin.name}</div>
          <div className="mt-0.5 text-[12px] font-medium text-cyan-200/90">{info.short}</div>
        </div>
      </div>
      <p className="mt-2 text-[12px] leading-snug text-ivory/70">{info.why}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className={chipClass(st.kind)}>
          {st.kind === "locked" && <Lock className="h-3 w-3" aria-hidden />}
          {st.chip}
        </span>
        {pin.isHere ? <span className="text-[11.5px] font-semibold text-white">You are here</span> : <span className="text-[11.5px] text-ivory/60">{distance} m away</span>}
      </div>
      {pin.isNext && nextLabel && (
        <div className="mt-2 rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-2.5 py-1.5 text-[11.5px] leading-snug text-cyan-100">
          <span className="font-display text-[11px] tracking-[0.18em] text-cyan-300">NEXT </span>
          {nextLabel}
        </div>
      )}
      <button
        type="button"
        onClick={() => onTravel(pin.id)}
        className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 to-sky-400 px-3 font-heading text-[13.5px] font-bold text-[#04202a] shadow-[0_6px_20px_-8px_rgba(56,225,255,0.8)] transition hover:brightness-110 active:scale-[0.98]"
      >
        Travel here <ArrowRight className="h-4 w-4" aria-hidden />
      </button>
      {touch && <div className="mt-1.5 text-center text-[11px] text-ivory/45">Tap the pin again to travel</div>}
    </div>
  );
}
