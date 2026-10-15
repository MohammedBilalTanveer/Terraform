// TERRA·AI robot avatar — pure SVG, no external assets.
import { cx } from "./ui";

export default function RobotAvatar({ size = 56, thinking = false, className }: { size?: number; thinking?: boolean; className?: string }) {
  return (
    <span className={cx("relative inline-grid shrink-0 place-items-center", className)} style={{ width: size, height: size }}>
      <span className="animate-pulse-soft absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan/40 via-violet/30 to-fuchsia-500/20 blur-md" aria-hidden />
      <svg viewBox="0 0 64 64" width={size} height={size} role="img" aria-label="TERRA·AI assistant robot" className="relative">
        <defs>
          <linearGradient id="ta-shell" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#1b2750" />
            <stop offset="1" stopColor="#0d1428" />
          </linearGradient>
          <linearGradient id="ta-rim" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#38e1ff" />
            <stop offset="1" stopColor="#8b5cf6" />
          </linearGradient>
          <radialGradient id="ta-eye" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#e6fbff" />
            <stop offset="0.5" stopColor="#38e1ff" />
            <stop offset="1" stopColor="#38e1ff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <line x1="32" y1="6" x2="32" y2="13" stroke="url(#ta-rim)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="32" cy="5" r="3" fill="#ff8a7a">
          <animate attributeName="opacity" values="1;0.35;1" dur={thinking ? "0.7s" : "2.4s"} repeatCount="indefinite" />
        </circle>
        <rect x="9" y="13" width="46" height="38" rx="13" fill="url(#ta-shell)" stroke="url(#ta-rim)" strokeWidth="2" />
        <rect x="15" y="21" width="34" height="18" rx="9" fill="#070b1a" stroke="rgba(56,225,255,0.35)" />
        <g>
          <circle cx="25" cy="30" r="5.5" fill="url(#ta-eye)" />
          <circle cx="39" cy="30" r="5.5" fill="url(#ta-eye)" />
          <circle cx="25" cy="30" r="2" fill="#f4efe6" />
          <circle cx="39" cy="30" r="2" fill="#f4efe6" />
          <animateTransform attributeName="transform" type="translate" values="0 0; 1.2 0; 0 0; -1.2 0; 0 0" dur={thinking ? "1.2s" : "6s"} repeatCount="indefinite" />
        </g>
        <path d="M24 45 Q32 49 40 45" stroke="#38e1ff" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.8" />
        <rect x="4" y="27" width="5" height="10" rx="2.5" fill="#8b5cf6" opacity="0.8" />
        <rect x="55" y="27" width="5" height="10" rx="2.5" fill="#8b5cf6" opacity="0.8" />
        <rect x="22" y="53" width="20" height="6" rx="3" fill="#1b2750" stroke="rgba(139,92,246,0.5)" />
      </svg>
    </span>
  );
}
