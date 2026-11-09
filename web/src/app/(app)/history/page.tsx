"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge, Cat } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { ClockIcon } from "@/components/ui/icons";
import { AppTop, PageHeader, SectionTitle } from "@/components/ui/page-header";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/state";
import { SLOT_LABELS } from "@/lib/constants";
import { cx } from "@/lib/cx";
import { formatPlanDate, formatTime, relativeDayLabel } from "@/lib/date";
import { formatQuantity } from "@/lib/domain/inventory";
import { useStore } from "@/lib/store/store-provider";
import type { IntakeLog } from "@/lib/types";

export default function HistoryPage() {
  const store = useStore();
  const [date, setDate] = useState("");

  const groups = useMemo(() => {
    const logs = store.intakeLogs
      .filter((l) => !date || l.planDate === date)
      .sort(
        (a, b) =>
          b.planDate.localeCompare(a.planDate) || (b.takenAt ?? b.createdAt).localeCompare(a.takenAt ?? a.createdAt),
      );
    const map = new Map<string, IntakeLog[]>();
    for (const l of logs) map.set(l.planDate, [...(map.get(l.planDate) ?? []), l]);
    return [...map.entries()];
  }, [store.intakeLogs, date]);

  return (
    <div className="animate-fade-up">
      <AppTop />
      <PageHeader
        eyebrow="History"
        title={
          <>
            服用<span className="dot-h">紀錄</span>
          </>
        }
        description="紀錄保存當時的名稱、用量與單位，之後改設定不會影響這裡。"
      />

      <div className="mx-5 mb-4 flex items-center gap-2">
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="依日期篩選"
          className="round flex-1"
        />
        {date && (
          <Button variant="ghost" size="sm" onClick={() => setDate("")}>
            清除
          </Button>
        )}
      </div>

      {store.status === "loading" && <ListSkeleton />}
      {store.status === "error" && <ErrorState message={store.error ?? "載入失敗"} onRetry={store.retry} />}

      {store.status === "ready" && groups.length === 0 && (
        <EmptyState
          icon={<ClockIcon size={30} />}
          title={date ? "這一天沒有紀錄" : "還沒有服用紀錄"}
          description={date ? "試試其他日期。" : "到今日頁勾選已服用的項目，紀錄就會出現在這裡。"}
        />
      )}

      {store.status === "ready" && groups.length > 0 && (
        <div className="slots mx-5">
          {groups.map(([planDate, logs]) => {
            const taken = logs.filter((l) => l.status === "taken").length;
            const relative = relativeDayLabel(planDate, store.today);
            return (
              <section key={planDate} className={cx("slot", taken > 0 && "done")}>
                <SectionTitle en={planDate} aside={`已服用 ${taken} 項`} done={taken === logs.length}>
                  {relative && <span className="mr-1.5 text-accent-2-text">{relative}</span>}
                  {formatPlanDate(planDate)}
                </SectionTitle>
                <div className="slot-items">
                  {logs.map((l) => (
                    <div key={l.id} className={cx("item", l.status === "reversed" && "done")}>
                      <Cat>{SLOT_LABELS[l.planSlot]}</Cat>
                      <div className="item-name">
                        <span className={l.status === "reversed" ? "line-through" : undefined}>
                          {l.supplementNameSnapshot}
                        </span>
                        <small>
                          <span className="tnum">{formatQuantity(l.doseSnapshot)}</span> {l.unitSnapshot}
                          {l.takenAt && ` · ${formatTime(l.takenAt, store.timezone)}`}
                        </small>
                      </div>
                      {l.status === "taken" ? <Badge tone="ok">已服用</Badge> : <Badge tone="neutral">已撤銷</Badge>}
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
