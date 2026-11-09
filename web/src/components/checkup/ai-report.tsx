"use client";

import { Button, ButtonLink } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import type { CheckupReportEntry } from "@/lib/knowledge/checkup-report";

const PRIORITY = { high: "優先", medium: "建議", low: "可考慮" } as const;

/** AI 深度分析的報告：有快取就先顯示（過期會標示），按下才重新分析 */
export function AiReport({
  report,
  loading,
  generating,
  canRun,
  onRun,
}: {
  report: CheckupReportEntry | null;
  loading: boolean;
  generating: boolean;
  canRun: boolean;
  onRun: () => void;
}) {
  const runLabel = report ? (report.stale ? "資料已變更，重新分析" : "重新分析") : "請 AI 深度分析";
  return (
    <Card alt>
      <div className="card-head">
        <h2 className="h2">
          <span className="en">AI review</span>AI 深度分析
        </h2>
        {report && (
          <Badge tone={report.source === "mock" ? "neutral" : report.stale ? "low" : "info"}>
            {report.source === "mock" ? "示範內容" : report.stale ? "資料已變更" : "AI 整理"}
          </Badge>
        )}
      </div>
      {loading && <p className="sub-text m-0">讀取上一次的報告…</p>}
      {!loading && !report && (
        <p className="sub-text m-0">
          把你的清單、目標與內建規則的發現交給 AI，整理出建議增加、可以考慮不用、建議調整與注意事項。會用掉一次 AI
          額度；同樣的資料不會重複分析。
        </p>
      )}
      {report && (
        <div className="mt-1 flex flex-col gap-3 text-sm">
          <p className="m-0 font-black text-ink">{report.overview}</p>
          <ReportList
            title="建議增加"
            items={report.add.map((a) => ({ head: a.name, tag: PRIORITY[a.priority], body: a.reason }))}
          />
          <ReportList title="可以考慮不用" items={report.remove.map((r) => ({ head: r.name, body: r.reason }))} />
          <ReportList
            title="建議調整"
            items={report.adjust.map((a) => ({ head: a.name, tag: a.change, body: a.reason }))}
          />
          <ReportList title="注意" items={report.cautions.map((c) => ({ body: c }))} />
          <ReportList title="建議先問專業人員" items={report.askProfessional.map((c) => ({ body: c }))} />
          {report.add.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {report.add.map((a) => (
                <ButtonLink
                  key={a.name}
                  size="sm"
                  variant="ghost"
                  href={`/supplements/new?name=${encodeURIComponent(a.name)}`}
                >
                  新增 {a.name}
                </ButtonLink>
              ))}
            </div>
          )}
          <p className="sub-text m-0 text-xs">
            {report.model ? `模型：${report.model} · ` : ""}
            {new Date(report.updatedAt).toLocaleString("zh-TW", { hour12: false })}
          </p>
        </div>
      )}
      <Button
        className="mt-4"
        block
        variant="accent"
        loading={generating}
        disabled={!canRun || loading}
        onClick={onRun}
      >
        {runLabel}
      </Button>
    </Card>
  );
}

function ReportList({ title, items }: { title: string; items: { head?: string; tag?: string; body: string }[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="m-0 text-xs font-black uppercase tracking-wide text-text-2">{title}</h3>
      <ul className="m-0 mt-1 flex list-none flex-col gap-1.5 p-0">
        {items.map((it, i) => (
          <li key={`${it.head ?? ""}-${i}`} className="pair !py-1.5">
            <span className="min-w-0">
              {it.head && <b className="text-ink">{it.head}</b>}
              {it.tag && (
                <Badge tone="neutral" className="ml-1.5 normal-case">
                  {it.tag}
                </Badge>
              )}
              <span className={it.head ? "block text-text-2" : "text-text-2"}>{it.body}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
