// Ambient backdrop: aurora glows, a drifting terrain grid and a faint starfield. Decorative only.
import { useMemo } from "react";
import { useTerraform } from "../store/terraformStore";
import { cx } from "./ui";

export default function Background({ intensity = "subtle" }: { intensity?: "subtle" | "hero" }) {
  const reduce = useTerraform((s) => s.reduceMotion);
  const stars = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        x: (i * 137.5) % 100,
        y: (i * 61.8 * 1.7) % 100,
        s: i % 7 === 0 ? 2 : 1,
        d: (i % 9) * 0.7,
      })),
    [],
  );
  const hero = intensity === "hero";
  return (
    <div className={cx("pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-midnight", reduce && "reduce-motion")} aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(27,39,80,0.9),transparent_60%)]" />
      <div className={cx("animate-aurora absolute -left-[20%] -top-[30%] h-[80vh] w-[80vw] rounded-full blur-[110px]", hero ? "opacity-60" : "opacity-35")}
        style={{ background: "radial-gradient(closest-side, rgba(56,225,255,0.55), rgba(139,92,246,0.25), transparent)" }} />
      <div className={cx("animate-aurora absolute -right-[15%] top-[10%] h-[70vh] w-[60vw] rounded-full blur-[120px]", hero ? "opacity-50" : "opacity-25")}
        style={{ background: "radial-gradient(closest-side, rgba(139,92,246,0.55), rgba(236,72,153,0.2), transparent)", animationDelay: "-8s" }} />
      <div className={cx("animate-aurora absolute -bottom-[35%] left-[20%] h-[70vh] w-[70vw] rounded-full blur-[120px]", hero ? "opacity-45" : "opacity-20")}
        style={{ background: "radial-gradient(closest-side, rgba(224,122,95,0.5), rgba(181,82,59,0.25), transparent)", animationDelay: "-14s" }} />
      {stars.map((st, i) => (
        <span key={i} className="animate-twinkle absolute rounded-full bg-ivory" style={{ left: `${st.x}%`, top: `${st.y * 0.6}%`, width: st.s, height: st.s, animationDelay: `${st.d}s` }} />
      ))}
      <div className="absolute inset-x-0 bottom-0 h-[55vh] [perspective:600px]">
        <div
          className="bg-terrain-grid animate-grid-drift absolute inset-x-[-50%] bottom-[-10%] h-[140%] origin-bottom [transform:rotateX(62deg)]"
          style={{ maskImage: "linear-gradient(to top, black 10%, transparent 80%)", WebkitMaskImage: "linear-gradient(to top, black 10%, transparent 80%)", opacity: hero ? 0.9 : 0.5 }}
        />
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(7,11,26,0.75))]" />
    </div>
  );
}
