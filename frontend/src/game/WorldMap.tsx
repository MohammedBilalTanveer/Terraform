// World map: a fitted, zoomable/pannable tile of the valley with real shaded relief, trails, the runoff channel,
// dark-glass lucide pins with state badges, collision-free name chips, a live player beacon + route to the next
// quest location, a hover/tap card, and a grouped location list. Tap / click a location to teleport there.
// Presentation only — no agricultural content (place copy comes from places.ts, status from the quest).
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as RKeyboardEvent, type PointerEvent as RPointerEvent } from "react";
import { createPortal } from "react-dom";
import { Info, Maximize2, Minus, Plus, X } from "lucide-react";
import { useTerraform } from "../store/terraformStore";
import { playerState, useGame } from "./gameStore";
import { teleportTo } from "./teleport";
import { STATIONS, type StationId } from "./worldConfig";
import { useQuest } from "./useQuest";
import { cx } from "./ui/kit";
import { Compass, Corners, Legend, ScaleBar } from "./map/Chrome";
import { PlaceCard } from "./map/Card";
import { LocationList, type Filter, type ListRow } from "./map/List";
import { EXTENT, clampView, fitScale, fitView, placeLabels, stationBounds, textWidth, type LabelReq, type View } from "./map/mapGeo";
import { GridTicks, OverlayDefs, PinLayer, PlayerLayer, RouteChip, type PinModel } from "./map/Pins";
import { ORDER, SHORT_NAME, fullName } from "./map/pinIcons";
import { stationStatuses } from "./map/status";
import { TerrainLayer } from "./map/TerrainLayer";
import { bakeTerrain, bakedTerrainUrl, prebakeTerrainSoon } from "./map/terrainBake";

// warm the terrain bitmap in idle time so the map opens instantly
prebakeTerrainSoon();

const BOUNDS = stationBounds();
const SORTED = ORDER.map((id) => STATIONS.find((s) => s.id === id)!).filter(Boolean);
const DRAG_PX = 7;

type CardState = { id: StationId; via: "hover" | "focus" | "touch" } | null;

export default function WorldMap(props: { onClose: () => void; target: StationId | null }) {
  // Rendered into the game root so it always sits above the loading pill (a sibling of the overlay layer).
  const host = useMemo(() => (typeof document === "undefined" ? null : document.querySelector<HTMLElement>(".tf-game")), []);
  const dialog = <MapDialog {...props} />;
  return host ? createPortal(dialog, host) : dialog;
}

