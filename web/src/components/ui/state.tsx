import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { Button } from "./button";
import { Alert } from "./icons";

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-line bg-paper/60 px-6 py-12 text-center">
      {icon && (
        <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-sage-50 text-sage-600">
          {icon}
        </div>
      )}
      <p className="text-base font-bold text-ink">{title}</p>
      {description && <p className="mt-2 max-w-xs text-sm leading-relaxed text-text-2">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center rounded-[var(--radius-card)] border border-orange-600/30 bg-orange-50 px-6 py-10 text-center"
    >
      <div className="mb-3 text-orange-600">
        <Alert size={28} />
      </div>
      <p className="font-bold text-ink">發生問題</p>
      <p className="mt-1 text-sm text-text-2">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-5" onClick={onRetry}>
          再試一次
        </Button>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx("animate-pulse rounded-[var(--radius-chip)] bg-cream-deep", className)} />;
}

/** 列表載入中的骨架：三張卡片 */
export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy aria-label="載入中">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-[var(--radius-card)] border border-line-soft bg-paper p-4">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="mt-3 h-4 w-2/3" />
          <Skeleton className="mt-2 h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}
