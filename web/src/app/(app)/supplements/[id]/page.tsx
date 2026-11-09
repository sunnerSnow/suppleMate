"use client";

import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { RestockDialog } from "@/components/inventory/restock-dialog";
import { Button, ButtonLink, IconButton } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { ChevronLeft, Pencil } from "@/components/ui/icons";
import { Eyebrow } from "@/components/ui/page-header";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import type { Tone } from "@/components/ui/tone";
import { PRODUCT_FORM_LABELS, SLOT_LABELS, STOCK_STATUS_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/date";
import { dailyConsumption, estimateDaysLeft, formatQuantity, stockStatus } from "@/lib/domain/inventory";
import { useStore } from "@/lib/store/store-provider";
import type { InventoryTransactionType, StockStatus } from "@/lib/types";

const TONE: Record<StockStatus, Tone> = { sufficient: "green", low: "orange", out: "red" };

const TX_LABELS: Record<InventoryTransactionType, string> = {
  initial: "初始庫存",
  intake: "服用",
  reversal: "取消服用",
  restock: "補貨",
  adjustment: "人工調整",
};

export default function SupplementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const store = useStore();
  const toast = useToast();
  const router = useRouter();
  const [restockOpen, setRestockOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const s = store.supplements.find((x) => x.id === id);
  const transactions = useMemo(
    () =>
      store.transactions
        .filter((t) => t.supplementId === id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 20),
    [store.transactions, id],
  );

  if (store.status === "loading") return <ListSkeleton />;
  if (store.status === "error") return <ErrorState message={store.error ?? "載入失敗"} onRetry={store.retry} />;
  if (!s) {
    return (
      <EmptyState
        tone="green"
        title="找不到這項保健品"
        description="它可能已被移除。"
        action={<ButtonLink href="/supplements">回到保健品清單</ButtonLink>}
      />
    );
  }

  const status = stockStatus(s);
  const days = estimateDaysLeft(s);
  const perDay = dailyConsumption(s);
  const statusKey = `supplement:status:${s.id}`;

  return (
    <div className="animate-fade-up">
      <div className="mb-4 flex items-center justify-between">
        <IconButton label="返回" onClick={() => router.back()}>
          <ChevronLeft />
        </IconButton>
        <ButtonLink href={`/supplements/${s.id}/edit`} variant="outline" size="sm">
          <Pencil size={16} />
          編輯
        </ButtonLink>
      </div>

      <header className="mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <Eyebrow tone="green">Supplement</Eyebrow>
          {s.productForm && <Badge tone="neutral">{PRODUCT_FORM_LABELS[s.productForm]}</Badge>}
          {s.status === "archived" && <Badge tone="neutral">已封存</Badge>}
        </div>
        <h1 className="mt-2 text-[28px] font-bold leading-tight text-ink">{s.name}</h1>
        {s.brand && <p className="mt-0.5 text-sm text-text-2">{s.brand}</p>}
      </header>

      <Card className="mb-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="font-en text-[12px] font-semibold uppercase tracking-[0.14em] text-text-3">Stock</p>
            <p className="mt-1 leading-none text-ink">
              <span className="font-en tnum text-4xl font-bold">{formatQuantity(s.stockQuantity)}</span>
              <span className="ml-1.5 text-base font-bold text-text-2">{s.doseUnit}</span>
            </p>
          </div>
          {s.status === "active" && <Badge tone={TONE[status]}>{STOCK_STATUS_LABELS[status]}</Badge>}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Item label="預估剩餘" value={days === null ? "尚無法估算" : `${days} 天`} />
          <Item label="每日預計消耗" value={perDay > 0 ? `${formatQuantity(perDay)} ${s.doseUnit}` : "—"} />
          <Item label="低庫存門檻" value={`${formatQuantity(s.lowStockThreshold)} ${s.doseUnit}`} />
          <Item label="有效期限" value={s.expirationDate ?? "未填"} />
        </dl>
        {s.status === "active" && (
          <Button className="mt-5 w-full" onClick={() => setRestockOpen(true)}>
            補貨
          </Button>
        )}
      </Card>

      <Card className="mb-4">
        <p className="font-en text-[12px] font-semibold uppercase tracking-[0.14em] text-text-3">Plan</p>
        <p className="mt-2 text-base font-bold text-ink">
          每次 {formatQuantity(s.dosePerIntake)} {s.doseUnit} · 每日 {s.dailyFrequency} 次
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {s.scheduleSlots.map((slot, i) => (
            <li key={i}>
              <Badge tone={slot === "unconfirmed" ? "yellow" : "sky"}>{SLOT_LABELS[slot]}</Badge>
            </li>
          ))}
        </ul>
        {s.servingSize && <p className="mt-3 text-sm text-text-2">產品標示每份：{s.servingSize}</p>}
        {s.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-text-2">{s.notes}</p>}
      </Card>

      <Card className="mb-4">
        <p className="font-en text-[12px] font-semibold uppercase tracking-[0.14em] text-text-3">Ledger</p>
        {transactions.length === 0 ? (
          <p className="mt-2 text-sm text-text-3">尚無庫存異動。</p>
        ) : (
          <ul className="mt-2 divide-y-2 divide-cream">
            {transactions.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-bold text-ink">{TX_LABELS[t.type]}</p>
                  <p className="tnum text-xs text-text-3">
                    {formatDateTime(t.createdAt, store.timezone)}
                    {t.note && ` · ${t.note}`}
                  </p>
                </div>
                <span
                  className={`font-en tnum shrink-0 text-base font-bold ${t.quantityDelta < 0 ? "text-red-text" : "text-green-text"}`}
                >
                  {t.quantityDelta > 0 ? "+" : ""}
                  {formatQuantity(t.quantityDelta)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="mt-6 flex justify-center">
        {s.status === "active" ? (
          <Button variant="danger" size="sm" onClick={() => setArchiveOpen(true)} loading={store.isPending(statusKey)}>
            封存這項保健品
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            loading={store.isPending(statusKey)}
            onClick={async () => {
              if (await store.setSupplementStatus(s.id, "active")) toast.success(`已恢復 ${s.name}`);
            }}
          >
            恢復使用
          </Button>
        )}
      </div>

      <RestockDialog supplement={restockOpen ? s : null} onClose={() => setRestockOpen(false)} />

      <Dialog
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        title="封存保健品"
        description={`${s.name} 會從今日計畫移除，歷史紀錄與庫存異動都會保留，之後可以隨時恢復。`}
      >
        <div className="mt-2 flex flex-col gap-3">
          <Button
            variant="danger"
            onClick={async () => {
              setArchiveOpen(false);
              if (await store.setSupplementStatus(s.id, "archived")) {
                toast.info(`已封存 ${s.name}`);
                router.replace("/supplements");
              }
            }}
          >
            確認封存
          </Button>
          <Button variant="ghost" onClick={() => setArchiveOpen(false)}>
            取消
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-chip)] bg-cream px-3 py-2">
      <dt className="text-xs text-text-3">{label}</dt>
      <dd className="tnum mt-0.5 font-bold text-ink">{value}</dd>
    </div>
  );
}
