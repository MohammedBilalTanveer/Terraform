// Narrow-screen header menu: Home / Dashboard / 3D Valley / Restart collapse into one button.
// The panel stays mounted (hidden) so RestartButton's confirmation dialog survives the menu closing.
import { useEffect, useRef, useState } from "react";
import { House, LayoutDashboard, Menu, Mountain, X } from "lucide-react";
import { useTerraform } from "../store/terraformStore";
import RestartButton from "./RestartButton";
import { cx } from "./ui";

export default function HeaderMenu({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const mode = useTerraform((s) => s.mode);
  const setMode = useTerraform((s) => s.setMode);
  const introSeen = useTerraform((s) => s.introSeen);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const go = (fn: () => void) => {
    fn();
    setOpen(false);
  };
  const item = "flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left font-heading text-sm transition-colors";

  return (
    <div ref={ref} className={cx("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="header-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        className="btn-ghost !h-11 !w-11 !p-0"
      >
        {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
      </button>
      <div
        id="header-menu"
        className={cx("glass-strong absolute right-0 top-[calc(100%+0.5rem)] z-50 w-64 space-y-1 rounded-2xl p-2", !open && "hidden")}
        role="menu"
      >
        <button type="button" role="menuitem" className={cx(item, mode === "landing" ? "bg-white/10 text-ivory" : "text-mist hover:bg-white/5 hover:text-ivory")} onClick={() => go(() => setMode("landing"))}>
          <House className="h-4 w-4" aria-hidden /> Home
        </button>
        <button type="button" role="menuitem" className={cx(item, mode === "dashboard" ? "bg-white/10 text-ivory" : "text-mist hover:bg-white/5 hover:text-ivory")} onClick={() => go(() => setMode("dashboard"))}>
          <LayoutDashboard className="h-4 w-4" aria-hidden /> Field Dashboard
        </button>
        <button type="button" role="menuitem" className={cx(item, "text-orange-100 hover:bg-coral/10")} onClick={() => go(() => setMode(introSeen ? "explorer" : "intro"))}>
          <Mountain className="h-4 w-4" aria-hidden /> Enter 3D Valley
        </button>
        <div className="my-1 h-px bg-white/10" aria-hidden />
        <RestartButton variant="menu" className="min-h-11" />
      </div>
    </div>
  );
}
