// Lightweight accordion: closed panels are NOT rendered, so long reference lists stay short in the DOM and on screen.
// `single` keeps one item open at a time. No backdrop-filter anywhere in here (tall scroll areas can paint blank on some GPUs).
import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cx } from "./ui";

export type AccordionItem = {
  id: string;
  title: ReactNode;
  /** small text under the title when closed */
  subtitle?: ReactNode;
  /** right-aligned badges / status */
  meta?: ReactNode;
  icon?: ReactNode;
  content: ReactNode;
  /** marks the row for the "resume where you left off" highlight */
  incomplete?: boolean;
};

export default function Accordion({
  items,
  defaultOpenId = null,
  single = true,
  className,
}: {
  items: AccordionItem[];
  defaultOpenId?: string | null;
  single?: boolean;
  className?: string;
}) {
  const [openIds, setOpenIds] = useState<string[]>(defaultOpenId ? [defaultOpenId] : []);
  const toggle = (id: string) =>
    setOpenIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : single ? [id] : [...cur, id]));

  return (
    <ul className={cx("grid gap-2", className)}>
      {items.map((it) => {
        const open = openIds.includes(it.id);
        return (
          <li key={it.id} id={`acc-${it.id}`} data-incomplete={it.incomplete ? "true" : undefined} className={cx("glass scroll-mt-28 rounded-2xl", open && "!border-cyan/25")}>
            <button
              type="button"
              onClick={() => toggle(it.id)}
              aria-expanded={open}
              aria-controls={`acc-panel-${it.id}`}
              className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left"
            >
              {it.icon && <span className="shrink-0 text-cyan-200">{it.icon}</span>}
              <span className="min-w-0 flex-1">
                <span className="block font-heading font-semibold text-ivory">{it.title}</span>
                {it.subtitle && !open && <span className="mt-0.5 block text-sm text-mist">{it.subtitle}</span>}
              </span>
              {it.meta && <span className="hidden shrink-0 sm:block">{it.meta}</span>}
              <ChevronDown className={cx("h-4 w-4 shrink-0 text-mist transition-transform", open && "rotate-180")} aria-hidden />
            </button>
            {open && (
              <div id={`acc-panel-${it.id}`} className="border-t border-white/8 px-4 pb-4 pt-3">
                {it.content}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Section-level collapse: a header row that folds a whole list away (children are not rendered while closed). */
export function CollapsibleSection({
  title,
  eyebrow,
  icon,
  count,
  defaultOpen = false,
  children,
  id,
}: {
  title: ReactNode;
  eyebrow?: string;
  icon?: ReactNode;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
  id?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section aria-label={typeof title === "string" ? title : undefined} id={id}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mb-3 flex min-h-12 w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left hover:border-white/20"
      >
        {icon && <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-cyan-200">{icon}</span>}
        <span className="min-w-0 flex-1">
          {eyebrow && <span className="eyebrow block">{eyebrow}</span>}
          <span className="block font-heading text-lg font-semibold text-ivory">{title}</span>
        </span>
        {typeof count === "number" && <span className="rounded-full border border-white/12 px-2.5 py-0.5 font-heading text-xs text-mist">{count}</span>}
        <ChevronDown className={cx("h-5 w-5 shrink-0 text-mist transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && children}
    </section>
  );
}
