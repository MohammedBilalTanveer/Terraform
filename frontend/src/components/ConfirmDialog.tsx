import { useEffect, useRef, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TriangleAlert } from "lucide-react";

export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "warm",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "warm" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const cancelFn = useRef(onCancel);
  cancelFn.current = onCancel;
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    setTimeout(() => cancelRef.current?.focus(), 20);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && cancelFn.current();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[95] grid place-items-center p-4">
          <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel} aria-hidden />
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className="glass-strong hero-ring relative w-full max-w-md rounded-2xl p-6"
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
          >
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-terracotta/15 text-coral">
                <TriangleAlert className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h2 id="confirm-title" className="font-heading text-lg font-semibold text-ivory">{title}</h2>
                <div className="mt-2 space-y-2 text-sm leading-relaxed text-mist">{children}</div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button ref={cancelRef} type="button" className="btn-ghost" onClick={onCancel}>{cancelLabel}</button>
              <button type="button" className={tone === "warm" ? "btn-warm" : "btn-primary"} onClick={onConfirm}>{confirmLabel}</button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
