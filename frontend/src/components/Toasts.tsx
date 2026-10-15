import { AnimatePresence, motion } from "framer-motion";
import { CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { useTerraform } from "../store/terraformStore";
import { cx } from "./ui";

export default function Toasts() {
  const toasts = useTerraform((s) => s.toasts);
  const dismiss = useTerraform((s) => s.dismissToast);
  return (
    <div className="pointer-events-none fixed bottom-24 right-4 z-[90] flex w-[min(92vw,380px)] flex-col gap-2 lg:bottom-6" aria-live="polite" aria-atomic="false">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40 }}
            className={cx(
              "glass-strong pointer-events-auto flex items-start gap-3 rounded-xl px-4 py-3 text-sm",
              t.kind === "error" && "!border-coral/40",
              t.kind === "success" && "!border-sprout/30",
            )}
            role={t.kind === "error" ? "alert" : "status"}
          >
            {t.kind === "success" ? (
              <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-sprout" aria-hidden />
            ) : t.kind === "error" ? (
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-coral" aria-hidden />
            ) : (
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-cyan" aria-hidden />
            )}
            <span className="flex-1 text-ivory/90">{t.text}</span>
            <button type="button" onClick={() => dismiss(t.id)} className="text-mist hover:text-ivory" aria-label="Dismiss notification">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
