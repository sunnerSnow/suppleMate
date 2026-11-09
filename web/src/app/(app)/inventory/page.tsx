"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { RestockDialog } from "@/components/inventory/restock-dialog";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { Dots } from "@/components/ui/decor";
import { BoxIcon, Plus } from "@/components/ui/icons";
import { AppTop, PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/state";
import { STOCK_STATUS_LABELS } from "@/lib/constants";
import { cx } from "@/lib/cx";
import { dailyConsumption, estimateDaysLeft, formatQuantity, stockStatus } from "@/lib/domain/inventory";
import { useStore } from "@/lib/store/store-provider";
import type { StockStatus, Supplement } from "@/lib/types";

const TONE: Record<StockStatus, "ok" | "low" | "out"> = { sufficient: "ok", low: "low", out: "out" };
const ORDER: Record<StockStatus, number> = { out: 0, low: 1, sufficient: 2 };

export default function InventoryPage() {
  const store = useStore();
  const [restockTarget, setRestockTarget] = useState<Supplement | null>(null);

  const rows = useMemo(
    () =>
      store.supplements
        .filter((s) => s.status === "active")
        .map((s) => ({ s, status: stockStatus(s), days: estimateDaysLeft(s), perDay: dailyConsumption(s) }))
        .sort((a, b) => ORDER[a.status] - ORDER[b.status] || (a.days ?? Infinity) - (b.days ?? Infinity)),
    [store.supplements],
  );
  const needAttention = rows.filter((r) => r.status !== "sufficient").length;

  return (
    <div className="animate-fade-up">
      <AppTop />
      <PageHeader
        eyebrow="Stock"
        title={
          <>
            <span className="dot-h">庫存</span>與補貨
          </>
        }
        description={
          rows.length === 0
            ? undefined
            : needAttention === 0
              ? "庫存都還充足。"
              : `${needAttention} 項需要補貨或即將用完。`
        }
      />
      <Dots className="mx-5 mb-3" />

      {store.status === "loading" && <ListSkeleton />}
      {store.status === "error" && <ErrorState message={store.error ?? "載入失敗"} onRetry={store.retry} />}

      {store.status === "ready" && rows.length === 0 && (
        <EmptyState
          icon={<BoxIcon size={30} />}
          title="還沒有可追蹤的庫存"
          description="新增保健品並填入目前數量，這裡就會顯示剩餘量與預估天數。"
          action={
            <ButtonLink href="/supplements/new">
              <Plus size={18} />
              新增保健品
            </ButtonLink>
          }
        />
      )}

      {store.status === "ready" && rows.length > 0 && (
        <ul className="mx-5 flex flex-col gap-4">
          {rows.map(({ s, status, days, perDay }, i) => (
            <li key={s.id} className={cx("card", i % 2 === 1 && "alt")}>
              <div className="card-head">
                <h2 className="h2">
                  <span className="en">
                    {status === "sufficient" ? "Stock OK" : status === "low" ? "Running low" : "Out of stock"}
                  </span>
                  <Link href={`/supplements/${s.id}`} className="hover:underline">
                    {s.name}
                  </Link>
                </h2>
                <Badge tone={TONE[status]}>{STOCK_STATUS_LABELS[status]}</Badge>
              </div>
              <div className="flex items-end justify-between gap-3">
                <p className="m-0 leading-none">
                  <span className="tnum text-3xl font-black text-ink">{formatQuantity(s.stockQuantity)}</span>
                  <span className="ml-1.5 text-sm font-black text-text-2">{s.doseUnit}</span>
                </p>
                <p className="m-0 text-right text-xs text-text-2">
                  {days === null ? (
                    "尚無法估算"
                  ) : (
                    <>
                      預估剩{" "}
                      <span className={cx("tnum text-lg font-black", days <= 7 ? "text-accent-text" : "text-ink")}>
                        {days}
                      </span>{" "}
                      天
                    </>
                  )}
                </p>
              </div>
              <StockBar quantity={s.stockQuantity} threshold={s.lowStockThreshold} perDay={perDay} status={status} />
              <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-text-3">
                <span className="tnum">
                  門檻 {formatQuantity(s.lowStockThreshold)} {s.doseUnit}
                  {perDay > 0 && ` · 每日約 ${formatQuantity(perDay)} ${s.doseUnit}`}
                </span>
                <Button
                  size="sm"
                  variant={status === "sufficient" ? "ghost" : "accent"}
                  onClick={() => setRestockTarget(s)}
                >
                  補貨
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <RestockDialog supplement={restockTarget} onClose={() => setRestockTarget(null)} />
    </div>
  );
}

/** 庫存長條：以「門檻 × 3 或 30 天用量」當滿格基準，門檻位置畫一條記號 */
function StockBar({
  quantity,
  threshold,
  perDay,
  status,
}: {
  quantity: number;
  threshold: number;
  perDay: number;
  status: StockStatus;
}) {
  const full = Math.max(threshold * 3, perDay * 30, quantity, 1);
  const pct = Math.max(0, Math.min(100, (quantity / full) * 100));
  const thresholdPct = Math.min(100, (threshold / full) * 100);
  const color = status === "out" ? "bg-accent" : status === "low" ? "bg-accent-2" : "bg-accent-2";
  return (
    <div className="relative mt-3 h-3 rounded-full border-2 border-line bg-surface" aria-hidden>
      <div
        className={cx("h-full rounded-full transition-[width] duration-700 ease-out", color)}
        style={{ width: `${pct}%` }}
      />
      {threshold > 0 && (
        <span
          className="absolute top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-line"
          style={{ left: `${thresholdPct}%` }}
        />
      )}
    </div>
  );
}
