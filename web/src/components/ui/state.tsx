import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { Button } from "./button";
import { Blob, Cloud } from "./decor";
import { Alert } from "./icons";
import { TONE_SOFT, TONE_TEXT, type Tone } from "./tone";

export function EmptyState({
  title,
  description,
  action,
  icon,
  tone = "sky",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="relative overflow-hidden rounded-[var(--radius-card)] border-2 border-dashed border-line-strong bg-white px-6 py-12 text-center">
      <Cloud className="animate-drift absolute -left-4 top-5 w-20 text-cream" />
      <Cloud className="animate-drift absolute -right-6 bottom-6 w-24 text-cream [animation-delay:-3s]" />
      <div className="relative flex flex-col items-center">
        {icon && (
          <div className="relative mb-4 flex size-20 items-center justify-center">
            <Blob className={cx("animate-float absolute inset-0 size-20", TONE_TEXT[tone], "opacity-20")} />
            <span className={cx("relative", TONE_TEXT[tone])}>{icon}</span>
          </div>
        )}
        <p className="text-lg font-bold text-ink">{title}</p>
        {description && <p className="mt-2 max-w-xs text-sm leading-relaxed text-text-2">{description}</p>}
        {action && <div className="mt-6">{action}</div>}
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center rounded-[var(--radius-card)] border-2 border-red/40 bg-red-soft px-6 py-10 text-center"
    >
      <div className="mb-3 text-red-text">
        <Alert size={30} />
      </div>
      <p className="text-lg font-bold text-ink">發生問題</p>
      <p className="mt-1 text-sm text-text-2">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-5" onClick={onRetry}>
          再試一次
        </Button>
      )}
    </div>
  );
}

export function Skeleton({ className, tone = "neutral" }: { className?: string; tone?: Tone }) {
  return <div aria-hidden className={cx("animate-pulse rounded-[var(--radius-chip)]", TONE_SOFT[tone], className)} />;
}

/** 列表載入中的骨架 */
export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy aria-label="載入中">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-[var(--radius-card)] border-2 border-line bg-white p-4">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="mt-3 h-4 w-2/3" />
          <Skeleton className="mt-2 h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}
