"use client";

import { useMemo, useState } from "react";
import { PlanItemCard } from "@/components/today/plan-item-card";
import { Button, ButtonLink, IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import Link from "next/link";
import { CapsuleIcon, ChevronLeft, ChevronRight, GearIcon, Plus } from "@/components/ui/icons";
import { SectionTitle } from "@/components/ui/page-header";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { SLOT_LABELS } from "@/lib/constants";
import { addDays, formatPlanDate, relativeDayLabel } from "@/lib/date";
import { formatQuantity } from "@/lib/domain/inventory";
import { buildPlanItems, groupBySlot, planProgress } from "@/lib/domain/plan";
import { useStore } from "@/lib/store/store-provider";
import type { PlanItem } from "@/lib/types";

export default function TodayPage() {
  const store = useStore();
  const toast = useToast();
  const [offset, setOffset] = useState(0);
  const [confirmItem, setConfirmItem] = useState<PlanItem | null>(null);

  const planDate = addDays(store.today, offset);
  const items = useMemo(
    () => buildPlanItems(store.supplements, store.intakeLogs, planDate),
    [store.supplements, store.intakeLogs, planDate],
  );
  const groups = useMemo(() => groupBySlot(items), [items]);
  const progress = planProgress(items);
  const hasActive = store.supplements.some((s) => s.status === "active");

  const ordinalOf = (item: PlanItem) => Number(item.key.split("|")[3] ?? 0);

  const take = async (item: PlanItem, allowInsufficientStock: boolean) => {
    const r = await store.takeIntake(
      { supplementId: item.supplementId, planDate, slot: item.slot, ordinal: ordinalOf(item), allowInsufficientStock },
      item.key,
    );
    if (!r) return;
    if (r.ok) {
      toast.success(`已記錄 ${item.supplementName}`);
    } else if (r.error.code === "INSUFFICIENT_STOCK") {
      setConfirmItem(item);
    } else {
      toast.error(r.error.message);
    }
  };

  const toggle = async (item: PlanItem) => {
    if (item.log) {
      const r = await store.reverseIntake(item.log.id, item.key);
      if (r?.ok) toast.info(`已取消 ${item.supplementName}，庫存已回補`);
      else if (r && !r.ok) toast.error(r.error.message);
      return;
    }
    if (!item.stockSufficient) {
      setConfirmItem(item);
      return;
    }
    await take(item, false);
  };

  const relative = relativeDayLabel(planDate, store.today);

  return (
    <div className="animate-fade-up">
      <header className="mb-5">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-sage-600">Today</p>
          <Link
            href="/settings"
            aria-label="設定"
            title="設定"
            className="-mr-2 inline-flex size-10 items-center justify-center rounded-full text-text-3 transition-colors hover:bg-cream-deep hover:text-text"
          >
            <GearIcon size={20} />
          </Link>
        </div>
        {store.status === "ready" && (
          <div className="mt-1 flex items-center justify-between gap-2">
            <IconButton label="前一天" onClick={() => setOffset((o) => o - 1)}>
              <ChevronLeft />
            </IconButton>
            <div className="text-center">
              <h1 className="text-[22px] font-black leading-tight tracking-tight text-ink">
                {relative ? `${relative} · ` : ""}
                {formatPlanDate(planDate)}
              </h1>
              {offset !== 0 && (
                <button
                  type="button"
                  onClick={() => setOffset(0)}
                  className="mt-0.5 text-xs font-bold text-sage-700 underline underline-offset-2"
                >
                  回到今天
                </button>
              )}
            </div>
            <IconButton label="後一天" onClick={() => setOffset((o) => o + 1)}>
              <ChevronRight />
            </IconButton>
          </div>
        )}
      </header>

      {store.status === "loading" && <ListSkeleton />}
      {store.status === "error" && <ErrorState message={store.error ?? "載入失敗"} onRetry={store.retry} />}

      {store.status === "ready" && !hasActive && (
        <EmptyState
          icon={<CapsuleIcon size={26} />}
          title="還沒有保健品"
          description="先新增一項，建立你的每日服用表。"
          action={
            <ButtonLink href="/supplements/new">
              <Plus size={18} />
              新增保健品
            </ButtonLink>
          }
        />
      )}

      {store.status === "ready" && hasActive && (
        <>
          <ProgressCard done={progress.done} total={progress.total} />

          <div className="mt-5 flex flex-col gap-5">
            {groups.map((g) => (
              <section key={g.slot}>
                <SectionTitle aside={`${g.items.filter((i) => i.log).length} / ${g.items.length}`}>
                  {SLOT_LABELS[g.slot]}
                </SectionTitle>
                {g.slot === "unconfirmed" && (
                  <p className="mb-2 px-1 text-xs text-text-3">
                    這些項目的服用時段尚未確認，請依產品標示或專業建議到保健品頁設定。
                  </p>
                )}
                <div className="flex flex-col gap-2.5">
                  {g.items.map((item) => (
                    <PlanItemCard
                      key={item.key}
                      item={item}
                      pending={store.isPending(item.key)}
                      timezone={store.timezone}
                      onToggle={toggle}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}

      <Dialog
        open={confirmItem !== null}
        onClose={() => setConfirmItem(null)}
        title="庫存不足"
        description={
          confirmItem
            ? `${confirmItem.supplementName} 目前剩 ${formatQuantity(confirmItem.stockQuantity)} ${confirmItem.unit}，這次需要 ${formatQuantity(confirmItem.dose)} ${confirmItem.unit}。`
            : undefined
        }
      >
        <p className="text-sm leading-relaxed text-text-2">
          你可以先補貨，或仍然記錄這次服用。仍要記錄時庫存會照實扣除並標示為不足。
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <ButtonLink href="/inventory" variant="primary">
            前往補貨
          </ButtonLink>
          <Button
            variant="outline"
            onClick={async () => {
              const item = confirmItem;
              setConfirmItem(null);
              if (item) await take(item, true);
            }}
          >
            仍要記錄
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function ProgressCard({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const complete = total > 0 && done === total;
  return (
    <div className="flex items-center gap-4 rounded-[var(--radius-card)] bg-ink px-5 py-4 text-white">
      <div className="relative flex size-16 shrink-0 items-center justify-center">
        <svg viewBox="0 0 36 36" className="absolute inset-0 size-16 -rotate-90" aria-hidden>
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="3" />
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            stroke="#36947a"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${pct} 100`}
            pathLength={100}
            className="transition-[stroke-dasharray] duration-500"
          />
        </svg>
        <span className="tnum text-sm font-black">{pct}%</span>
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/60">Progress</p>
        <p className="tnum mt-0.5 text-2xl font-black leading-none">
          {done} <span className="text-base text-white/60">/ {total}</span>
        </p>
        <p className="mt-1.5 text-xs text-white/70">
          {complete
            ? "今天的計畫都完成了！"
            : total - done === total
              ? "尚未開始，從下一餐開始吧。"
              : `還有 ${total - done} 項待服用`}
        </p>
      </div>
    </div>
  );
}
