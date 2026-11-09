"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";
import { PlanItemCard } from "@/components/today/plan-item-card";
import { Button, ButtonLink, IconButton } from "@/components/ui/button";
import { Cloud } from "@/components/ui/decor";
import { Dialog } from "@/components/ui/dialog";
import { CapsuleIcon, ChevronLeft, ChevronRight, GearIcon, Plus } from "@/components/ui/icons";
import { Eyebrow, SectionTitle } from "@/components/ui/page-header";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import type { Tone } from "@/components/ui/tone";
import { SLOT_LABELS } from "@/lib/constants";
import { addDays, formatPlanDate, relativeDayLabel } from "@/lib/date";
import { formatQuantity } from "@/lib/domain/inventory";
import { buildPlanItems, groupBySlot, planProgress } from "@/lib/domain/plan";
import { useStore } from "@/lib/store/store-provider";
import type { PlanItem, ScheduleSlot } from "@/lib/types";

/** 每個時段一個顏色，讓一天的節奏看得出來 */
const SLOT_TONE: Record<ScheduleSlot, Tone> = {
  before_breakfast: "yellow",
  after_breakfast: "yellow",
  before_lunch: "orange",
  after_lunch: "orange",
  before_dinner: "purple",
  after_dinner: "purple",
  bedtime: "sky",
  unconfirmed: "neutral",
};

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
          <Eyebrow tone="sky">Today</Eyebrow>
          <Link
            href="/settings"
            aria-label="設定"
            title="設定"
            className="inline-flex size-11 items-center justify-center rounded-full text-text-3 transition-colors hover:bg-cream hover:text-ink"
          >
            <GearIcon size={22} />
          </Link>
        </div>
        {store.status === "ready" && (
          <div className="mt-3 flex items-center justify-between gap-2">
            <IconButton label="前一天" onClick={() => setOffset((o) => o - 1)}>
              <ChevronLeft />
            </IconButton>
            <div className="text-center">
              <h1 className="text-[22px] font-bold leading-tight text-ink">
                {relative && <span className="mr-1.5 text-sky-text">{relative}</span>}
                {formatPlanDate(planDate)}
              </h1>
              {offset !== 0 && (
                <button
                  type="button"
                  onClick={() => setOffset(0)}
                  className="mt-1 cursor-pointer rounded-full bg-sky-soft px-3 py-0.5 text-xs font-bold text-sky-text"
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
          tone="sky"
          icon={<CapsuleIcon size={32} />}
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

          <div className="stagger mt-6 flex flex-col gap-6">
            {groups.map((g, i) => (
              <section key={g.slot} style={{ "--i": i } as CSSProperties}>
                <SectionTitle
                  tone={SLOT_TONE[g.slot]}
                  aside={`${g.items.filter((it) => it.log).length} / ${g.items.length}`}
                >
                  {SLOT_LABELS[g.slot]}
                </SectionTitle>
                {g.slot === "unconfirmed" && (
                  <p className="mb-2.5 rounded-[var(--radius-chip)] bg-cream px-3 py-2 text-xs text-text-2">
                    這些項目的服用時段尚未確認，請依產品標示或專業建議到保健品頁設定。
                  </p>
                )}
                <div className="flex flex-col gap-3">
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
        <div className="mt-5 flex flex-col gap-3">
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

/** 天空藍進度卡：雲朵飄、圓體大數字 */
function ProgressCard({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const complete = total > 0 && done === total;
  const message = complete
    ? "今天的計畫都完成了！"
    : done === 0
      ? "還沒開始，從下一餐開始吧。"
      : `還有 ${total - done} 項待服用`;

  return (
    <div className="relative overflow-hidden rounded-[var(--radius-card)] border-2 border-sky-deep bg-sky px-5 py-5 text-ink shadow-[0_4px_0_0_var(--sky-deep)]">
      <Cloud className="animate-drift absolute -right-4 top-2 w-24 text-white/90" />
      <Cloud className="animate-drift absolute right-16 -top-2 w-14 text-white/70 [animation-delay:-2s]" />
      <Cloud className="animate-drift absolute -left-6 bottom-1 w-20 text-white/60 [animation-delay:-4s]" />

      <div className="relative flex items-center gap-5">
        <div className="relative flex size-20 shrink-0 items-center justify-center">
          <svg viewBox="0 0 36 36" className="absolute inset-0 size-20 -rotate-90" aria-hidden>
            <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="4" />
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke="#ffffff"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${pct} 100`}
              pathLength={100}
              className="transition-[stroke-dasharray] duration-700 ease-out"
            />
          </svg>
          <span className="font-en tnum text-lg font-bold">{pct}%</span>
        </div>
        <div className="min-w-0">
          <p className="font-en text-[12px] font-semibold uppercase tracking-[0.14em] text-ink">Progress</p>
          <p className="font-en tnum mt-0.5 text-4xl font-bold leading-none">
            {done} <span className="text-xl text-ink/80">/ {total}</span>
          </p>
          <p className="mt-2 text-sm font-bold">{message}</p>
        </div>
      </div>
    </div>
  );
}
