"use client";

import { Button, ButtonLink } from "@/components/ui/button";
import { Badge, type BadgeTone } from "@/components/ui/card";
import { SLOT_LABELS } from "@/lib/constants";
import { type CheckupFinding, type CheckupKind, type CheckupSeverity, KIND_LABELS } from "@/lib/knowledge/checkup";

const ORDER: CheckupKind[] = ["adjust", "drop", "add", "caution"];
const EN: Record<CheckupKind, string> = {
  adjust: "Adjust",
  drop: "Maybe skip",
  add: "Consider adding",
  caution: "Note",
};
const SEVERITY: Record<CheckupSeverity, { label: string; tone: BadgeTone }> = {
  high: { label: "優先", tone: "out" },
  medium: { label: "建議", tone: "low" },
  low: { label: "可考慮", tone: "info" },
};

/** 內建規則的發現，依「調整／可以不用／增加／注意」分組；套用與新增都要使用者按下 */
export function FindingList({
  findings,
  onApply,
  applyingId,
}: {
  findings: CheckupFinding[];
  onApply: (finding: CheckupFinding) => void;
  applyingId: string | null;
}) {
  if (findings.length === 0) {
    return (
      <div className="kcard">
        <b>內建規則沒有發現需要調整的地方</b>
        <p className="m-0">時段、搭配與重複都看起來沒問題。想看更細的建議可以請 AI 深度分析。</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      {ORDER.map((kind) => {
        const list = findings.filter((f) => f.kind === kind);
        if (list.length === 0) return null;
        return (
          <section key={kind}>
            <div className="slot-head">
              <h2 className="h2">
                <span className="en">{EN[kind]}</span>
                {KIND_LABELS[kind]}
              </h2>
              <span className="card-count">{list.length} 項</span>
            </div>
            <div className="mt-2 flex flex-col gap-3">
              {list.map((f) => (
                <div key={f.id} className="kcard">
                  <span className="corner">
                    <Badge tone={SEVERITY[f.severity].tone}>{SEVERITY[f.severity].label}</Badge>
                  </span>
                  <b>{f.title}</b>
                  <p className="m-0">{f.detail}</p>
                  {f.applySlots && (
                    <Button
                      size="sm"
                      variant="accent"
                      className="mt-2"
                      loading={applyingId === f.id}
                      onClick={() => onApply(f)}
                    >
                      套用為 {f.applySlots.slots.map((s) => SLOT_LABELS[s]).join("、")}
                    </Button>
                  )}
                  {f.candidates && f.candidates.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {f.candidates.map((name) => (
                        <ButtonLink
                          key={name}
                          size="sm"
                          variant="ghost"
                          href={`/supplements/new?name=${encodeURIComponent(name)}`}
                        >
                          新增 {name}
                        </ButtonLink>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
