// Sleek sci-fi typewriter dialogue box with optional choices. Click / Space / Enter advances.
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { isTypingTarget } from "../game/input";

export type Speaker = "narrator" | "stranger" | "you" | "terra" | "system";

const SPEAKER: Record<Speaker, { name: string; color: string; ring: string }> = {
  narrator: { name: "", color: "text-ivory/70", ring: "border-white/15" },
  stranger: { name: "HOODED STRANGER", color: "text-violet-300", ring: "border-violet-400/40" },
  you: { name: "YOU", color: "text-amber-200", ring: "border-amber-300/40" },
  terra: { name: "TERRA", color: "text-cyan-300", ring: "border-cyan-300/50" },
  system: { name: "SYSTEM", color: "text-emerald-300", ring: "border-emerald-300/40" },
};

export function useTypewriter(text: string, speed: number, instant: boolean, opts?: { skipOnKey?: boolean }) {
  const [n, setN] = useState(instant ? text.length : 0);
  const timer = useRef<number | null>(null);
  const stop = () => {
    if (timer.current !== null) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
  };
  useEffect(() => {
    stop();
    if (instant) {
      setN(text.length);
      return;
    }
    setN(0);
    let i = 0;
    timer.current = window.setInterval(() => {
      i += 1;
      setN(i);
      if (i >= text.length) stop();
    }, speed);
    return stop;
  }, [text, speed, instant]);
  // finishing must also stop the typing timer — otherwise its next tick would overwrite the full sentence
  const finish = useCallback(() => {
    stop();
    setN(text.length);
  }, [text]);
  const done = n >= text.length;
  // optional: Enter / Space completes the sentence (for lines that are not inside a DialogueBox)
  useEffect(() => {
    if (!opts?.skipOnKey || done) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || isTypingTarget(e.target)) return;
      if (e.key === "Enter" || e.code === "Space") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [opts?.skipOnKey, done, finish]);
  return { shown: text.slice(0, n), done, finish };
}

export type Choice = { label: string; value: string };

export default function DialogueBox({
  speaker,
  text,
  choices,
  onNext,
  onChoice,
  reduceMotion,
  autoAdvanceMs = 2600,
}: {
  speaker: Speaker;
  text: string;
  choices?: Choice[];
  onNext?: () => void;
  onChoice?: (value: string) => void;
  reduceMotion: boolean;
  autoAdvanceMs?: number | null;
}) {
  const { shown, done, finish } = useTypewriter(text, 26, reduceMotion);
  const sp = SPEAKER[speaker];
  const nextRef = useRef(onNext);
  nextRef.current = onNext;

  // auto-advance plain lines so the intro flows (~60–90 s watched fully)
  useEffect(() => {
    if (!done || choices?.length || autoAdvanceMs == null) return;
    const t = window.setTimeout(() => nextRef.current?.(), autoAdvanceMs + Math.min(2000, text.length * 12));
    return () => window.clearTimeout(t);
  }, [done, choices, autoAdvanceMs, text]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.code === "Space" || e.key === "Enter") {
        e.preventDefault();
        if (e.repeat) return; // holding the key must not also skip to the next line
        if (!done) finish();
        else if (!choices?.length) nextRef.current?.();
      }
      if (done && choices?.length) {
        const idx = Number(e.key) - 1;
        if (idx >= 0 && idx < choices.length) onChoice?.(choices[idx].value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done, finish, choices, onChoice]);

  return (
    <motion.div
      key={text}
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="tf-dialogue pointer-events-auto absolute z-20 mx-auto max-w-2xl"
    >
      <div
        role="dialog"
        aria-live="polite"
        onClick={() => (!done ? finish() : !choices?.length ? onNext?.() : undefined)}
        className={`tf-dialogue-box relative cursor-pointer rounded-2xl border ${sp.ring} bg-[#070b1a]/92 px-4 py-3 shadow-[0_10px_40px_rgba(0,0,0,0.5)] sm:px-5 sm:py-4`}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />
        {sp.name && <div className={`mb-1 font-display text-[12px] tracking-[0.2em] ${sp.color}`}>{sp.name}</div>}
        <p className={`min-h-[2.5rem] font-heading text-[clamp(14px,3.8vw,16px)] leading-relaxed ${speaker === "narrator" ? "italic text-ivory/80" : "text-ivory"}`}>
          {shown}
          {!done && <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-cyan-300 align-middle" />}
        </p>
        {done && choices?.length ? (
          <div className="mt-3 flex flex-col gap-2 min-[560px]:flex-row">
            {choices.map((c, i) => (
              <button
                key={c.value}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChoice?.(c.value);
                }}
                className="tf-keep min-h-12 flex-1 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-left text-[14px] text-ivory hover:border-cyan-300/60 hover:bg-cyan-400/10 active:bg-cyan-400/20"
              >
                <span className="mr-2 font-display text-[12px] text-cyan-300">{i + 1}</span>
                {c.label}
              </button>
            ))}
          </div>
        ) : done ? (
          <div className="mt-1 text-right font-display text-[12px] tracking-[0.2em] text-ivory/55">TAP ▸</div>
        ) : null}
      </div>
    </motion.div>
  );
}
