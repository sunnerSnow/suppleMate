"use client";

import { Card } from "@/components/ui/card";
import { Field, Select, SelectWrap } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { AGE_RANGE_LABELS, HEALTH_GOAL_LABELS, SEX_LABELS } from "@/lib/constants";
import { cx } from "@/lib/cx";
import { useStore } from "@/lib/store/store-provider";
import { AGE_RANGES, HEALTH_GOALS, SEXES, type AgeRange, type HealthGoal, type Sex } from "@/lib/types";

/**
 * 健檢用的個人資料：保健目標（多選）、年齡區間、性別，全部選填、改了就存。
 * 只用來讓「建議增加」貼近一般人口的常見需求；不收病史或其他健康敏感資料。
 */
export function ProfileEditor() {
  const store = useStore();
  const toast = useToast();
  const profile = store.profile;
  const goals = profile?.healthGoals ?? [];
  const busy = store.status !== "ready" || store.isPending("profile");

  const save = async (patch: Parameters<typeof store.updateProfile>[0]) => {
    if (!(await store.updateProfile(patch))) toast.error("儲存失敗，請再試一次");
  };
  const toggle = (g: HealthGoal) =>
    save({ healthGoals: goals.includes(g) ? goals.filter((x) => x !== g) : [...goals, g] });

  return (
    <Card>
      <div className="card-head">
        <h2 className="h2">
          <span className="en">About you</span>關於你
        </h2>
        <span className="sub-text text-xs">選填，改了就存</span>
      </div>
      <p className="label">保健目標（可多選）</p>
      <div className="mt-1 flex flex-wrap gap-2" role="group" aria-label="保健目標">
        {HEALTH_GOALS.map((g) => {
          const on = goals.includes(g);
          return (
            <button
              key={g}
              type="button"
              className={cx("chip", on && "on")}
              aria-pressed={on}
              disabled={busy}
              onClick={() => toggle(g)}
            >
              {HEALTH_GOAL_LABELS[g]}
            </button>
          );
        })}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Field label="年齡區間" htmlFor="age-range">
          <SelectWrap>
            <Select
              id="age-range"
              value={profile?.ageRange ?? ""}
              disabled={busy}
              onChange={(e) => save({ ageRange: (e.target.value || null) as AgeRange | null })}
            >
              <option value="">不填</option>
              {AGE_RANGES.map((a) => (
                <option key={a} value={a}>
                  {AGE_RANGE_LABELS[a]}
                </option>
              ))}
            </Select>
          </SelectWrap>
        </Field>
        <Field label="性別" htmlFor="sex">
          <SelectWrap>
            <Select
              id="sex"
              value={profile?.sex ?? ""}
              disabled={busy}
              onChange={(e) => save({ sex: (e.target.value || null) as Sex | null })}
            >
              <option value="">不填</option>
              {SEXES.map((s) => (
                <option key={s} value={s}>
                  {SEX_LABELS[s]}
                </option>
              ))}
            </Select>
          </SelectWrap>
        </Field>
      </div>
      <p className="hint">年齡與性別只用來套用一般人口的常見差異（例如年長者常補充維生素 D），不會用於其他用途。</p>
    </Card>
  );
}
