import { House, LayoutDashboard, Mountain } from "lucide-react";
import type { AppMode } from "../types/terraform";
import { useTerraform } from "../store/terraformStore";
import { cx } from "./ui";

/** Opens the 3D Explorer (or its intro the first time). State is shared via the store. */
export function EnterValleyButton({ className, label = "Enter 3D Valley" }: { className?: string; label?: string }) {
  const setMode = useTerraform((s) => s.setMode);
  const introSeen = useTerraform((s) => s.introSeen);
  return (
    <button type="button" onClick={() => setMode(introSeen ? "explorer" : "intro")} aria-label={label} className={cx("btn-warm !px-3 !py-2 text-sm sm:!px-3.5", className)}>
      <Mountain className="h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

export default function ModeSwitcher({ className }: { className?: string }) {
  const mode = useTerraform((s) => s.mode);
  const setMode = useTerraform((s) => s.setMode);
  const items: { id: AppMode; label: string; icon: typeof House }[] = [
    { id: "landing", label: "Home", icon: House },
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  ];
  return (
    <nav aria-label="Switch mode" className={cx("flex items-center gap-2", className)}>
      <div className="flex rounded-xl border border-white/10 bg-white/[0.03] p-0.5">
        {items.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            aria-label={label}
            aria-current={mode === id ? "page" : undefined}
            className={cx(
              "flex items-center gap-1.5 rounded-[0.6rem] px-2.5 py-1.5 font-heading text-sm transition-colors",
              mode === id ? "bg-white/10 text-ivory" : "text-mist hover:text-ivory",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>
      <EnterValleyButton />
    </nav>
  );
}
