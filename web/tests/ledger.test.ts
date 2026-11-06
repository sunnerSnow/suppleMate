import { describe, expect, it } from "vitest";
import {
  adjustStock,
  initialTransaction,
  ledgerBalance,
  restock,
  reverseIntake,
  takeIntake,
} from "@/lib/domain/ledger";
import type { IntakeLog, InventoryTransaction, Supplement } from "@/lib/types";

const now = new Date("2026-11-06T01:00:00Z");

function makeSupplement(overrides: Partial<Supplement> = {}): Supplement {
  return {
    id: "s1",
    name: "魚油",
    dosePerIntake: 1,
    doseUnit: "顆",
    dailyFrequency: 2,
    scheduleSlots: ["after_breakfast", "after_dinner"],
    stockQuantity: 10,
    lowStockThreshold: 3,
    status: "active",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...overrides,
  };
}

describe("takeIntake", () => {
  it("建立紀錄、扣庫存、建立 intake 異動，並保存快照", () => {
    const s = makeSupplement();
    const r = takeIntake({ supplement: s, planDate: "2026-11-06", slot: "after_breakfast", existingLogs: [], now });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.supplement.stockQuantity).toBe(9);
    expect(r.value.log.status).toBe("taken");
    expect(r.value.log.supplementNameSnapshot).toBe("魚油");
    expect(r.value.log.doseSnapshot).toBe(1);
    expect(r.value.log.unitSnapshot).toBe("顆");
    expect(r.value.log.planItemKey).toBe("s1|2026-11-06|after_breakfast|0");
    expect(r.value.transaction.type).toBe("intake");
    expect(r.value.transaction.quantityDelta).toBe(-1);
    expect(r.value.transaction.relatedIntakeLogId).toBe(r.value.log.id);
  });

  it("同一計畫項目同一天不得重複扣庫存", () => {
    const s = makeSupplement();
    const first = takeIntake({ supplement: s, planDate: "2026-11-06", slot: "after_breakfast", existingLogs: [], now });
    if (!first.ok) throw new Error("first should succeed");
    const second = takeIntake({
      supplement: first.value.supplement,
      planDate: "2026-11-06",
      slot: "after_breakfast",
      existingLogs: [first.value.log],
      now,
    });
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.code).toBe("ALREADY_TAKEN");
  });

  it("同一天不同時段、或不同日期可以各自記錄", () => {
    const s = makeSupplement();
    const a = takeIntake({ supplement: s, planDate: "2026-11-06", slot: "after_breakfast", existingLogs: [], now });
    if (!a.ok) throw new Error();
    const b = takeIntake({
      supplement: a.value.supplement,
      planDate: "2026-11-06",
      slot: "after_dinner",
      existingLogs: [a.value.log],
      now,
    });
    expect(b.ok).toBe(true);
    const c = takeIntake({
      supplement: s,
      planDate: "2026-11-07",
      slot: "after_breakfast",
      existingLogs: [a.value.log],
      now,
    });
    expect(c.ok).toBe(true);
  });

  it("撤銷後可以再次勾選", () => {
    const s = makeSupplement();
    const a = takeIntake({ supplement: s, planDate: "2026-11-06", slot: "after_breakfast", existingLogs: [], now });
    if (!a.ok) throw new Error();
    const rev = reverseIntake({ supplement: a.value.supplement, log: a.value.log, now });
    if (!rev.ok) throw new Error();
    const again = takeIntake({
      supplement: rev.value.supplement,
      planDate: "2026-11-06",
      slot: "after_breakfast",
      existingLogs: [rev.value.log],
      now,
    });
    expect(again.ok).toBe(true);
  });

  it("庫存不足時預設拒絕，明確確認後仍可記錄且庫存反映扣除", () => {
    const s = makeSupplement({ stockQuantity: 0.5, dosePerIntake: 1 });
    const denied = takeIntake({
      supplement: s,
      planDate: "2026-11-06",
      slot: "after_breakfast",
      existingLogs: [],
      now,
    });
    expect(denied.ok).toBe(false);
    if (denied.ok) return;
    expect(denied.error.code).toBe("INSUFFICIENT_STOCK");

    const forced = takeIntake({
      supplement: s,
      planDate: "2026-11-06",
      slot: "after_breakfast",
      existingLogs: [],
      allowInsufficientStock: true,
      now,
    });
    expect(forced.ok).toBe(true);
    if (!forced.ok) return;
    expect(forced.value.supplement.stockQuantity).toBe(-0.5);
  });

  it("已封存的保健品不可記錄", () => {
    const s = makeSupplement({ status: "archived" });
    const r = takeIntake({ supplement: s, planDate: "2026-11-06", slot: "after_breakfast", existingLogs: [], now });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("ARCHIVED");
  });
});

