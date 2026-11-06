"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { CapsuleIcon, ChevronRight, Plus, Search } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/state";
import { SLOT_LABELS, STOCK_STATUS_LABELS } from "@/lib/constants";
import { formatQuantity, stockStatus } from "@/lib/domain/inventory";
import { dailySummary } from "@/lib/domain/plan";
import { useStore } from "@/lib/store/store-provider";
import type { Supplement } from "@/lib/types";

const TONE = { sufficient: "sage", low: "amber", out: "orange" } as const;

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
        <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-3" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜尋名稱或品牌"
          className="pl-10"
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
          icon={<CapsuleIcon size={26} />}
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
        <ul className="flex flex-col gap-3">
          {list.map((s) => (
            <li key={s.id}>
              <SupplementRow s={s} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "rounded-full bg-ink px-4 py-1.5 text-xs font-bold text-white"
          : "rounded-full border border-line bg-paper px-4 py-1.5 text-xs font-bold text-text-2 hover:bg-cream"
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
      className="block rounded-[var(--radius-card)] focus-visible:outline-2 focus-visible:outline-sage-600"
    >
      <Card className="flex items-center gap-3 transition-colors hover:border-line">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="truncate text-[15px] font-bold text-ink">{s.name}</p>
            {s.brand && <span className="truncate text-xs text-text-3">{s.brand}</span>}
            {s.status === "archived" && <Badge tone="neutral">已封存</Badge>}
          </div>
          <p className="mt-1 text-sm text-text-2">{dailySummary(s, (slot) => SLOT_LABELS[slot])}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="tnum text-sm font-bold text-text">
              庫存 {formatQuantity(s.stockQuantity)} {s.doseUnit}
            </span>
            {s.status === "active" && <Badge tone={TONE[status]}>{STOCK_STATUS_LABELS[status]}</Badge>}
          </div>
        </div>
        <ChevronRight className="shrink-0 text-text-3" />
      </Card>
    </Link>
  );
}
