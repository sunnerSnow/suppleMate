"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useKnowledgeMap } from "@/components/knowledge/use-knowledge-map";
import { PlanItemCard } from "@/components/today/plan-item-card";
import { Button, ButtonLink, IconButton } from "@/components/ui/button";
import { Dots, Heart, Wave } from "@/components/ui/decor";
import { Dialog } from "@/components/ui/dialog";
import { CapsuleIcon, ChevronLeft, ChevronRight, GearIcon, Plus } from "@/components/ui/icons";
import { AppTop, Eyebrow, SectionTitle } from "@/components/ui/page-header";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { SLOT_LABELS } from "@/lib/constants";
import { cx } from "@/lib/cx";
import { addDays, formatPlanDate, relativeDayLabel } from "@/lib/date";
import { formatQuantity } from "@/lib/domain/inventory";
import { buildPlanItems, groupBySlot, planProgress } from "@/lib/domain/plan";
import { WITH_FOOD_LABELS } from "@/lib/knowledge/types";
import { useStore } from "@/lib/store/store-provider";
import type { PlanItem, ScheduleSlot } from "@/lib/types";

const SLOT_EN: Record<ScheduleSlot, string> = {
  before_breakfast: "Before breakfast",
  after_breakfast: "After breakfast",
  before_lunch: "Before lunch",
  after_lunch: "After lunch",
  before_dinner: "Before dinner",
  after_dinner: "After dinner",
  bedtime: "Bedtime",
  unconfirmed: "Not set yet",
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
  const names = useMemo(
    () => store.supplements.filter((s) => s.status === "active").map((s) => s.name),
    [store.supplements],
  );
  const { map: knowledge } = useKnowledgeMap(names);

  const ordinalOf = (item: PlanItem) => Number(item.key.split("|")[3] ?? 0);

  const take = async (item: PlanItem, allowInsufficientStock: boolean) => {
    const r = await store.takeIntake(
      { supplementId: item.supplementId, planDate, slot: item.slot, ordinal: ordinalOf(item), allowInsufficientStock },
      item.key,
    );
    if (!r) return;
    if (r.ok) toast.success(`已記錄 ${item.supplementName}`);
    else if (r.error.code === "INSUFFICIENT_STOCK") setConfirmItem(item);
    else toast.error(r.error.message);
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
  const remaining = progress.total - progress.done;
  const pct = progress.total === 0 ? 0 : Math.round((progress.done / progress.total) * 100);

  return (
    <div className="animate-fade-up">
      <AppTop
        action={
          <Link href="/settings" aria-label="設定" title="設定" className="icon-btn">
            <GearIcon size={20} />
          </Link>
        }
      />

      {store.status === "ready" && hasActive && (
        <>
          <div className="hero">
            <span className="hero-vtext">DAILY RECORD</span>
            <div className="min-w-0">
              <Eyebrow>Today</Eyebrow>
              <h1 className="h1 mt-2">
                {remaining > 0 ? (
                  <>
                    今天還有
                    <br />
                    <span className="dot-h">
                      <span className="tnum">{remaining}</span> 項
                    </span>
                    要吃
                  </>
                ) : progress.total > 0 ? (
                  <>
                    今天的
                    <br />
                    <span className="dot-h">都吃完了</span>
                  </>
                ) : (
                  "今天沒有計畫"
                )}
              </h1>
              <div className="date-chip mt-3">
                {relative && <span className="today">{relative}</span>}
                <span className="tnum">{formatPlanDate(planDate)}</span>
              </div>
            </div>
            <div className="hero-ring">
              <svg viewBox="0 0 112 112" width="112" height="112" aria-hidden>
                <circle className="ring-bg" cx="56" cy="56" r="46" strokeWidth="3" />
                <circle
                  className="ring-fg"
                  cx="56"
                  cy="56"
                  r="46"
                  fill="none"
                  strokeWidth="10"
                  strokeLinecap="round"
                  pathLength={100}
                  strokeDasharray={`${pct} 100`}
                  transform="rotate(-90 56 56)"
                />
              </svg>
              <div className="ring-label">
                <span className="big">
                  {progress.done}/{progress.total}
                </span>
                <span className="small">已完成</span>
              </div>
              <Heart className="hero-heart" />
            </div>
          </div>
          <Wave sky />

          <div className="flex items-center justify-between px-5 pt-3">
            <IconButton label="前一天" onClick={() => setOffset((o) => o - 1)}>
              <ChevronLeft />
            </IconButton>
            {offset !== 0 ? (
              <button type="button" className="chip on" onClick={() => setOffset(0)}>
                回到今天
              </button>
            ) : (
              <span className="sub-text">左右切換日期</span>
            )}
            <IconButton label="後一天" onClick={() => setOffset((o) => o + 1)}>
              <ChevronRight />
            </IconButton>
          </div>
          <Dots className="mx-5 mt-3" />
        </>
      )}

      {store.status === "loading" && <ListSkeleton />}
      {store.status === "error" && <ErrorState message={store.error ?? "載入失敗"} onRetry={store.retry} />}

      {store.status === "ready" && !hasActive && (
        <div className="mt-4">
          <EmptyState
            icon={<CapsuleIcon size={30} />}
            title="還沒有保健品"
            description="先新增一項，建立你的每日服用表。"
            action={
              <ButtonLink href="/supplements/new">
                <Plus size={18} />
                新增保健品
              </ButtonLink>
            }
          />
        </div>
      )}

      {store.status === "ready" && hasActive && (
        <div className="slots mx-5 mt-5">
          {groups.map((g) => {
            const done = g.items.filter((it) => it.log).length;
            return (
              <section
                key={g.slot}
                className={cx("slot", done === g.items.length && "done", g.slot === "unconfirmed" && "unconfirmed")}
              >
                <SectionTitle en={SLOT_EN[g.slot]} aside={`${done} / ${g.items.length}`} done={done === g.items.length}>
                  {SLOT_LABELS[g.slot]}
                </SectionTitle>
                {g.slot === "unconfirmed" && (
                  <p className="slot-note">時段尚未確認。到方案頁看建議，或到保健品頁設定。</p>
                )}
                <div className="slot-items">
                  {g.items.map((item) => {
                    const k = knowledge[item.supplementName];
                    return (
                      <PlanItemCard
                        key={item.key}
                        item={item}
                        pending={store.isPending(item.key)}
                        timezone={store.timezone}
                        category={k ? WITH_FOOD_LABELS[k.timing.withFood] : undefined}
                        onToggle={toggle}
                      />
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
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
        <p className="sub-text">你可以先補貨，或仍然記錄這次服用。仍要記錄時庫存會照實扣除並標示為不足。</p>
        <div className="mt-4 flex flex-col gap-3">
          <ButtonLink href="/inventory" block>
            前往補貨
          </ButtonLink>
          <Button
            variant="ghost"
            block
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