function MapDialog({ onClose, target }: { onClose: () => void; target: StationId | null }) {
  const area = useGame((s) => s.area);
  const reduce = useTerraform((s) => s.reduceMotion);
  const { steps, quest } = useQuest();
  const statuses = useMemo(() => stationStatuses(steps), [steps]);
  const nextLabel = quest?.label ?? null;

  // ---- live player position (timer, not rAF) ----
  const [pos, setPos] = useState(() => ({ x: playerState.x, z: playerState.z, rot: playerState.rot }));
  useEffect(() => {
    const t = window.setInterval(() => {
      setPos((p) => (Math.abs(p.x - playerState.x) > 0.02 || Math.abs(p.z - playerState.z) > 0.02 || Math.abs(p.rot - playerState.rot) > 0.01 ? { x: playerState.x, z: playerState.z, rot: playerState.rot } : p));
    }, 200);
    return () => window.clearInterval(t);
  }, []);

  // ---- baked terrain bitmap ----
  const [baked, setBaked] = useState<string | null>(bakedTerrainUrl);
  useEffect(() => {
    if (baked) return;
    let live = true;
    void bakeTerrain().then((u) => live && setBaked(u));
    return () => {
      live = false;
    };
  }, [baked]);

  // ---- viewport size + view (zoom/pan) ----
  const vpRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = vpRef.current;
    if (!el) return;
    const read = () => {
      const w = Math.round(el.clientWidth);
      const h = Math.round(el.clientHeight);
      setSize((o) => (o.w === w && o.h === h ? o : { w, h }));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const { w: W, h: Hh } = size;
  const fit = W ? fitScale(BOUNDS, W, Hh) : 1;
  const minS = Math.max(fit * 0.55, Math.max(W, Hh) / (2 * EXTENT));
  const maxS = fit * 3.2;
  const lim = useRef({ W, Hh, minS, maxS });
  lim.current = { W, Hh, minS, maxS };

  const [view, setView] = useState<View | null>(null);
  const viewRef = useRef<View | null>(null);
  const touched = useRef(false);
  const apply = useCallback((v: View) => {
    const l = lim.current;
    const c = clampView(v, l.W, l.Hh, l.minS, l.maxS);
    viewRef.current = c;
    setView(c);
  }, []);
  useEffect(() => {
    if (!W) return;
    if (!viewRef.current || !touched.current) apply(fitView(BOUNDS, W, Hh));
    else apply(viewRef.current);
  }, [W, Hh, apply]);

  const v: View | null = view ?? (W ? fitView(BOUNDS, W, Hh) : null);

  const anim = useRef(0);
  const animT = useRef(0);
  const animateTo = useCallback(
    (to: View) => {
      window.cancelAnimationFrame(anim.current);
      window.clearTimeout(animT.current);
      const from = viewRef.current;
      if (!from || reduce) return apply(to);
      const t0 = performance.now();
      const dur = 260;
      const step = (t: number) => {
        const k = Math.min(1, (t - t0) / dur);
        const e = 1 - Math.pow(1 - k, 3);
        apply({ cx: from.cx + (to.cx - from.cx) * e, cz: from.cz + (to.cz - from.cz) * e, s: from.s * Math.pow(to.s / from.s, e) });
        if (k < 1) anim.current = window.requestAnimationFrame(step);
      };
      anim.current = window.requestAnimationFrame(step);
      animT.current = window.setTimeout(() => apply(to), dur + 90); // throttled-tab safety net
    },
    [apply, reduce],
  );
  useEffect(
    () => () => {
      window.cancelAnimationFrame(anim.current);
      window.clearTimeout(animT.current);
    },
    [],
  );

  const stopAnim = () => {
    window.cancelAnimationFrame(anim.current);
    window.clearTimeout(animT.current);
  };
  const zoomAt = useCallback(
    (mx: number, my: number, factor: number, smooth = false) => {
      const cur = viewRef.current;
      if (!cur) return;
      const l = lim.current;
      const s = Math.max(l.minS, Math.min(l.maxS, cur.s * factor));
      const wx = cur.cx + (mx - l.W / 2) / cur.s;
      const wz = cur.cz + (my - l.Hh / 2) / cur.s;
      const next = { s, cx: wx - (mx - l.W / 2) / s, cz: wz - (my - l.Hh / 2) / s };
      touched.current = true;
      if (smooth) animateTo(clampView(next, l.W, l.Hh, l.minS, l.maxS));
      else {
        stopAnim();
        apply(next);
      }
    },
    [apply, animateTo],
  );
  const zoomCentre = (f: number) => zoomAt(lim.current.W / 2, lim.current.Hh / 2, f, true);
  const doFit = () => {
    touched.current = false;
    animateTo(fitView(BOUNDS, lim.current.W, lim.current.Hh));
  };

  // wheel zoom needs a non-passive listener
  useEffect(() => {
    const el = vpRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0017)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // ---- pointer gestures: drag-pan (with threshold), pinch-zoom, tap on empty map clears the card ----
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const gest = useRef<{ mode: "pending" | "pan" | "pinch"; sx: number; sy: number; v0: View; d0: number; mx0: number; my0: number; moved: boolean }>({
    mode: "pending",
    sx: 0,
    sy: 0,
    v0: { cx: 0, cz: 0, s: 1 },
    d0: 1,
    mx0: 0,
    my0: 0,
    moved: false,
  });
  const dragged = useRef(false);
  const lastPtr = useRef<string>("mouse");
  const rel = (e: { clientX: number; clientY: number }) => {
    const r = vpRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const beginPinch = () => {
    const pts = [...ptrs.current.values()];
    const g = gest.current;
    g.mode = "pinch";
    g.v0 = viewRef.current ?? g.v0;
    g.d0 = Math.max(1, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y));
    g.mx0 = (pts[0].x + pts[1].x) / 2;
    g.my0 = (pts[0].y + pts[1].y) / 2;
    g.moved = true;
    dragged.current = true;
  };
  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    lastPtr.current = e.pointerType || "mouse";
    if (e.pointerType === "mouse" && e.button !== 0) return;
    stopAnim();
    const p = rel(e);
    ptrs.current.set(e.pointerId, p);
    if (ptrs.current.size === 1) {
      dragged.current = false;
      gest.current = { mode: "pending", sx: p.x, sy: p.y, v0: viewRef.current ?? { cx: 0, cz: 0, s: 1 }, d0: 1, mx0: 0, my0: 0, moved: false };
    } else if (ptrs.current.size === 2) {
      beginPinch();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
  };
  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (!ptrs.current.has(e.pointerId)) return;
    const p = rel(e);
    ptrs.current.set(e.pointerId, p);
    const g = gest.current;
    const l = lim.current;
    if (g.mode === "pinch" && ptrs.current.size >= 2) {
      const pts = [...ptrs.current.values()];
      const d = Math.max(1, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y));
      const mx = (pts[0].x + pts[1].x) / 2;
      const my = (pts[0].y + pts[1].y) / 2;
      const s = Math.max(l.minS, Math.min(l.maxS, g.v0.s * (d / g.d0)));
      const wx = g.v0.cx + (g.mx0 - l.W / 2) / g.v0.s;
      const wz = g.v0.cz + (g.my0 - l.Hh / 2) / g.v0.s;
      touched.current = true;
      apply({ s, cx: wx - (mx - l.W / 2) / s, cz: wz - (my - l.Hh / 2) / s });
      return;
    }
    if (ptrs.current.size !== 1) return;
    const dx = p.x - g.sx;
    const dy = p.y - g.sy;
    if (g.mode === "pending" && Math.hypot(dx, dy) > (e.pointerType === "touch" ? DRAG_PX + 3 : DRAG_PX)) {
      g.mode = "pan";
      g.moved = true;
      dragged.current = true;
      setCard((c) => (c && c.via === "touch" ? null : c));
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    if (g.mode === "pan") {
      touched.current = true;
      apply({ s: g.v0.s, cx: g.v0.cx - dx / g.v0.s, cz: g.v0.cz - dy / g.v0.s });
    }
  };
  const onPointerUp = (e: RPointerEvent<HTMLDivElement>) => {
    if (!ptrs.current.has(e.pointerId)) return;
    ptrs.current.delete(e.pointerId);
    const g = gest.current;
    if (ptrs.current.size === 1 && g.mode === "pinch") {
      // continue as a pan with the remaining finger
      const [rest] = [...ptrs.current.values()];
      g.mode = "pan";
      g.sx = rest.x;
      g.sy = rest.y;
      g.v0 = viewRef.current ?? g.v0;
    }
    if (ptrs.current.size === 0) {
      if (!g.moved && e.type === "pointerup") {
        // a tap on empty map: dismiss a tap-opened card
        const onPin = (e.target as Element | null)?.closest?.(".tf-wm-pin");
        if (!onPin) setCard((c) => (c && c.via === "touch" ? null : c));
      }
      g.mode = "pending";
      window.setTimeout(() => {
        dragged.current = false;
      }, 0);
    }
  };

  // ---- hover / focus / tap state ----
  const [hot, setHot] = useState<StationId | null>(null);
  const [card, setCard] = useState<CardState>(null);
  const cardRef = useRef<CardState>(null);
  cardRef.current = card;
  const hideT = useRef(0);
  const cancelHide = () => window.clearTimeout(hideT.current);
  const scheduleHide = () => {
    cancelHide();
    hideT.current = window.setTimeout(() => {
      setCard((c) => (c && c.via === "touch" ? c : null));
      setHot(null);
    }, 170);
  };
  useEffect(() => () => window.clearTimeout(hideT.current), []);
  const go = useCallback((id: StationId) => teleportTo(id), []);
  const handlers = useMemo(
    () => ({
      onClick: (id: StationId) => {
        if (dragged.current) return;
        if (lastPtr.current === "touch") {
          const c = cardRef.current;
          if (c && c.id === id && c.via === "touch") go(id);
          else {
            setCard({ id, via: "touch" });
            setHot(id);
          }
        } else go(id);
      },
      onKey: (id: StationId, e: RKeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          go(id);
        }
      },
      onEnter: (id: StationId, e: RPointerEvent) => {
        if (e.pointerType === "touch") return;
        cancelHide();
        setCard((c) => (c && c.via === "touch" && c.id !== id ? c : { id, via: "hover" }));
        setHot(id);
      },
      onLeave: (_id: StationId, e: RPointerEvent) => {
        if (e.pointerType === "touch") return;
        scheduleHide();
      },
      onFocus: (id: StationId) => {
        cancelHide();
        setCard({ id, via: "focus" });
        setHot(id);
      },
      onBlur: () => scheduleHide(),
    }),
    [go],
  );

  const player = v ? { px: (pos.x - v.cx) * v.s + W / 2, py: (pos.z - v.cz) * v.s + Hh / 2 } : null;
  // pin geometry (head radius, ground point and head centre per station) — independent of labels
  const geo = useMemo(() => {
    if (!v || !W) return null;
    const R = Math.max(13, Math.min(20, Math.round(v.s * 3.6)));
    const stem = R + 8;
    const base = SORTED.map((s) => {
      const gx = (s.pos[0] - v.cx) * v.s + W / 2;
      const gy = (s.pos[1] - v.cz) * v.s + Hh / 2;
      return { s, gx, gy, hx: gx, hy: gy - stem };
    });
    return { R, base };
  }, [v, W, Hh]);
  // route to the next location; the distance chip slides along the line to dodge pin heads
  const route = useMemo(() => {
    if (!v || !target || !geo || !player) return null;
    const t = STATIONS.find((s) => s.id === target);
    if (!t) return null;
    const metres = Math.round(Math.hypot(t.pos[0] - pos.x, t.pos[1] - pos.z));
    if (metres < 3) return null;
    const tx = (t.pos[0] - v.cx) * v.s + W / 2;
    const ty = (t.pos[1] - v.cz) * v.s + Hh / 2;
    const len = Math.hypot(tx - player.px, ty - player.py);
    let at = 0.5;
    if (len > 80) {
      let bc = Infinity;
      for (const tt of [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74]) {
        const cx = player.px + (tx - player.px) * tt;
        const cy = player.py + (ty - player.py) * tt;
        let c = 0;
        for (const h of geo.base) {
          const d = Math.hypot(h.hx - cx, h.hy - cy);
          if (d < geo.R + 36) c += geo.R + 36 - d;
        }
        if (c < bc) {
          bc = c;
          at = tt;
        }
        if (c === 0) break;
      }
    }
    return { tx, ty, metres, t: at };
  }, [v, target, geo, pos.x, pos.z, W, Hh, player?.px, player?.py]);
  // ---- derived pin models (screen space) ----
  const pins = useMemo<PinModel[]>(() => {
    if (!geo) return [];
    const { R, base } = geo;
    const cardId = card?.id ?? null;
    const reqs: LabelReq[] = base.map(({ s, hx, hy }) => {
      const st = statuses[s.id];
      const forced = s.id === target || s.id === area || s.id === hot || s.id === cardId;
      const text = forced ? fullName(s.name) : SHORT_NAME[s.id];
      const isNext = s.id === target;
      return {
        id: s.id,
        px: hx,
        py: hy,
        r: R,
        w: textWidth(text, 12) + 30,
        h: 24,
        forced,
        priority: isNext ? 100 : s.id === area ? 90 : st.kind === "todo" ? 60 : st.kind === "locked" ? 40 : st.kind === "done" ? 30 : s.interactive ? 20 : 10,
        reserve: isNext ? { x: hx - 28, y: hy - R - 44, w: 56, h: 42 } : undefined,
      };
    });
    const chips = placeLabels(reqs, W, Hh, [
      { x: 4, y: 4, w: 66, h: 66 }, // compass
      { x: W - 60, y: 4, w: 58, h: 4 * 44 + 3 * 6 + 12 }, // toolbar
      { x: 4, y: Hh - 46, w: 110, h: 44 }, // scale bar
      ...(route && player && Math.hypot(route.tx - player.px, route.ty - player.py) > 80
        ? [{ x: player.px + (route.tx - player.px) * route.t - 30, y: player.py + (route.ty - player.py) * route.t - 13, w: 60, h: 26 }]
        : []), // route distance chip
    ]);
    return base.map(({ s, gx, gy, hx, hy }) => {
      const forced = reqs.find((q) => q.id === s.id)!.forced;
      return {
        id: s.id,
        name: fullName(s.name),
        color: s.color,
        status: statuses[s.id],
        isNext: s.id === target,
        isHere: s.id === area,
        hot: s.id === hot || s.id === cardId,
        gx,
        gy,
        hx,
        hy,
        R,
        chip: chips.get(s.id) ?? null,
        chipText: forced ? fullName(s.name) : SHORT_NAME[s.id],
        interactive: s.interactive,
      };
    });
  }, [geo, W, Hh, statuses, target, area, hot, card, route, player?.px, player?.py]);

  const rows = useMemo<ListRow[]>(
    () =>
      SORTED.map((s) => ({
        id: s.id,
        name: fullName(s.name),
        color: s.color,
        status: statuses[s.id],
        isNext: s.id === target,
        isHere: s.id === area,
        distance: Math.round(Math.hypot(s.pos[0] - pos.x, s.pos[1] - pos.z)),
      })),
    [statuses, target, area, pos.x, pos.z],
  );
  const [filter, setFilter] = useState<Filter>("all");
  const [legend, setLegend] = useState(false);

  const cardPin = card ? pins.find((p) => p.id === card.id) ?? null : null;
  const cardRow = card ? rows.find((r) => r.id === card.id) ?? null : null;

  // ---- a11y: focus trap-lite, restore focus on close, +/-/0 keys ----
  const panelRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      if (prev && prev !== document.body && document.contains(prev)) prev.focus({ preventScroll: true });
    };
  }, []);
  const onKeyDown = (e: RKeyboardEvent) => {
    if (e.key === "Tab") {
      const root = rootRef.current;
      if (!root) return;
      const els = [...root.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex="0"]')].filter((el) => el.getClientRects().length > 0);
      if (!els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      const act = document.activeElement;
      if (e.shiftKey && (act === first || act === panelRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && act === last) {
        e.preventDefault();
        first.focus();
      }
      return;
    }
    if (e.key === "+" || e.key === "=") zoomCentre(1.4);
    else if (e.key === "-" || e.key === "_") zoomCentre(1 / 1.4);
    else if (e.key === "0") doFit();
  };

  const tbtn =
    "pointer-events-auto grid h-11 w-11 place-items-center rounded-xl border border-white/15 bg-[#0a1124]/90 text-ivory/90 shadow-lg transition hover:border-cyan-300/60 hover:bg-[#13204a] hover:text-white active:scale-95 disabled:opacity-40";

  return (
    <div
      ref={rootRef}
      className={cx("tf-wm-root pointer-events-auto absolute inset-0 z-[70]", reduce && "tf-wm-calm")}
      onClick={onClose}
      onKeyDown={onKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label="World map"
    >
      <div className="tf-wm-frame" onClick={(e) => e.stopPropagation()}>
        <div ref={panelRef} tabIndex={-1} className="tf-wm-panel outline-none">
          <header className="tf-wm-head flex shrink-0 items-center justify-between gap-3 px-3.5 sm:px-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-display text-[12px] font-bold tracking-[0.32em] text-cyan-300 sm:text-[13px]">
                <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_10px_#38e1ff]" aria-hidden />
                WORLD MAP
              </div>
              <div className="tf-wm-sub truncate font-heading text-[12.5px] text-ivory/65">Tap a pin to preview it, then travel.</div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close map (Esc)" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/15 text-ivory/85 transition hover:border-white/40 hover:bg-white/10">
              <X className="h-5 w-5" aria-hidden />
            </button>
          </header>

          <div className="tf-wm-body">
            {/* ---- the map ---- */}
            <div className="tf-wm-map">
              <div
                ref={vpRef}
                className="tf-wm-viewport absolute inset-0 touch-none select-none overflow-hidden"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                {v && W > 0 && (
                  <>
                    <svg
                      className="absolute inset-0 block h-full w-full"
                      viewBox={`${v.cx - W / 2 / v.s} ${v.cz - Hh / 2 / v.s} ${W / v.s} ${Hh / v.s}`}
                      preserveAspectRatio="none"
                      role="img"
                      aria-label="Map of the valley"
                    >
                      <TerrainLayer imageUrl={baked} />
                    </svg>
                    <div className="tf-wm-grain pointer-events-none absolute inset-0" aria-hidden />
                    <svg className="tf-wm-overlay absolute inset-0 block overflow-visible" width={W} height={Hh} viewBox={`0 0 ${W} ${Hh}`} style={{ pointerEvents: "none" }}>
                      <OverlayDefs />
                      <GridTicks cx={v.cx} cz={v.cz} s={v.s} W={W} H={Hh} />
                      {player && <PlayerLayer px={player.px} py={player.py} rot={pos.rot} route={route} />}
                      <PinLayer pins={pins} handlers={handlers} />
                      {player && <RouteChip px={player.px} py={player.py} route={route} />}
                    </svg>
                  </>
                )}
              </div>
              <div className="tf-wm-vignette pointer-events-none absolute inset-0" aria-hidden />
              <div className="tf-wm-scan pointer-events-none absolute inset-0" aria-hidden />
              <Corners />
              <Compass />
              {v && <ScaleBar s={v.s} />}

              {/* toolbar */}
              <div className="pointer-events-none absolute right-2.5 top-2.5 z-30 flex flex-col gap-1.5">
                <button type="button" className={tbtn} onClick={() => zoomCentre(1.4)} aria-label="Zoom in (+)" disabled={!!v && v.s >= maxS - 0.01}>
                  <Plus className="h-5 w-5" aria-hidden />
                </button>
                <button type="button" className={tbtn} onClick={() => zoomCentre(1 / 1.4)} aria-label="Zoom out (-)" disabled={!!v && v.s <= minS + 0.01}>
                  <Minus className="h-5 w-5" aria-hidden />
                </button>
                <button type="button" className={tbtn} onClick={doFit} aria-label="Fit all locations (0)" title="Fit all locations">
                  <Maximize2 className="h-[18px] w-[18px]" aria-hidden />
                </button>
                <button type="button" className={cx(tbtn, legend && "border-cyan-300/70 text-cyan-200")} onClick={() => setLegend((o) => !o)} aria-label="Legend" aria-expanded={legend} title="Legend">
                  <Info className="h-5 w-5" aria-hidden />
                </button>
              </div>
              {legend && <Legend onClose={() => setLegend(false)} />}

              {cardPin && cardRow && W > 0 && (
                <PlaceCard
                  pin={cardPin}
                  W={W}
                  H={Hh}
                  distance={cardRow.distance}
                  nextLabel={nextLabel}
                  touch={card?.via === "touch"}
                  onTravel={go}
                  onEnter={cancelHide}
                  onLeave={scheduleHide}
                />
              )}
            </div>

            {/* ---- the list (44px+ rows, single tap travels) ---- */}
            <aside className="tf-wm-list" aria-label="Locations">
              <LocationList rows={rows} filter={filter} setFilter={setFilter} nextLabel={nextLabel} hot={hot} onHot={setHot} onTravel={go} />
            </aside>
          </div>

          <footer className="tf-wm-foot flex shrink-0 items-center justify-between gap-3 px-3.5 text-[11.5px] text-ivory/55 sm:px-4">
            <span className="whitespace-nowrap font-display tracking-[0.16em] text-ivory/70">
              YOU <span className="text-cyan-200">X {Math.round(pos.x)}</span> · <span className="text-cyan-200">Z {Math.round(pos.z)}</span> m
            </span>
            <span className="tf-wm-hint-fine hidden items-center gap-3 sm:flex">
              <span>
                <kbd className="tf-wm-kbd">M</kbd> toggle
              </span>
              <span>
                <kbd className="tf-wm-kbd">Esc</kbd> close
              </span>
              <span>drag to pan</span>
              <span>scroll to zoom</span>
            </span>
            <span className="tf-wm-hint-coarse hidden">drag to pan · pinch to zoom</span>
          </footer>
        </div>
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
