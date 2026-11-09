"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";
import { RestockDialog } from "@/components/inventory/restock-dialog";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { BoxIcon, Plus } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/state";
import type { Tone } from "@/components/ui/tone";
import { STOCK_STATUS_LABELS } from "@/lib/constants";
import { dailyConsumption, estimateDaysLeft, formatQuantity, stockStatus } from "@/lib/domain/inventory";
import { useStore } from "@/lib/store/store-provider";
import type { StockStatus, Supplement } from "@/lib/types";

const TONE: Record<StockStatus, Tone> = { sufficient: "green", low: "orange", out: "red" };
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
      <PageHeader
        tone="orange"
        eyebrow="Inventory"
        title="庫存"
        description={
          rows.length === 0
            ? undefined
            : needAttention === 0
              ? "庫存都還充足。"
              : `${needAttention} 項需要補貨或即將用完。`
        }
      />

      {store.status === "loading" && <ListSkeleton />}
      {store.status === "error" && <ErrorState message={store.error ?? "載入失敗"} onRetry={store.retry} />}

      {store.status === "ready" && rows.length === 0 && (
        <EmptyState
          tone="orange"
          icon={<BoxIcon size={32} />}
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
        <ul className="stagger flex flex-col gap-3">
          {rows.map(({ s, status, days, perDay }, i) => (
            <li key={s.id} style={{ "--i": i } as CSSProperties}>
              <Card className={status === "out" ? "border-red/40" : status === "low" ? "border-orange/50" : undefined}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/supplements/${s.id}`}
                      className="block truncate text-base font-bold text-ink hover:underline"
                    >
                      {s.name}
                    </Link>
                    {s.brand && <p className="text-xs text-text-3">{s.brand}</p>}
                  </div>
                  <Badge tone={TONE[status]}>{STOCK_STATUS_LABELS[status]}</Badge>
                </div>

                <div className="mt-3 flex items-end justify-between gap-3">
                  <p className="leading-none text-ink">
                    <span className="font-en tnum text-3xl font-bold">{formatQuantity(s.stockQuantity)}</span>
                    <span className="ml-1.5 text-sm font-bold text-text-2">{s.doseUnit}</span>
                  </p>
                  <p className="tnum text-right text-sm text-text-2">
                    {days === null ? (
                      <span className="text-text-3">尚無法估算</span>
                    ) : (
                      <>
                        預估剩{" "}
                        <span className={`font-en text-lg font-bold ${days <= 7 ? "text-red-text" : "text-ink"}`}>
                          {days}
                        </span>{" "}
                        天
                      </>
                    )}
                  </p>
                </div>

                <StockBar quantity={s.stockQuantity} threshold={s.lowStockThreshold} perDay={perDay} status={status} />

                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-text-3">
                  <span className="tnum">
                    門檻 {formatQuantity(s.lowStockThreshold)} {s.doseUnit}
                    {perDay > 0 && ` · 每日約 ${formatQuantity(perDay)} ${s.doseUnit}`}
                  </span>
                  <Button
                    size="sm"
                    variant={status === "sufficient" ? "outline" : "primary"}
                    onClick={() => setRestockTarget(s)}
                  >
                    補貨
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <RestockDialog supplement={restockTarget} onClose={() => setRestockTarget(null)} />
    </div>
  );
}

/** 庫存長條：以「門檻 × 3 或 30 天用量」當滿格基準，門檻位置畫一條記號。 */
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
  const color = status === "out" ? "bg-red" : status === "low" ? "bg-orange" : "bg-green";
  return (
    <div className="relative mt-3 h-3 rounded-full border border-line bg-cream" aria-hidden>
      <div
        className={`h-full rounded-full transition-[width] duration-700 ease-out ${color}`}
        style={{ width: `${pct}%` }}
      />
      {threshold > 0 && (
        <span
          className="absolute top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-ink/40"
          style={{ left: `${thresholdPct}%` }}
        />
      )}
    </div>
  );
}
