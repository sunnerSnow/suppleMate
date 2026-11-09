"use client";

import { Spinner } from "@/components/ui/button";
import { Badge, Cat } from "@/components/ui/card";
import { Check } from "@/components/ui/icons";
import { cx } from "@/lib/cx";
import { formatTime } from "@/lib/date";
import { formatQuantity } from "@/lib/domain/inventory";
import type { PlanItem } from "@/lib/types";

/** 今日頁的一列：類別膠囊＋名稱＋右側勾選圈（A 條列式／B 卡內列） */
export function PlanItemCard({
  item,
  pending,
  timezone,
  category,
  onToggle,
}: {
  item: PlanItem;
  pending: boolean;
  timezone: string;
  /** 小知識給的類別（隨餐／空腹）；沒有就不顯示 */
  category?: string;
  onToggle: (item: PlanItem) => void;
}) {
  const done = Boolean(item.log);
  const lowStock = !done && !item.stockSufficient;

  return (
    <div className={cx("item", done && "done")}>
      {category && <Cat>{category}</Cat>}
      <div className="item-name">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {item.supplementName}
          {lowStock && <Badge tone="out">庫存不足</Badge>}
        </span>
        <small>
          <span className="tnum">{formatQuantity(item.dose)}</span> {item.unit}
          {item.brand && ` · ${item.brand}`}
          {done && item.log?.takenAt && ` · ${formatTime(item.log.takenAt, timezone)}`}
        </small>
      </div>
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`${done ? "取消" : "記錄"}服用 ${item.supplementName}`}
        disabled={pending}
        onClick={() => onToggle(item)}
        className={cx("check", done && "on")}
      >
        {pending ? <Spinner className="text-ink" /> : <Check size={22} />}
      </button>
    </div>
  );
}
