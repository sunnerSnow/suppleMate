"use client";

import { useEffect, useMemo, useState } from "react";
import { getCheckupAction, runCheckupAction } from "@/app/actions";
import { AiReport } from "@/components/checkup/ai-report";
import { FindingList } from "@/components/checkup/finding-list";
import { ProfileEditor } from "@/components/checkup/profile-editor";
import { DISCLAIMER } from "@/components/knowledge/knowledge-card";
import { useKnowledgeMap } from "@/components/knowledge/use-knowledge-map";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dots, Wave } from "@/components/ui/decor";
import { Plus } from "@/components/ui/icons";
import { AppTop, Eyebrow } from "@/components/ui/page-header";
import { ErrorState, ListSkeleton } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { SLOT_LABELS } from "@/lib/constants";
import { toSupplementInput } from "@/lib/domain/supplement-input";
import { type CheckupFinding, checkupSummary, KIND_LABELS, runCheckupRules } from "@/lib/knowledge/checkup";
import type { CheckupReportEntry } from "@/lib/knowledge/checkup-report";
import { useStore } from "@/lib/store/store-provider";

/**
 * 一鍵健檢：內建規則在前端立刻算（重複、分開、時段、目標、年齡性別），AI 深度分析要使用者按下。
 * 所有建議只顯示；套用時段、新增保健品都要再按一次。
 */
export default function CheckupPage() {
  const store = useStore();
  const toast = useToast();
  const [started, setStarted] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [ai, setAi] = useState<{ status: "loading" | "ready"; report: CheckupReportEntry | null }>({
    status: "loading",
    report: null,
  });
  const [generating, setGenerating] = useState(false);

  const active = useMemo(() => store.supplements.filter((s) => s.status === "active"), [store.supplements]);
  const names = useMemo(() => active.map((s) => s.name), [active]);
  const { map: knowledge, loading: knowledgeLoading } = useKnowledgeMap(names);
  const profile = store.profile;

  const findings = useMemo(() => {
    if (!profile) return [];
    return runCheckupRules(
      active.map((s) => ({ supplement: s, entry: knowledge[s.name] ?? null })),
      { healthGoals: profile.healthGoals, ageRange: profile.ageRange, sex: profile.sex },
    );
  }, [active, knowledge, profile]);
  const summary = checkupSummary(findings);

  // 會影響 AI 報告是否過期的輸入（與伺服器端 inputHash 看同一組欄位）；變了就重新讀報告狀態
  const inputKey = useMemo(
    () =>
      JSON.stringify({
        items: active.map((s) => [s.name, s.dosePerIntake, s.doseUnit, s.dailyFrequency, [...s.scheduleSlots].sort()]),
        goals: profile?.healthGoals ?? [],
        age: profile?.ageRange ?? null,
        sex: profile?.sex ?? null,
      }),
    [active, profile],
  );

  // 上一次的 AI 報告（含是否過期）；進頁面讀一次，資料改了再讀，產生後由 run 的結果更新
  useEffect(() => {
    let cancelled = false;
    getCheckupAction()
      .then((r) => (r.ok ? r.value : null))
      .catch(() => null)
      .then((report) => {
        if (!cancelled) setAi({ status: "ready", report });
      });
    return () => {
      cancelled = true;
    };
  }, [inputKey]);

  const apply = async (f: CheckupFinding) => {
    if (!f.applySlots) return;
    const s = store.supplements.find((x) => x.id === f.applySlots!.supplementId);
    if (!s) return;
    setApplyingId(f.id);
    try {
      const updated = await store.updateSupplement(s.id, {
        ...toSupplementInput(s),
        scheduleSlots: f.applySlots.slots,
      });
      if (updated) toast.success(`已把 ${s.name} 設為 ${f.applySlots.slots.map((x) => SLOT_LABELS[x]).join("、")}`);
    } finally {
      setApplyingId(null);
    }
  };

  const runAi = async () => {
    setGenerating(true);
    try {
      const r = await runCheckupAction().catch(() => null);
      if (!r) toast.error("連線失敗，請再試一次");
      else if (!r.ok) toast.error(r.error.message);
      else {
        setAi({ status: "ready", report: r.value });
        toast.success(r.value.source === "mock" ? "已產生示範報告" : "AI 分析完成");
      }
    } finally {
      setGenerating(false);
    }
  };

  const canRun = store.status === "ready" && (active.length > 0 || (profile?.healthGoals.length ?? 0) > 0);

  return (
    <div className="animate-fade-up">
      <AppTop />

      <div className="dark-block on-dark mt-2">
        <Eyebrow>Check-up</Eyebrow>
        <h1 className="h1 mt-2">
          一鍵健檢，
          <br />
          看看要不要調。
        </h1>
        <p className="mt-2 text-xs leading-relaxed">
          依你目前的保健品、勾選的目標與基本資料，找出可以調整、可以考慮不用、建議增加的地方。{DISCLAIMER}
        </p>
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

      {store.status === "ready" && (
        <div className="mx-5 mt-5 flex flex-col gap-4">
          <ProfileEditor />

          {!started ? (
            <div className="flex flex-col gap-3">
              <Button size="lg" block variant="accent" disabled={knowledgeLoading} onClick={() => setStarted(true)}>
                {knowledgeLoading ? "整理小知識中…" : `開始健檢（${active.length} 項保健品）`}
              </Button>
              {active.length === 0 && (
                <ButtonLink href="/supplements/new" variant="ghost" block>
                  <Plus size={18} />
                  先新增保健品
                </ButtonLink>
              )}
            </div>
          ) : (
            <>
              <div className="bracket">
                <span className="font-en text-xs">
                  RESULT ·{" "}
                  {(["adjust", "drop", "add", "caution"] as const)
                    .map((k) => `${KIND_LABELS[k]} ${summary[k]}`)
                    .join(" · ")}
                </span>
              </div>
              <FindingList findings={findings} onApply={apply} applyingId={applyingId} />
              <Dots />
              <AiReport
                report={ai.report}
                loading={ai.status === "loading"}
                generating={generating}
                canRun={canRun}
                onRun={runAi}
              />
            </>
          )}

          <p className="sub-text px-1 text-xs leading-relaxed">
            健檢只比對產品常見用法與一般人口的常見需求，不是診斷；是否需要補充、停用或調整劑量，請與醫師、藥師或營養師討論。
          </p>
        </div>
      )}
    </div>
  );
}
