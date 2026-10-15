import type { ReactNode } from "react";
import { LoaderCircle, RefreshCw, TriangleAlert } from "lucide-react";
import { cx } from "./ui";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton", className)} aria-hidden />;
}

export function SkeletonLines({ lines = 4, className }: { lines?: number; className?: string }) {
  return (
    <div className={cx("space-y-2.5", className)} role="status" aria-label="Loading">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cx("h-4", i % 3 === 2 ? "w-2/3" : i % 2 ? "w-5/6" : "w-full")} />
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={cx("grid gap-4", className)} role="status" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass space-y-3 rounded-2xl p-5">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export function Spinner({ label, className }: { label?: string; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2 text-sm text-mist", className)} role="status">
      <LoaderCircle className="h-4 w-4 animate-spin text-cyan" aria-hidden />
      {label}
    </span>
  );
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  retryLabel = "Retry",
  className,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}) {
  return (
    <div role="alert" className={cx("flex flex-wrap items-start gap-3 rounded-xl border border-coral/35 bg-coral/8 p-4", className)}>
      <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-coral" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="font-heading font-semibold text-rose-100">{title}</div>
        <p className="mt-0.5 text-sm text-rose-100/80">{message}</p>
      </div>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-ghost !py-1.5 text-sm">
          <RefreshCw className="h-4 w-4" aria-hidden /> {retryLabel}
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="glass hero-ring flex flex-col items-center rounded-2xl px-6 py-12 text-center">
      {icon && (
        <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-gradient-to-br from-cyan/15 to-violet/15 text-cyan-100">
          {icon}
        </div>
      )}
      <h3 className="font-heading text-xl font-semibold text-ivory">{title}</h3>
      {body && <div className="mt-2 max-w-md text-mist">{body}</div>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
