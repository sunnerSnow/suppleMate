"use client";

import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { RestockDialog } from "@/components/inventory/restock-dialog";
import { KnowledgeCard } from "@/components/knowledge/knowledge-card";
import { useKnowledge } from "@/components/knowledge/use-knowledge";
import { Button, ButtonLink, IconButton } from "@/components/ui/button";
import { Badge, Card, Cat } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { ChevronLeft, Pencil } from "@/components/ui/icons";
import { AppTop, Eyebrow } from "@/components/ui/page-header";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { PRODUCT_FORM_LABELS, SLOT_LABELS, STOCK_STATUS_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/date";
import { dailyConsumption, estimateDaysLeft, formatQuantity, stockStatus } from "@/lib/domain/inventory";
import { suggestedScheduleFor } from "@/lib/knowledge/advice";
import { toSupplementInput } from "@/lib/domain/supplement-input";
import { useStore } from "@/lib/store/store-provider";
import type { InventoryTransactionType, StockStatus } from "@/lib/types";

const TONE: Record<StockStatus, "ok" | "low" | "out"> = { sufficient: "ok", low: "low", out: "out" };

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
  const knowledge = useKnowledge(s?.name ?? "", { debounceMs: 0 });
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
      <div className="mt-4">
        <EmptyState
          title="找不到這項保健品"
          description="它可能已被移除。"
          action={<ButtonLink href="/supplements">回到保健品清單</ButtonLink>}
        />
      </div>
    );
  }

  const status = stockStatus(s);
  const days = estimateDaysLeft(s);
  const perDay = dailyConsumption(s);
  const statusKey = `supplement:status:${s.id}`;
  const suggestion = knowledge.entry ? suggestedScheduleFor(s, knowledge.entry) : null;

  const applySuggestion = async () => {
    if (!suggestion) return;
    const updated = await store.updateSupplement(s.id, { ...toSupplementInput(s), scheduleSlots: suggestion.slots });
    if (updated) toast.success("已套用建議時段");
  };

  return (
    <div className="animate-fade-up">
      <AppTop
        action={
          <ButtonLink href={`/supplements/${s.id}/edit`} variant="ghost" size="sm">
            <Pencil size={16} />
            編輯
          </ButtonLink>
        }
      />

      <div className="px-5 pt-2">
        <div className="flex items-center gap-3">
          <IconButton label="返回" onClick={() => router.back()}>
            <ChevronLeft />
          </IconButton>
          <Eyebrow>Supplement</Eyebrow>
        </div>
        <h1 className="h1 mt-3">{s.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {s.brand && <span className="sub-text">{s.brand}</span>}
          {s.productForm && <Cat>{PRODUCT_FORM_LABELS[s.productForm]}</Cat>}
          {s.status === "archived" && <Badge tone="neutral">已封存</Badge>}
        </div>
      </div>

      <div className="mx-5 mt-4 flex flex-col gap-4">
        <Card>
          <div className="card-head">
            <h2 className="h2">
              <span className="en">Stock</span>庫存
            </h2>
            {s.status === "active" && <Badge tone={TONE[status]}>{STOCK_STATUS_LABELS[status]}</Badge>}
          </div>
          <p className="m-0 leading-none">
            <span className="tnum text-4xl font-black text-ink">{formatQuantity(s.stockQuantity)}</span>
            <span className="ml-1.5 text-sm font-black text-text-2">{s.doseUnit}</span>
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <Item label="預估剩餘" value={days === null ? "尚無法估算" : `${days} 天`} />
            <Item label="每日預計消耗" value={perDay > 0 ? `${formatQuantity(perDay)} ${s.doseUnit}` : "—"} />
            <Item label="低庫存門檻" value={`${formatQuantity(s.lowStockThreshold)} ${s.doseUnit}`} />
            <Item label="有效期限" value={s.expirationDate ?? "未填"} />
          </dl>
          {s.status === "active" && (
            <Button className="mt-4" block onClick={() => setRestockOpen(true)}>
              補貨
            </Button>
          )}
        </Card>

        <Card alt>
          <div className="card-head">
            <h2 className="h2">
              <span className="en">Plan</span>服用計畫
            </h2>
          </div>
          <p className="m-0 text-sm font-black">
            每次 {formatQuantity(s.dosePerIntake)} {s.doseUnit} · 每日 {s.dailyFrequency} 次
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {s.scheduleSlots.map((slot, i) => (
              <li key={i}>
                <Badge tone={slot === "unconfirmed" ? "low" : "info"}>{SLOT_LABELS[slot]}</Badge>
              </li>
            ))}
          </ul>
          {s.servingSize && <p className="sub-text mt-2">產品標示每份：{s.servingSize}</p>}
          {s.notes && <p className="sub-text mt-1 whitespace-pre-wrap">{s.notes}</p>}
        </Card>

        {knowledge.status === "ready" && knowledge.entry && (
          <KnowledgeCard
            entry={knowledge.entry}
            suggestedSlots={
              suggestion && !suggestion.alreadyApplied && s.status === "active" ? suggestion.slots : undefined
            }
            onApply={applySuggestion}
            applying={store.isPending(`supplement:update:${s.id}`)}
          />
        )}
        {knowledge.status === "none" && (
          <div className="kcard">
            <b>還沒有這項的小知識</b>
            找不到「{s.name}」的內建資料。可以請 AI 依名稱整理一張小知識卡（一般資訊，非醫療建議）。
            <div className="mt-2">
              <Button
                size="sm"
                variant="accent"
                loading={knowledge.generating}
                onClick={async () => {
                  const r = await knowledge.generate();
                  if (!r.ok) toast.error(r.message);
                }}
              >
                請 AI 整理
              </Button>
            </div>
          </div>
        )}

        <Card>
          <div className="card-head">
            <h2 className="h2">
              <span className="en">Ledger</span>庫存異動
            </h2>
          </div>
          {transactions.length === 0 ? (
            <p className="sub-text m-0">尚無庫存異動。</p>
          ) : (
            <ul className="m-0 list-none p-0">
              {transactions.map((t) => (
                <li key={t.id} className="item">
                  <div className="item-name">
                    {TX_LABELS[t.type]}
                    <small>
                      {formatDateTime(t.createdAt, store.timezone)}
                      {t.note && ` · ${t.note}`}
                    </small>
                  </div>
                  <span
                    className={`tnum text-base font-black ${t.quantityDelta < 0 ? "text-accent-text" : "text-accent-2-text"}`}
                  >
                    {t.quantityDelta > 0 ? "+" : ""}
                    {formatQuantity(t.quantityDelta)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="flex justify-center py-2">
          {s.status === "active" ? (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setArchiveOpen(true)}
              loading={store.isPending(statusKey)}
            >
              封存這項保健品
            </Button>
          ) : (
            <Button
              variant="ghost"
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
            block
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
          <Button variant="ghost" block onClick={() => setArchiveOpen(false)}>
            取消
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-text-3">{label}</dt>
      <dd className="tnum m-0 mt-0.5 text-sm font-black text-ink">{value}</dd>
    </div>
  );
}
