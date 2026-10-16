// On-screen touch controls: drag joystick (bottom-left), "E" interact + hold-to-sprint (bottom-right).
// Multi-touch safe: the joystick tracks only the pointer that started on it; buttons track their own pointers.
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { Zap } from "lucide-react";
import { joystick, useGame } from "./gameStore";

/** Touch device (coarse pointer / touch events) or a narrow screen. */
export function useAutoTouch() {
  const calc = () =>
    typeof window !== "undefined" &&
    (window.matchMedia?.("(pointer: coarse)").matches || "ontouchstart" in window || window.innerWidth < 900);
  const [v, setV] = useState(calc);
  useEffect(() => {
    const on = () => setV(calc());
    window.addEventListener("resize", on);
    const mq = window.matchMedia("(pointer: coarse)");
    mq.addEventListener("change", on);
    return () => {
      window.removeEventListener("resize", on);
      mq.removeEventListener("change", on);
    };
  }, []);
  return v;
}

export function useTouchVisible() {
  const auto = useAutoTouch();
  const mode = useGame((s) => s.touchMode);
  return mode === "show" || (mode === "auto" && auto);
}


export default function TouchControls() {
  const visible = useTouchVisible();
  const overlay = useGame((s) => s.overlay);
  const pulse = useGame((s) => s.pulseInteract);
  const near = useGame((s) => s.nearStation);
  const knob = useRef<HTMLDivElement>(null);
  const stickId = useRef<number | null>(null);
  const sprintId = useRef<number | null>(null);
  const [sprinting, setSprinting] = useState(false);

  const reset = () => {
    stickId.current = null;
    joystick.x = 0;
    joystick.z = 0;
    joystick.active = false;
    if (knob.current) knob.current.style.transform = "translate(0px, 0px)";
  };
  const stopSprint = () => {
    sprintId.current = null;
    joystick.sprint = false;
    setSprinting(false);
  };
  // release everything when hidden / a panel opens / unmount
  useEffect(() => {
    if (!visible || overlay) {
      reset();
      stopSprint();
    }
  }, [visible, overlay]);
  useEffect(
    () => () => {
      reset();
      joystick.sprint = false;
    },
    [],
  );

  if (!visible || overlay) return null;

  const move = (e: RPointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const R = Math.max(24, r.width * 0.32); // thumb travel scales with the (fluid) joystick size
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > R) {
      dx = (dx / d) * R;
      dy = (dy / d) * R;
    }
    joystick.x = dx / R;
    joystick.z = dy / R;
    joystick.active = true;
    if (knob.current) knob.current.style.transform = `translate(${dx}px, ${dy}px)`;
  };

  return (
    <>
      <div
        className="tf-joy pointer-events-auto absolute z-20 grid select-none place-items-center rounded-full border border-white/20 bg-[#070b1a]/45"
        style={{ touchAction: "none" }}
        onPointerDown={(e) => {
          if (stickId.current !== null) return;
          e.preventDefault();
          stickId.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          move(e);
        }}
        onPointerMove={(e) => {
          if (e.pointerId === stickId.current) move(e);
        }}
        onPointerUp={(e) => e.pointerId === stickId.current && reset()}
        onPointerCancel={(e) => e.pointerId === stickId.current && reset()}
        onLostPointerCapture={(e) => e.pointerId === stickId.current && reset()}
        onContextMenu={(e) => e.preventDefault()}
        role="application"
        aria-label="Movement joystick — drag to walk"
      >
        <div className="pointer-events-none absolute inset-6 rounded-full border border-white/10" />
        <div ref={knob} className="pointer-events-none h-[40%] w-[40%] rounded-full border border-cyan-200/70 bg-cyan-400/30 shadow-[0_0_18px_rgba(56,225,255,0.35)]" />
      </div>
      <div className="tf-acts pointer-events-none absolute z-20 flex items-end gap-3" style={{ touchAction: "none" }}>
        <button
          type="button"
          className={`tf-act-sprint tf-keep pointer-events-auto grid select-none place-items-center rounded-full border font-display text-[10px] tracking-[0.1em] ${
            sprinting ? "border-amber-200 bg-amber-300/40 text-amber-50" : "border-white/25 bg-[#070b1a]/45 text-ivory/85"
          }`}
          style={{ touchAction: "none" }}
          onPointerDown={(e) => {
            e.preventDefault();
            sprintId.current = e.pointerId;
            e.currentTarget.setPointerCapture(e.pointerId);
            joystick.sprint = true;
            setSprinting(true);
          }}
          onPointerUp={(e) => e.pointerId === sprintId.current && stopSprint()}
          onPointerCancel={(e) => e.pointerId === sprintId.current && stopSprint()}
          onLostPointerCapture={(e) => e.pointerId === sprintId.current && stopSprint()}
          onContextMenu={(e) => e.preventDefault()}
          aria-label="Sprint (hold)"
          aria-pressed={sprinting}
        >
          <Zap className="h-4 w-4" />
          SPRINT
        </button>
        <button
          type="button"
          onClick={pulse}
          className={`tf-act-e tf-keep pointer-events-auto grid select-none place-items-center rounded-full border font-display text-xl ${
            near ? "border-cyan-200 bg-cyan-400/35 text-cyan-50 shadow-[0_0_24px_rgba(56,225,255,0.45)]" : "border-white/25 bg-[#070b1a]/45 text-ivory/60"
          }`}
          style={{ touchAction: "manipulation" }}
          aria-label="Interact (E)"
        >
          E
        </button>
      </div>
    </>
  );
}
