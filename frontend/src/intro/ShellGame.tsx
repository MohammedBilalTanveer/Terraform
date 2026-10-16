// Three-cup shell game. It is rigged: whichever cup you pick is empty — the pebble is palmed.
// Fully fluid: the board is sized from the viewport (width/dvh), cups are percentage-positioned,
// every tap target is large, and the card scrolls internally if the screen is very short.
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

type Stage = "show" | "shuffle" | "pick" | "reveal";

const LINES = [
  "Empty. Unlucky. Best of three — again.",
  "Empty again. Oh dear. Looking for this? It was never under a cup.",
];

const CUP_W = 28; // % of board width
const slotLeft = (slot: number) => slot * (100 / 3) + (100 / 3 - CUP_W) / 2;

export default function ShellGame({ reduceMotion, onDone }: { reduceMotion: boolean; onDone: () => void }) {
  const [round, setRound] = useState(0);
  const [stage, setStage] = useState<Stage>("show");
  const [slots, setSlots] = useState<number[]>([0, 1, 2]); // slots[slotIndex] = cupId
  const [picked, setPicked] = useState<number | null>(null);
  const [lifted, setLifted] = useState<Set<number>>(new Set([1]));
  const timers = useRef<number[]>([]);
  const later = (ms: number, f: () => void) => timers.current.push(window.setTimeout(f, ms));
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  // run a round: show pebble under cup 1 → lower → shuffle → pick
  useEffect(() => {
    setStage("show");
    setPicked(null);
    setLifted(new Set([1]));
    const swaps = reduceMotion ? 3 : 6 + round * 2;
    const step = reduceMotion ? 650 : Math.max(240, 380 - round * 70);
    later(1500, () => {
      setLifted(new Set());
      setStage("shuffle");
      for (let i = 0; i < swaps; i++) {
        later(500 + i * step, () =>
          setSlots((s) => {
            const a = Math.floor(Math.random() * 3);
            const b = (a + 1 + Math.floor(Math.random() * 2)) % 3;
            const n = [...s];
            [n[a], n[b]] = [n[b], n[a]];
            return n;
          }),
        );
      }
      later(500 + swaps * step + 250, () => setStage("pick"));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, reduceMotion]);

  const pick = (cup: number) => {
    if (stage !== "pick") return;
    setPicked(cup);
    setStage("reveal");
    setLifted(new Set([cup]));
    later(900, () => setLifted(new Set([0, 1, 2])));
  };

  const tr = reduceMotion ? { duration: 0.01 } : { type: "spring" as const, stiffness: 260, damping: 24 };
  return (
    <div className="tf-shell-overlay pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-[#070b1a]/55">
      <div className="tf-shell-card rounded-3xl border border-violet-400/30 bg-[#0a0f22]/95 p-4 shadow-2xl sm:p-5">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="font-display text-[12px] tracking-[0.2em] text-violet-300">THE STRANGER'S GAME</span>
          <span className="font-display text-[12px] tracking-[0.12em] text-ivory/60">ROUND {round + 1} / 3</span>
        </div>
        <p className="mb-3 min-h-[2.75rem] text-[clamp(14px,3.6vw,16px)] leading-snug text-ivory/90">
          {stage === "show" && "Watch the pebble…"}
          {stage === "shuffle" && "Keep your eyes on it…"}
          {stage === "pick" && "Which cup hides the pebble? Tap one."}
          {stage === "reveal" && picked !== null && <span className="text-violet-200">“{LINES[Math.min(round, 1)]}”</span>}
        </p>
        <div className="tf-shell-board" role="group" aria-label="Three cups">
          <div className="absolute inset-x-0 bottom-0 h-[8%] rounded-full bg-violet-500/15 blur-sm" />
          {/* pebble (only ever visible during the opening show) */}
          {stage === "show" && (
            <motion.div
              className="absolute bottom-[10%] h-[14%] w-[8%] rounded-[45%] bg-gradient-to-br from-stone-300 to-stone-500"
              style={{ left: `${slotLeft(slots.indexOf(1)) + CUP_W / 2 - 4}%` }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            />
          )}
          {[0, 1, 2].map((cup) => {
            const slot = slots.indexOf(cup);
            const up = lifted.has(cup);
            return (
              <motion.button
                key={cup}
                type="button"
                aria-label={`Cup ${slot + 1}`}
                disabled={stage !== "pick"}
                onClick={() => pick(cup)}
                className="tf-keep absolute bottom-[6%] disabled:cursor-default"
                style={{ width: `${CUP_W}%`, height: "80%", minWidth: 56, minHeight: 56, touchAction: "manipulation" }}
                animate={{ left: `${slotLeft(slot)}%`, y: up ? "-45%" : "0%", rotate: up ? -8 : 0 }}
                transition={tr}
                whileTap={stage === "pick" ? { scale: 0.94 } : undefined}
              >
                <div
                  className={`h-full w-full rounded-t-[48%] rounded-b-md border-2 ${
                    picked === cup ? "border-cyan-300/90" : stage === "pick" ? "border-amber-200/60" : "border-amber-200/30"
                  } bg-gradient-to-b from-[#c0653d] via-[#9a4a2c] to-[#5e2a18] shadow-[inset_0_-10px_18px_rgba(0,0,0,0.35),0_8px_18px_rgba(0,0,0,0.4)]`}
                >
                  <div className="mx-auto mt-[12%] h-[8%] w-[48%] rounded-full bg-white/15" />
                </div>
              </motion.button>
            );
          })}
        </div>
        <div className="mt-3 flex min-h-[3rem] items-center justify-end">
          {stage === "reveal" && (
            <button
              type="button"
              onClick={() => (round === 0 ? setRound(1) : onDone())}
              className="tf-keep min-h-14 min-w-[7.5rem] rounded-xl border border-violet-300/50 bg-violet-500/25 px-5 text-[15px] font-semibold text-violet-50 hover:bg-violet-500/35 active:bg-violet-500/45"
            >
              {round === 0 ? "Again" : "Continue"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
