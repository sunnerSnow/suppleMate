"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { CapsuleIcon, ChevronRight, Plus, Search } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/state";
import type { Tone } from "@/components/ui/tone";
import { SLOT_LABELS, STOCK_STATUS_LABELS } from "@/lib/constants";
import { formatQuantity, stockStatus } from "@/lib/domain/inventory";
import { dailySummary } from "@/lib/domain/plan";
import { useStore } from "@/lib/store/store-provider";
import type { StockStatus, Supplement } from "@/lib/types";

const TONE: Record<StockStatus, Tone> = { sufficient: "green", low: "orange", out: "red" };

export default function SupplementsPage() {
  const store = useStore();
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return store.supplements
      .filter((s) => (showArchived ? s.status === "archived" : s.status === "active"))
      .filter((s) => !q || s.name.toLowerCase().includes(q) || (s.brand ?? "").toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
  }, [store.supplements, query, showArchived]);

  const archivedCount = store.supplements.filter((s) => s.status === "archived").length;

  return (
    <div className="animate-fade-up">
      <PageHeader
        tone="green"
        eyebrow="Supplements"
        title="保健品"
        action={
          <ButtonLink href="/supplements/new" size="sm">
            <Plus size={16} />
            新增
          </ButtonLink>
        }
      />

      <div className="relative mb-4">
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-3" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜尋名稱或品牌"
          className="rounded-full pl-11"
          aria-label="搜尋保健品"
        />
      </div>

      {archivedCount > 0 && (
        <div className="mb-4 flex gap-2">
          <Chip active={!showArchived} onClick={() => setShowArchived(false)}>
            使用中
          </Chip>
          <Chip active={showArchived} onClick={() => setShowArchived(true)}>
            已封存 {archivedCount}
          </Chip>
        </div>
      )}

      {store.status === "loading" && <ListSkeleton />}
      {store.status === "error" && <ErrorState message={store.error ?? "載入失敗"} onRetry={store.retry} />}

      {store.status === "ready" && list.length === 0 && (
        <EmptyState
          tone="green"
          icon={<CapsuleIcon size={32} />}
          title={query ? "找不到符合的保健品" : showArchived ? "沒有已封存的保健品" : "還沒有保健品"}
          description={
            query ? "試試其他關鍵字。" : showArchived ? undefined : "新增你正在吃的保健品，就能建立每日服用表。"
          }
          action={
            !query && !showArchived ? (
              <ButtonLink href="/supplements/new">
                <Plus size={18} />
                新增保健品
              </ButtonLink>
            ) : undefined
          }
        />
      )}

      {store.status === "ready" && list.length > 0 && (
        <ul className="stagger flex flex-col gap-3">
          {list.map((s, i) => (
            <li key={s.id} style={{ "--i": i } as CSSProperties}>
              <SupplementRow s={s} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "cursor-pointer rounded-full bg-ink px-4 py-2 text-xs font-bold text-white"
          : "cursor-pointer rounded-full border-2 border-line bg-white px-4 py-2 text-xs font-bold text-text-2 hover:bg-cream"
      }
    >
      {children}
    </button>
  );
}

function SupplementRow({ s }: { s: Supplement }) {
  const status = stockStatus(s);
  return (
    <Link
      href={`/supplements/${s.id}`}
      className="press block rounded-[var(--radius-card)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
      style={{ "--press-shadow": "var(--line)" } as CSSProperties}
    >
      <Card className="flex items-center gap-3 transition-colors hover:border-green">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="truncate text-base font-bold text-ink">{s.name}</p>
            {s.brand && <span className="truncate text-xs text-text-3">{s.brand}</span>}
            {s.status === "archived" && <Badge tone="neutral">已封存</Badge>}
          </div>
          <p className="mt-1 text-sm text-text-2">{dailySummary(s, (slot) => SLOT_LABELS[slot])}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="tnum text-sm font-bold text-ink">
              庫存 <span className="font-en text-base">{formatQuantity(s.stockQuantity)}</span> {s.doseUnit}
            </span>
            {s.status === "active" && <Badge tone={TONE[status]}>{STOCK_STATUS_LABELS[status]}</Badge>}
          </div>
        </div>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-green-soft text-green-text">
          <ChevronRight size={18} strokeWidth={2.5} />
        </span>
      </Card>
    </Link>
  );
}
