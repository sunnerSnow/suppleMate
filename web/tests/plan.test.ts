import { describe, expect, it } from "vitest";
import { buildPlanItems, dailySummary, groupBySlot, planProgress } from "@/lib/domain/plan";
import { SLOT_LABELS } from "@/lib/constants";
import type { IntakeLog, Supplement } from "@/lib/types";

const iso = "2026-11-06T00:00:00Z";

function sup(overrides: Partial<Supplement>): Supplement {
  return {
    id: "x",
    name: "X",
    dosePerIntake: 1,
    doseUnit: "顆",
    dailyFrequency: 1,
    scheduleSlots: ["after_breakfast"],
    stockQuantity: 10,
    lowStockThreshold: 2,
    status: "active",
    createdAt: iso,
    updatedAt: iso,
    ...overrides,
  };
}

describe("buildPlanItems", () => {
  it("依 scheduleSlots 展開項目，封存的不出現", () => {
    const items = buildPlanItems(
      [
        sup({ id: "a", name: "A", dailyFrequency: 2, scheduleSlots: ["after_breakfast", "bedtime"] }),
        sup({ id: "b", name: "B", status: "archived" }),
        sup({ id: "c", name: "C", scheduleSlots: ["unconfirmed"] }),
      ],
      [],
      "2026-11-06",
    );
    expect(items.map((i) => `${i.supplementName}:${i.slot}`)).toEqual([
      "A:after_breakfast",
      "A:bedtime",
      "C:unconfirmed",
    ]);
  });

  it("同一時段兩次用序號區分 key", () => {
    const items = buildPlanItems(
      [sup({ id: "a", dailyFrequency: 2, scheduleSlots: ["after_breakfast", "after_breakfast"] })],
      [],
      "2026-11-06",
    );
    expect(items[0].key).toBe("a|2026-11-06|after_breakfast|0");
    expect(items[1].key).toBe("a|2026-11-06|after_breakfast|1");
  });

  it("只對上當日 taken 的紀錄；reversed 與其他日期不算", () => {
    const base: Omit<IntakeLog, "id" | "planDate" | "status" | "planItemKey"> = {
      supplementId: "a",
      planSlot: "after_breakfast",
      supplementNameSnapshot: "A",
      doseSnapshot: 1,
      unitSnapshot: "顆",
      createdAt: iso,
    };
    const logs: IntakeLog[] = [
      { ...base, id: "l1", planDate: "2026-11-05", status: "taken", planItemKey: "a|2026-11-05|after_breakfast|0" },
      { ...base, id: "l2", planDate: "2026-11-06", status: "reversed", planItemKey: "a|2026-11-06|after_breakfast|0" },
      { ...base, id: "l3", planDate: "2026-11-06", status: "taken", planItemKey: "a|2026-11-06|after_breakfast|0" },
    ];
    const items = buildPlanItems([sup({ id: "a" })], logs, "2026-11-06");
    expect(items[0].log?.id).toBe("l3");
    expect(planProgress(items)).toEqual({ done: 1, total: 1 });
  });

  it("標記庫存是否足夠扣一次", () => {
    const items = buildPlanItems([sup({ id: "a", dosePerIntake: 2, stockQuantity: 1 })], [], "2026-11-06");
    expect(items[0].stockSufficient).toBe(false);
  });
});

describe("groupBySlot", () => {
  it("依固定時段順序分組，空時段略過，尚未確認排最後", () => {
    const items = buildPlanItems(
      [
        sup({ id: "a", scheduleSlots: ["unconfirmed"] }),
        sup({ id: "b", scheduleSlots: ["bedtime"] }),
        sup({ id: "c", scheduleSlots: ["before_breakfast"] }),
      ],
      [],
      "2026-11-06",
    );
    expect(groupBySlot(items).map((g) => g.slot)).toEqual(["before_breakfast", "bedtime", "unconfirmed"]);
  });
});

describe("dailySummary", () => {
  it("全部尚未確認時不推定時段", () => {
    const s = sup({ dosePerIntake: 1, dailyFrequency: 2, scheduleSlots: ["unconfirmed", "unconfirmed"] });
    expect(dailySummary(s, (slot) => SLOT_LABELS[slot])).toBe("1 顆 × 2 次（時段尚未確認）");
  });
  it("列出已設定的時段", () => {
    const s = sup({ dosePerIntake: 2, dailyFrequency: 2, scheduleSlots: ["after_breakfast", "unconfirmed"] });
    expect(dailySummary(s, (slot) => SLOT_LABELS[slot])).toBe("2 顆 × 2 次（早餐後、尚未確認）");
  });
});
