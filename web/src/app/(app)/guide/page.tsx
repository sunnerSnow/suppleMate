"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DISCLAIMER, KnowledgeCard } from "@/components/knowledge/knowledge-card";
import { useKnowledgeMap } from "@/components/knowledge/use-knowledge-map";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge, Cat } from "@/components/ui/card";
import { Dots, Wave } from "@/components/ui/decor";
import { ListIcon, Plus } from "@/components/ui/icons";
import { AppTop, Eyebrow, SectionTitle } from "@/components/ui/page-header";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { SLOT_LABELS } from "@/lib/constants";
import { cx } from "@/lib/cx";
import { formatQuantity } from "@/lib/domain/inventory";
import { pairAdvice, suggestedScheduleFor } from "@/lib/knowledge/advice";
import { WITH_FOOD_LABELS } from "@/lib/knowledge/types";
import { toSupplementInput } from "@/lib/domain/supplement-input";
import { useStore } from "@/lib/store/store-provider";
import { SCHEDULE_SLOTS, type ScheduleSlot } from "@/lib/types";

/** 方案頁：依目前的保健品與小知識，排出一天的建議、要補上的時段、搭配提醒與各項小知識 */
export default function GuidePage() {
  const store = useStore();
  const toast = useToast();
  const [openCard, setOpenCard] = useState<string | null>(null);

  const active = useMemo(() => store.supplements.filter((s) => s.status === "active"), [store.supplements]);
  const names = useMemo(() => active.map((s) => s.name), [active]);
  const { map: knowledge, loading } = useKnowledgeMap(names);

  const items = useMemo(
    () => active.map((s) => ({ supplement: s, entry: knowledge[s.name] ?? null })),
    [active, knowledge],
  );
  const suggestions = useMemo(
    () => items.filter((i) => i.entry).map((i) => ({ ...i, plan: suggestedScheduleFor(i.supplement, i.entry!) })),
    [items],
  );
  const toApply = suggestions.filter((x) => !x.plan.alreadyApplied);
  const advice = useMemo(() => pairAdvice(items), [items]);

  /** 一天的時段總覽：以目前計畫為準（已套用的建議會反映在這裡） */
  const dayPlan = useMemo(() => {
    const bySlot = new Map<ScheduleSlot, typeof active>();
    for (const s of active)
      for (const slot of new Set(s.scheduleSlots)) bySlot.set(slot, [...(bySlot.get(slot) ?? []), s]);
    return SCHEDULE_SLOTS.filter((slot) => bySlot.has(slot)).map((slot) => ({ slot, supplements: bySlot.get(slot)! }));
  }, [active]);

  const apply = async (x: (typeof suggestions)[number]) => {
    const updated = await store.updateSupplement(x.supplement.id, {
      ...toSupplementInput(x.supplement),
      scheduleSlots: x.plan.slots,
    });
    if (updated) toast.success(`已把 ${x.supplement.name} 設為 ${x.plan.slots.map((s) => SLOT_LABELS[s]).join("、")}`);
  };

  return (
    <div className="animate-fade-up">
      <AppTop />

      <div className="dark-block on-dark mt-2">
        <Eyebrow>Suggested plan</Eyebrow>
        <h1 className="h1 mt-2">
          一天這樣吃，
          <br />
          比較順。
        </h1>
        <p className="mt-2 text-xs leading-relaxed">
          依你目前的保健品，用產品常見的服用時機排成一天。{DISCLAIMER}按「套用」才會寫進你的計畫。
        </p>
        <div className="bracket mt-3">
          <span className="font-en text-xs opacity-80">PLAN · {store.today.replace(/-/g, ".")}</span>
        </div>
      </div>
      <Wave />

      {store.status === "loading" && (
        <div className="mt-5">
          <ListSkeleton />
        </div>
      )}
      {store.status === "error" && (
        <div className="mt-5">
          <ErrorState message={store.error ?? "載入失敗"} onRetry={store.retry} />
        </div>
      )}

      {store.status === "ready" && active.length === 0 && (
        <div className="mt-5">
          <EmptyState
            icon={<ListIcon size={30} />}
            title="先新增保健品"
            description="有了保健品，這裡會排出一天的服用建議與搭配提醒。"
            action={
              <ButtonLink href="/supplements/new">
                <Plus size={18} />
                新增保健品
              </ButtonLink>
            }
          />
        </div>
      )}

      {store.status === "ready" && active.length > 0 && (
        <>
          <div className="slots mx-5 mt-5">
            {dayPlan.map(({ slot, supplements }) => (
              <section key={slot} className={cx("slot", slot === "unconfirmed" && "unconfirmed")}>
                <SectionTitle en={slot.replace(/_/g, " ")} aside={`${supplements.length} 項`}>
                  {SLOT_LABELS[slot]}
                </SectionTitle>
                <div className="slot-items">
                  {supplements.map((s) => {
                    const k = knowledge[s.name];
                    return (
                      <div key={s.id} className="item">
                        {k && <Cat>{WITH_FOOD_LABELS[k.timing.withFood]}</Cat>}
                        <div className="item-name">
                          <Link href={`/supplements/${s.id}`}>{s.name}</Link>
                          <small>
                            <span className="tnum">{formatQuantity(s.dosePerIntake)}</span> {s.doseUnit}
                            {k ? ` · ${k.timing.note}` : " · 尚無小知識"}
                          </small>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}

            {toApply.length > 0 && (
              <section className="slot unconfirmed">
                <SectionTitle en="To apply" aside={`${toApply.length} 項`}>
                  建議補上
                </SectionTitle>
                <div className="slot-items">
                  {toApply.map((x) => (
                    <div key={x.supplement.id} className="item">
                      <Cat>建議</Cat>
                      <div className="item-name">
                        {x.supplement.name} → {x.plan.slots.map((s) => SLOT_LABELS[s]).join("、")}
                        <small>{x.plan.withFoodNote}</small>
                      </div>
                      <Button
                        size="sm"
                        variant="accent"
                        loading={store.isPending(`supplement:update:${x.supplement.id}`)}
                        onClick={() => apply(x)}
                      >
                        套用
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <Dots className="mx-5 mt-5" />

          {advice.length > 0 && (
            <div className="mx-5 mt-5">
              <h2 className="h2 dot-h inline-block">搭配提醒</h2>
              <div className="mt-2">
                {advice.map((a) => (
                  <div key={`${a.kind}-${a.a.supplementId}-${a.b.supplementId}`} className="pair">
                    <span className="text-sm font-black text-ink">
                      {a.a.name} ＋ {a.b.name}
                    </span>
                    <span className="text-text-2">{a.reason}</span>
                    <Badge tone={a.kind === "separate" ? (a.sameSlot ? "out" : "low") : "ok"} className="ml-auto">
                      {a.kind === "separate" ? (a.sameSlot ? "目前同時段，建議分開" : "分開吃") : "可以一起"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mx-5 mt-6">
            <h2 className="h2 dot-h inline-block">小知識</h2>
            {loading && <p className="sub-text mt-2">查詢中…</p>}
            <div className="mt-3 flex flex-col gap-3">
              {items.map(({ supplement: s, entry }) =>
                entry ? (
                  <div key={s.id}>
                    <button
                      type="button"
                      className="text-link mb-1"
                      aria-expanded={openCard === s.id}
                      onClick={() => setOpenCard(openCard === s.id ? null : s.id)}
                    >
                      {openCard === s.id ? "收合" : "展開"} {s.name}
                    </button>
                    <KnowledgeCard entry={entry} compact={openCard !== s.id} />
                  </div>
                ) : (
                  <div key={s.id} className="kcard">
                    <b>{s.name}</b>
                    還沒有這項的小知識。到{" "}
                    <Link href={`/supplements/${s.id}`} className="text-link">
                      保健品頁
                    </Link>{" "}
                    可以請 AI 整理。
                  </div>
                ),
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
