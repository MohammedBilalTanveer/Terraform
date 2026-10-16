// CSS-only glitch: scanlines, RGB-split bars and flicker (no screen shake). Reduce-motion → static scanlines + fade.
import { useEffect, useState } from "react";

const CSS = `
@keyframes tf-flicker { 0%,100%{opacity:.85} 10%{opacity:.2} 20%{opacity:.95} 32%{opacity:.4} 47%{opacity:1} 60%{opacity:.3} 75%{opacity:.9} 88%{opacity:.15} }
@keyframes tf-scan { from { background-position: 0 0; } to { background-position: 0 6px; } }
@keyframes tf-hue { 0%{filter:none} 20%{filter:hue-rotate(80deg) saturate(2.2) contrast(1.4)} 40%{filter:invert(.85) hue-rotate(180deg)} 60%{filter:hue-rotate(-60deg) saturate(3) contrast(1.8)} 80%{filter:grayscale(1) contrast(2) brightness(.7)} 100%{filter:brightness(0)} }
.tf-glitch-scene { animation: tf-hue 2.4s steps(9) forwards; }
.tf-glitch-scene-calm { transition: filter 2.4s ease; filter: grayscale(1) brightness(0); }
`;

export function GlitchStyles() {
  return <style>{CSS}</style>;
}

export default function GlitchOverlay({ reduceMotion }: { reduceMotion: boolean }) {
  const [bars, setBars] = useState<{ top: number; h: number; dx: number; c: string }[]>([]);
  useEffect(() => {
    if (reduceMotion) return;
    const t = window.setInterval(() => {
      setBars(
        Array.from({ length: 7 }).map(() => ({
          top: Math.random() * 100,
          h: 1 + Math.random() * 7,
          dx: (Math.random() - 0.5) * 60,
          c: Math.random() > 0.5 ? "rgba(255,40,90,0.55)" : "rgba(56,225,255,0.55)",
        })),
      );
    }, 70);
    return () => window.clearInterval(t);
  }, [reduceMotion]);
  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, rgba(0,0,0,0.35) 0px, rgba(0,0,0,0.35) 1px, transparent 2px, transparent 3px)",
          animation: reduceMotion ? undefined : "tf-scan .25s linear infinite",
        }}
      />
      {!reduceMotion &&
        bars.map((b, i) => (
          <div
            key={i}
            className="absolute inset-x-0 mix-blend-screen"
            style={{ top: `${b.top}%`, height: `${b.h}%`, transform: `translateX(${b.dx}px)`, background: b.c }}
          />
        ))}
      <div className="absolute inset-0 grid place-items-center" style={{ animation: reduceMotion ? undefined : "tf-flicker 0.6s steps(6) infinite" }}>
        <div
          className="max-w-[92vw] break-words px-3 text-center font-display font-bold tracking-[0.12em] text-white sm:tracking-[0.3em]"
         
          style={{ fontSize: "clamp(1.1rem, 5.6vw, 2.25rem)", textShadow: reduceMotion ? undefined : "0.1em 0 rgba(255,40,90,0.9), -0.1em 0 rgba(56,225,255,0.9)" }}
        >
          REALITY_INDEX // ERR
        </div>
      </div>
    </div>
  );
}
