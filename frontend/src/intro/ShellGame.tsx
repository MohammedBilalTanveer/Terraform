// Three-cup shell game. It is rigged: whichever cup you pick is empty — the pebble is palmed.
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

type Stage = "show" | "shuffle" | "pick" | "reveal";

const LINES = [
  "Empty. Unlucky. Best of three — again.",
  "Empty again. Oh dear. Looking for this? It was never under a cup.",
];

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

  const W = 120;
  return (
    <div className="pointer-events-auto absolute inset-0 z-20 grid place-items-center bg-[#070b1a]/55 backdrop-blur-[2px]">
      <div className="w-[min(520px,calc(100vw-2rem))] rounded-3xl border border-violet-400/30 bg-[#0a0f22]/90 p-5 shadow-2xl">
        <div className="mb-1 flex items-center justify-between">
          <span className="font-display text-[10px] tracking-[0.3em] text-violet-300">THE STRANGER'S GAME</span>
          <span className="font-display text-[10px] tracking-[0.2em] text-ivory/50">ROUND {round + 1} / 3</span>
        </div>
        <p className="mb-4 min-h-[2.5rem] text-[14px] text-ivory/85">
          {stage === "show" && "Watch the pebble…"}
          {stage === "shuffle" && "Keep your eyes on it…"}
          {stage === "pick" && "Which cup hides the pebble? Pick one."}
          {stage === "reveal" && picked !== null && <span className="text-violet-200">“{LINES[Math.min(round, 1)]}”</span>}
        </p>
        <div className="relative mx-auto h-40" style={{ width: W * 3 }}>
          {/* table */}
          <div className="absolute inset-x-0 bottom-2 h-3 rounded-full bg-violet-500/10 blur-sm" />
          {/* pebble (only ever visible during the opening show) */}
          {stage === "show" && (
            <motion.div
              className="absolute bottom-6 h-5 w-6 rounded-[45%] bg-gradient-to-br from-stone-300 to-stone-500"
              style={{ left: slots.indexOf(1) * W + W / 2 - 12 }}
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
                className="absolute bottom-4 h-28 w-24 disabled:cursor-default"
                animate={{ x: slot * W + (W - 96) / 2, y: up ? -56 : 0, rotate: up ? -8 : 0 }}
                transition={reduceMotion ? { duration: 0.01 } : { type: "spring", stiffness: 260, damping: 24 }}
                whileHover={stage === "pick" ? { y: -6 } : undefined}
              >
                <div
                  className={`h-full w-full rounded-t-[48%] rounded-b-md border ${
                    picked === cup ? "border-cyan-300/80" : "border-amber-200/30"
                  } bg-gradient-to-b from-[#c0653d] via-[#9a4a2c] to-[#5e2a18] shadow-[inset_0_-10px_18px_rgba(0,0,0,0.35),0_8px_18px_rgba(0,0,0,0.4)]`}
                >
                  <div className="mx-auto mt-3 h-2 w-12 rounded-full bg-white/15" />
                </div>
              </motion.button>
            );
          })}
        </div>
        <div className="mt-4 flex min-h-[2.25rem] items-center justify-end">
          {stage === "reveal" && (
            <button
              type="button"
              onClick={() => (round === 0 ? setRound(1) : onDone())}
              className="rounded-xl border border-violet-300/50 bg-violet-500/20 px-4 py-1.5 text-[13px] font-semibold text-violet-50 hover:bg-violet-500/30"
            >
              {round === 0 ? "Again" : "Continue"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
