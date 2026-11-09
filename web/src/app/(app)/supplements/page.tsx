"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Cat } from "@/components/ui/card";
import { Marquee } from "@/components/ui/decor";
import { Input } from "@/components/ui/field";
import { CapsuleIcon, ChevronRight, Plus, Search } from "@/components/ui/icons";
import { AppTop, Eyebrow } from "@/components/ui/page-header";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/state";
import { SLOT_LABELS, STOCK_STATUS_LABELS } from "@/lib/constants";
import { formatQuantity, stockStatus } from "@/lib/domain/inventory";
import { dailySummary } from "@/lib/domain/plan";
import { useStore } from "@/lib/store/store-provider";
import type { StockStatus } from "@/lib/types";

const TONE: Record<StockStatus, "ok" | "low" | "out"> = { sufficient: "ok", low: "low", out: "out" };

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

  const activeCount = store.supplements.filter((s) => s.status === "active").length;
  const archivedCount = store.supplements.length - activeCount;

  return (
    <div className="animate-fade-up">
      <AppTop
        action={
          <ButtonLink href="/supplements/new" variant="accent" size="sm">
            <Plus size={16} />
            新增
          </ButtonLink>
        }
      />
      <Marquee />

      <div className="bigbox">
        <div className="pt-2">
          <Eyebrow>Items</Eyebrow>
          <h1 className="h1 mt-2">
            我的<span className="dot-h">保健品</span>
          </h1>
          <p className="sub-text mt-1.5">
            使用中 <span className="tnum">{activeCount}</span> 項 · 已封存 <span className="tnum">{archivedCount}</span>{" "}
            項
          </p>
        </div>

        <label className="relative mt-4 block">
          <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜尋名稱或品牌"
            className="round pl-10"
            aria-label="搜尋保健品"
          />
        </label>

        {archivedCount > 0 && (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className={`chip ${showArchived ? "" : "on"}`}
              aria-pressed={!showArchived}
              onClick={() => setShowArchived(false)}
            >
              使用中
            </button>
            <button
              type="button"
              className={`chip ${showArchived ? "on" : ""}`}
              aria-pressed={showArchived}
              onClick={() => setShowArchived(true)}
            >
              已封存 {archivedCount}
            </button>
          </div>
        )}

        {store.status === "loading" && (
          <div className="-mx-5 mt-4">
            <ListSkeleton />
          </div>
        )}
        {store.status === "error" && (
          <div className="-mx-5 mt-4">
            <ErrorState message={store.error ?? "載入失敗"} onRetry={store.retry} />
          </div>
        )}

        {store.status === "ready" && list.length === 0 && (
          <div className="-mx-5 mt-4">
            <EmptyState
              icon={<CapsuleIcon size={30} />}
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
          </div>
        )}

        {store.status === "ready" && list.length > 0 && (
          <ul className="list-card mt-4">
            {list.map((s) => {
              const status = stockStatus(s);
              return (
                <li key={s.id}>
                  <Link href={`/supplements/${s.id}`} className="list-row">
                    <div className="item-name">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        {s.name}
                        {s.brand && <span className="text-[11px] text-text-3">{s.brand}</span>}
                        {s.status === "archived" && <Badge tone="neutral">已封存</Badge>}
                      </span>
                      <small>{dailySummary(s, (slot) => SLOT_LABELS[slot])}</small>
                    </div>
                    <span className="tnum text-base font-black text-ink">{formatQuantity(s.stockQuantity)}</span>
                    {s.status === "active" ? (
                      <Badge tone={TONE[status]}>{STOCK_STATUS_LABELS[status]}</Badge>
                    ) : (
                      <Cat>{s.doseUnit}</Cat>
                    )}
                    <ChevronRight size={18} className="shrink-0 text-ink" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
