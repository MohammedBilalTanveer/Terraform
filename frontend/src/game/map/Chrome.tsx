// Map chrome: compass rose, scale bar, legend popover, corner brackets.
import { Check, Lock } from "lucide-react";

export function Compass() {
  return (
    <svg className="tf-wm-compass pointer-events-none absolute left-2.5 top-2.5 z-10" width={58} height={58} viewBox="-29 -29 58 58" aria-hidden>
      <circle r={26} fill="#0a1124" fillOpacity={0.72} stroke="#38e1ff" strokeOpacity={0.4} strokeWidth={1.2} />
      <circle r={20} fill="none" stroke="#fff" strokeOpacity={0.14} strokeWidth={1} strokeDasharray="2 3" />
      <path d="M0,-19 L4.5,0 L0,-3 L-4.5,0 Z" fill="#38e1ff" />
      <path d="M0,19 L4.5,0 L0,3 L-4.5,0 Z" fill="#f4efe6" fillOpacity={0.55} />
      <path d="M-19,0 L0,-3.5 L0,3.5 Z M19,0 L0,-3.5 L0,3.5 Z" fill="#f4efe6" fillOpacity={0.3} />
      <text y={-21.5} textAnchor="middle" fontSize={11} fontWeight={800} fontFamily="Orbitron, sans-serif" fill="#fff" stroke="#0a1124" strokeWidth={3} paintOrder="stroke">
        N
      </text>
    </svg>
  );
}

const NICE = [5, 10, 20, 50, 100];
export function ScaleBar({ s }: { s: number }) {
  const m = NICE.find((n) => n * s >= 56) ?? 100;
  const w = Math.round(m * s);
  return (
    <div className="pointer-events-none absolute bottom-2.5 left-3 z-10 select-none" aria-hidden>
      <div className="font-display text-[11px] font-bold tracking-widest text-ivory [text-shadow:0_1px_3px_#000,0_0_6px_#000]">{m} m</div>
      <div className="relative mt-0.5 h-2" style={{ width: w }}>
        <div className="absolute inset-x-0 bottom-0 h-[3px] rounded bg-ivory shadow-[0_0_0_1px_rgba(5,8,20,0.8)]" />
        <div className="absolute bottom-0 left-0 h-2 w-[3px] rounded bg-ivory shadow-[0_0_0_1px_rgba(5,8,20,0.8)]" />
        <div className="absolute bottom-0 right-0 h-2 w-[3px] rounded bg-ivory shadow-[0_0_0_1px_rgba(5,8,20,0.8)]" />
        <div className="absolute bottom-0 left-1/2 h-1.5 w-[2px] -translate-x-1/2 bg-ivory" />
      </div>
    </div>
  );
}

export function Corners() {
  const c = "pointer-events-none absolute z-10 h-4 w-4 border-cyan-300/70";
  return (
    <>
      <span className={`${c} left-1 top-1 rounded-tl-md border-l-2 border-t-2`} aria-hidden />
      <span className={`${c} right-1 top-1 rounded-tr-md border-r-2 border-t-2`} aria-hidden />
      <span className={`${c} bottom-1 left-1 rounded-bl-md border-b-2 border-l-2`} aria-hidden />
      <span className={`${c} bottom-1 right-1 rounded-br-md border-b-2 border-r-2`} aria-hidden />
    </>
  );
}

function Swatch({ children }: { children: React.ReactNode }) {
  return <span className="grid h-7 w-7 shrink-0 place-items-center">{children}</span>;
}

export function Legend({ onClose }: { onClose: () => void }) {
  const row = "flex items-center gap-2.5 py-1 text-[12px] leading-tight text-ivory/85";
  return (
    <div
      className="pointer-events-auto absolute right-[3.75rem] top-2.5 z-30 max-h-[calc(100%-1.25rem)] w-[min(240px,calc(100%-4.75rem))] overflow-y-auto rounded-2xl border border-cyan-300/30 bg-[#0a1124]/96 p-3 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.85)]"
      role="group"
      aria-label="Map legend"
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="font-display text-[11px] tracking-[0.24em] text-cyan-300">LEGEND</span>
        <button type="button" onClick={onClose} className="min-h-11 rounded-md px-3 text-[12px] text-ivory/70 hover:bg-white/10">
          Close
        </button>
      </div>
      <div className={row}>
        <Swatch>
          <svg width={22} height={22} viewBox="-11 -11 22 22" aria-hidden>
            <circle r={10} fill="#38e1ff" fillOpacity={0.25} />
            <path d="M0,-8 L5.5,6 L0,3 L-5.5,6 Z" fill="#fff" stroke="#06202a" strokeWidth={1.4} strokeLinejoin="round" />
          </svg>
        </Swatch>
        You, and the way you face
      </div>
      <div className={row}>
        <Swatch>
          <span className="block h-5 w-5 rounded-full border-2 border-cyan-300 shadow-[0_0_8px_#38e1ff]" />
        </Swatch>
        Next quest location
      </div>
      <div className={row}>
        <Swatch>
          <span className="grid h-5 w-5 place-items-center rounded-full bg-[#46c37b] text-[#06210f]">
            <Check className="h-3 w-3" strokeWidth={3.4} aria-hidden />
          </span>
        </Swatch>
        Everything here is done
      </div>
      <div className={row}>
        <Swatch>
          <span className="grid h-5 w-5 place-items-center rounded-full bg-[#f6c177] text-[11px] font-extrabold text-[#2a1a05]">2</span>
        </Swatch>
        Steps still to do here
      </div>
      <div className={row}>
        <Swatch>
          <span className="grid h-5 w-5 place-items-center rounded-full bg-[#3a4258] text-white">
            <Lock className="h-3 w-3" strokeWidth={2.6} aria-hidden />
          </span>
        </Swatch>
        Locked until something else is done
      </div>
      <div className={row}>
        <Swatch>
          <svg width={26} height={10} viewBox="0 0 26 10" aria-hidden>
            <path d="M1,5 L25,5" stroke="#38e1ff" strokeWidth={2.4} strokeDasharray="5 4" strokeLinecap="round" />
          </svg>
        </Swatch>
        Route to the next location
      </div>
      <div className={row}>
        <Swatch>
          <svg width={26} height={10} viewBox="0 0 26 10" aria-hidden>
            <path d="M1,5 L25,5" stroke="#f3dcbc" strokeWidth={2} strokeDasharray="0.1 5" strokeLinecap="round" />
          </svg>
        </Swatch>
        Walking trails
      </div>
      <div className={row}>
        <Swatch>
          <svg width={26} height={12} viewBox="0 0 26 12" aria-hidden>
            <path d="M1,6 Q7,1 13,6 T25,6" stroke="#7a3a22" strokeWidth={6} fill="none" strokeLinecap="round" />
            <path d="M1,6 Q7,1 13,6 T25,6" stroke="#bfe6f2" strokeWidth={1.4} strokeDasharray="3 3" fill="none" strokeLinecap="round" />
          </svg>
        </Swatch>
        Dry runoff channel
      </div>
    </div>
  );
}
