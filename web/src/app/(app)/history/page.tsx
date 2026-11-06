"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { ClockIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/state";
import { SLOT_LABELS } from "@/lib/constants";
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
      <PageHeader
        eyebrow="History"
        title="服用紀錄"
        description="紀錄保存當時的名稱、用量與單位，之後改設定不會影響這裡。"
      />

      <div className="mb-4 flex items-center gap-2">
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="依日期篩選"
          className="flex-1"
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
          icon={<ClockIcon size={26} />}
          title={date ? "這一天沒有紀錄" : "還沒有服用紀錄"}
          description={date ? "試試其他日期。" : "到今日頁勾選已服用的項目，紀錄就會出現在這裡。"}
        />
      )}

      {store.status === "ready" && groups.length > 0 && (
        <div className="flex flex-col gap-5">
          {groups.map(([planDate, logs]) => {
            const taken = logs.filter((l) => l.status === "taken").length;
            const relative = relativeDayLabel(planDate, store.today);
            return (
              <section key={planDate}>
                <div className="mb-2 flex items-baseline justify-between px-1">
                  <h2 className="text-sm font-black text-ink">
                    {relative && <span className="mr-1.5 text-sage-700">{relative}</span>}
                    {formatPlanDate(planDate)}
                  </h2>
                  <span className="tnum text-xs font-bold text-text-3">已服用 {taken} 項</span>
                </div>
                <Card className="divide-y divide-line-soft p-0">
                  {logs.map((l) => (
                    <div key={l.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p
                          className={`truncate text-[15px] font-bold ${
                            l.status === "reversed" ? "text-text-3 line-through" : "text-ink"
                          }`}
                        >
                          {l.supplementNameSnapshot}
                        </p>
                        <p className="mt-0.5 text-xs text-text-2">
                          <span className="tnum font-bold">
                            {formatQuantity(l.doseSnapshot)} {l.unitSnapshot}
                          </span>
                          <span className="mx-1.5 text-text-3">·</span>
                          {SLOT_LABELS[l.planSlot]}
                          {l.takenAt && (
                            <>
                              <span className="mx-1.5 text-text-3">·</span>
                              <span className="tnum">{formatTime(l.takenAt, store.timezone)}</span>
                            </>
                          )}
                        </p>
                      </div>
                      {l.status === "taken" ? <Badge tone="sage">已服用</Badge> : <Badge tone="neutral">已撤銷</Badge>}
                    </div>
                  ))}
                </Card>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
