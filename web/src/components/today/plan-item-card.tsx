"use client";

import { Spinner } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { Check } from "@/components/ui/icons";
import { formatTime } from "@/lib/date";
import { formatQuantity } from "@/lib/domain/inventory";
import { cx } from "@/lib/cx";
import type { PlanItem } from "@/lib/types";

export function PlanItemCard({
  item,
  pending,
  timezone,
  onToggle,
}: {
  item: PlanItem;
  pending: boolean;
  timezone: string;
  onToggle: (item: PlanItem) => void;
}) {
  const done = Boolean(item.log);
  const lowStock = !done && !item.stockSufficient;

  return (
    <div
      className={cx(
        "flex items-center gap-3 rounded-[var(--radius-card)] border bg-paper p-3.5 shadow-[var(--shadow-card)] transition-colors",
        done ? "border-sage-600/30 bg-sage-50/60" : "border-line-soft",
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`${done ? "取消" : "記錄"}服用 ${item.supplementName}`}
        disabled={pending}
        onClick={() => onToggle(item)}
        className={cx(
          "flex size-11 shrink-0 items-center justify-center rounded-full border-2 transition-all",
          done
            ? "border-sage-600 bg-sage-600 text-white"
            : "border-line bg-paper text-transparent hover:border-sage-600 active:scale-95",
          pending && "opacity-60",
        )}
      >
        {pending ? <Spinner className={done ? "text-white" : "text-sage-600"} /> : <Check size={22} />}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p
            className={cx(
              "truncate text-[15px] font-bold",
              done ? "text-text-2 line-through decoration-sage-600/50" : "text-ink",
            )}
          >
            {item.supplementName}
          </p>
          {lowStock && <Badge tone="orange">庫存不足</Badge>}
        </div>
        <p className="mt-0.5 text-sm text-text-2">
          <span className="tnum font-bold text-text">
            {formatQuantity(item.dose)} {item.unit}
          </span>
          {item.brand && <span className="ml-2 text-text-3">{item.brand}</span>}
        </p>
        {item.notes && <p className="mt-1 line-clamp-2 text-xs text-text-3">{item.notes}</p>}
      </div>

      {done && item.log?.takenAt && (
        <span className="tnum shrink-0 text-xs font-bold text-sage-700">{formatTime(item.log.takenAt, timezone)}</span>
      )}
    </div>
  );
}