describe("reverseIntake", () => {
  it("回補當時扣除的用量（用快照，不用目前設定），並建立 reversal 異動", () => {
    const s = makeSupplement({ dosePerIntake: 2 });
    const taken = takeIntake({ supplement: s, planDate: "2026-11-06", slot: "after_breakfast", existingLogs: [], now });
    if (!taken.ok) throw new Error();
    // 使用者事後把用量改成 5，撤銷仍應回補 2
    const edited = { ...taken.value.supplement, dosePerIntake: 5 };
    const r = reverseIntake({ supplement: edited, log: taken.value.log, now });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.supplement.stockQuantity).toBe(10);
    expect(r.value.log.status).toBe("reversed");
    expect(r.value.log.reversedAt).toBe(now.toISOString());
    expect(r.value.transaction.type).toBe("reversal");
    expect(r.value.transaction.quantityDelta).toBe(2);
  });

  it("重複撤銷不會重複回補", () => {
    const s = makeSupplement();
    const taken = takeIntake({ supplement: s, planDate: "2026-11-06", slot: "after_breakfast", existingLogs: [], now });
    if (!taken.ok) throw new Error();
    const once = reverseIntake({ supplement: taken.value.supplement, log: taken.value.log, now });
    if (!once.ok) throw new Error();
    const twice = reverseIntake({ supplement: once.value.supplement, log: once.value.log, now });
    expect(twice.ok).toBe(false);
    if (twice.ok) return;
    expect(twice.error.code).toBe("ALREADY_REVERSED");
  });
});

describe("restock / adjustStock", () => {
  it("補貨增加庫存、更新有效期限、建立 restock 異動", () => {
    const s = makeSupplement();
    const r = restock({
      supplement: s,
      quantity: 30,
      expirationDate: "2027-01-01",
      purchaseDate: "2026-11-06",
      note: "藥局",
      now,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.supplement.stockQuantity).toBe(40);
    expect(r.value.supplement.expirationDate).toBe("2027-01-01");
    expect(r.value.transaction.quantityDelta).toBe(30);
    expect(r.value.transaction.note).toContain("2026-11-06");
    expect(r.value.transaction.note).toContain("藥局");
  });

  it("補貨數量必須大於 0", () => {
    const r = restock({ supplement: makeSupplement(), quantity: 0, now });
    expect(r.ok).toBe(false);
  });

  it("人工調整記錄差額與原因", () => {
    const r = adjustStock({
      supplement: makeSupplement({ stockQuantity: 10 }),
      newQuantity: 7,
      reason: "盤點少了 3 顆",
      now,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.supplement.stockQuantity).toBe(7);
    expect(r.value.transaction.type).toBe("adjustment");
    expect(r.value.transaction.quantityDelta).toBe(-3);
    expect(r.value.transaction.note).toBe("盤點少了 3 顆");
  });

  it("人工調整不可為負數", () => {
    const r = adjustStock({ supplement: makeSupplement(), newQuantity: -1, reason: "x", now });
    expect(r.ok).toBe(false);
  });
});

describe("庫存與異動紀錄一致性", () => {
  it("一連串操作後，異動加總等於庫存", () => {
    let s = makeSupplement({ stockQuantity: 10 });
    const tx: InventoryTransaction[] = [initialTransaction(s, now)];
    const logs: IntakeLog[] = [];

    const take = (slot: Supplement["scheduleSlots"][number], date: string) => {
      const r = takeIntake({ supplement: s, planDate: date, slot, existingLogs: logs, now });
      if (!r.ok) throw new Error(r.error.message);
      s = r.value.supplement;
      logs.push(r.value.log);
      tx.push(r.value.transaction);
      return r.value.log;
    };

    const log1 = take("after_breakfast", "2026-11-06");
    take("after_dinner", "2026-11-06");
    const rev = reverseIntake({ supplement: s, log: log1, now });
    if (!rev.ok) throw new Error();
    s = rev.value.supplement;
    tx.push(rev.value.transaction);
    const re = restock({ supplement: s, quantity: 5.5, now });
    if (!re.ok) throw new Error();
    s = re.value.supplement;
    tx.push(re.value.transaction);
    const adj = adjustStock({ supplement: s, newQuantity: 12, reason: "盤點", now });
    if (!adj.ok) throw new Error();
    s = adj.value.supplement;
    tx.push(adj.value.transaction);

    expect(s.stockQuantity).toBe(12);
    expect(ledgerBalance(tx, "s1")).toBe(12);
  });
});
