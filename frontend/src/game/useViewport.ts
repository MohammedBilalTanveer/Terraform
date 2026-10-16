// Live viewport info (resize + orientationchange + visualViewport). Never remounts anything: it only
// updates numbers that components use for camera framing, dpr and collapse defaults.
import { useEffect, useState } from "react";

export type Viewport = {
  w: number;
  h: number;
  aspect: number;
  portrait: boolean;
  /** landscape phones etc. */
  short: boolean;
  narrow: boolean;
  /** small / likely low-power screen */
  small: boolean;
};

const read = (): Viewport => {
  const vv = typeof window !== "undefined" ? window.visualViewport : null;
  const w = Math.max(1, Math.round(vv?.width ?? (typeof window !== "undefined" ? window.innerWidth : 1280)));
  const h = Math.max(1, Math.round(vv?.height ?? (typeof window !== "undefined" ? window.innerHeight : 800)));
  return { w, h, aspect: w / h, portrait: h > w, short: h < 500, narrow: w < 640, small: Math.min(w, h) < 520 };
};

export function useViewport(): Viewport {
  const [vp, setVp] = useState<Viewport>(read);
  useEffect(() => {
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const n = read();
        setVp((o) => (o.w === n.w && o.h === n.h ? o : n));
      });
    };
    window.addEventListener("resize", on);
    window.addEventListener("orientationchange", on);
    window.visualViewport?.addEventListener("resize", on);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(on) : null;
    ro?.observe(document.documentElement);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", on);
      window.removeEventListener("orientationchange", on);
      window.visualViewport?.removeEventListener("resize", on);
      ro?.disconnect();
    };
  }, []);
  return vp;
}

/** Canvas pixel-ratio range: never above 1.5, and 1 on small screens. */
export const dprFor = (vp: Viewport): [number, number] => (vp.small ? [1, 1] : [1, 1.5]);

/**
 * Vertical FOV that keeps enough of the world visible on narrow (portrait) screens:
 * keeps the horizontal field of view from collapsing as the aspect drops below `refAspect`.
 */
export function fovForAspect(baseDeg: number, aspect: number, maxDeg = 72, refAspect = 1.6): number {
  if (aspect >= refAspect) return baseDeg;
  const base = (baseDeg * Math.PI) / 180;
  const hRef = 2 * Math.atan(Math.tan(base / 2) * refAspect);
  const v = 2 * Math.atan(Math.tan(hRef / 2) / aspect);
  return Math.min(maxDeg, (v * 180) / Math.PI);
}

/** Extra camera distance factor for portrait screens (on top of the wider FOV). */
export const distForAspect = (aspect: number) => (aspect >= 1 ? 1 : 1 + Math.min(0.45, (1 - aspect) * 0.55));
