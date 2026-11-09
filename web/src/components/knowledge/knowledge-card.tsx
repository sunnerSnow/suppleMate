"use client";

import { Badge, Cat } from "@/components/ui/card";
import { SLOT_LABELS } from "@/lib/constants";
import { type KnowledgeEntry, WITH_FOOD_LABELS } from "@/lib/knowledge/types";
import type { ScheduleSlot } from "@/lib/types";

export const DISCLAIMER = "一般資訊，非醫療建議；實際服用方式請依產品標示或專業人員指示。";

export function sourceLabel(entry: KnowledgeEntry): string {
  return entry.source === "builtin" ? "內建資料" : entry.source === "ai" ? "AI 整理" : "示範內容";
}

/** 一張小知識卡：時機、攝取範圍、小知識、注意事項、搭配 */
export function KnowledgeCard({
  entry,
  compact,
  suggestedSlots,
  onApply,
  applying,
}: {
  entry: KnowledgeEntry;
  compact?: boolean;
  /** 要套用的時段（依每日次數算好）；給了才顯示「套用」 */
  suggestedSlots?: ScheduleSlot[];
  onApply?: () => void;
  applying?: boolean;
}) {
  const timing = entry.timing;
  return (
    <div className="kcard">
      <span className="corner">
        <Badge tone={entry.source === "mock" ? "neutral" : "info"}>{sourceLabel(entry)}</Badge>
      </span>
      <b>{entry.name}</b>
      {!compact && <p className="m-0">{entry.summary}</p>}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Cat>{WITH_FOOD_LABELS[timing.withFood]}</Cat>
        {timing.slots.map((s) => (
          <Cat key={s}>{SLOT_LABELS[s]}</Cat>
        ))}
      </div>
      <p className="m-0 mt-1.5">{timing.note}</p>
      {suggestedSlots && onApply && (
        <button
          type="button"
          className="btn btn-accent btn-sm mt-2"
          onClick={onApply}
          disabled={applying}
          aria-busy={applying || undefined}
        >
          套用為 {suggestedSlots.map((s) => SLOT_LABELS[s]).join("、")}
        </button>
      )}

      {!compact && (
        <>
          {entry.typicalRange && <p className="m-0 mt-2">一般攝取範圍：{entry.typicalRange}</p>}
          {entry.tips.length > 0 && (
            <ul className="m-0 mt-2 list-disc pl-4">
              {entry.tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}
          {entry.cautions.length > 0 && (
            <div className="mt-2">
              <span className="font-black">注意：</span>
              {entry.cautions.join("；")}
            </div>
          )}
          {(entry.separateFrom.length > 0 || entry.pairsWith.length > 0) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {entry.separateFrom.map((r) => (
                <Badge key={`s-${r.name}`} tone="out" className="normal-case">
                  與 {r.name} 分開
                </Badge>
              ))}
              {entry.pairsWith.map((r) => (
                <Badge key={`p-${r.name}`} tone="ok">
                  可與 {r.name} 一起
                </Badge>
              ))}
            </div>
          )}
        </>
      )}
      <p className="m-0 mt-2 text-[10px] opacity-70">{DISCLAIMER}</p>
    </div>
  );
}
