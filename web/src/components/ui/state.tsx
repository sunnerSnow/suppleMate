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
    <div className="empty mx-5">
      {icon && (
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full border-[3px] border-line bg-bg-2 text-ink">
          {icon}
        </div>
      )}
      <p className="text-lg font-black text-ink">{title}</p>
      {description && <p className="sub-text mx-auto mt-2 max-w-xs leading-relaxed">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="card mx-5 text-center">
      <div className="mx-auto mb-2 text-accent-text">
        <Alert size={30} />
      </div>
      <p className="text-lg font-black text-ink">發生問題</p>
      <p className="sub-text mt-1">{message}</p>
      {onRetry && (
        <Button variant="ghost" size="sm" className="mt-4" onClick={onRetry}>
          再試一次
        </Button>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx("skeleton", className)} />;
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="mx-5 flex flex-col gap-3" aria-busy aria-label="載入中">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="mt-3 h-4 w-2/3" />
          <Skeleton className="mt-2 h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}
