"use client";

import { Spinner } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { Check } from "@/components/ui/icons";
import { cx } from "@/lib/cx";
import { formatTime } from "@/lib/date";
import { formatQuantity } from "@/lib/domain/inventory";
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
        "flex items-center gap-3 rounded-[var(--radius-card)] border-2 bg-white p-3 pr-4 transition-colors duration-300",
        done
          ? "border-green bg-green-soft shadow-[0_3px_0_0_var(--green)]"
          : "border-line shadow-[0_3px_0_0_var(--line)]",
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
          "flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full border-[3px] transition-[background-color,border-color,transform] duration-200",
          done
            ? "border-green-deep bg-green-deep text-white"
            : "border-line-ui bg-white text-transparent hover:border-green active:scale-90",
          pending && "opacity-60",
          "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus",
        )}
      >
        {pending ? (
          <Spinner className={done ? "text-white" : "text-green-deep"} />
        ) : (
          <Check size={24} className={done ? "animate-pop" : undefined} />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className={cx("truncate text-base font-bold", done ? "text-green-text" : "text-ink")}>
            {item.supplementName}
          </p>
          {lowStock && <Badge tone="red">庫存不足</Badge>}
        </div>
        <p className="mt-0.5 text-sm text-text-2">
          <span className="font-en tnum text-base font-semibold text-ink">{formatQuantity(item.dose)}</span>
          <span className="ml-1 font-bold text-ink">{item.unit}</span>
          {item.brand && <span className="ml-2 text-text-3">{item.brand}</span>}
        </p>
        {item.notes && <p className="mt-1 line-clamp-2 text-xs text-text-3">{item.notes}</p>}
      </div>

      {done && item.log?.takenAt && (
        <span className="font-en tnum shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-green-text">
          {formatTime(item.log.takenAt, timezone)}
        </span>
      )}
    </div>
  );
}
