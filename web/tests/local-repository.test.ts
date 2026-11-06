import { describe, expect, it } from "vitest";
import { ledgerBalance } from "@/lib/domain/ledger";
import type { SupplementInput } from "@/lib/domain/validation";
import { LocalRepository, MemoryStorage } from "@/lib/store/local-repository";

const input: SupplementInput = {
  name: "維生素 C",
  brand: undefined,
  productForm: "tablet",
  servingSize: undefined,
  dosePerIntake: 1,
  doseUnit: "錠",
  dailyFrequency: 1,
  scheduleSlots: ["after_breakfast"],
  stockQuantity: 5,
  lowStockThreshold: 2,
  expirationDate: undefined,
  notes: undefined,
};

describe("LocalRepository", () => {
  it("第一次載入自動放入範例資料，且庫存與異動一致", async () => {
    const repo = new LocalRepository(new MemoryStorage());
    const snap = await repo.load();
    expect(snap.supplements.length).toBeGreaterThan(0);
    for (const s of snap.supplements) {
      expect(ledgerBalance(snap.transactions, s.id)).toBe(s.stockQuantity);
    }
    expect(snap.intakeLogs.length).toBeGreaterThan(0);
  });

  it("資料會持久化到 storage，重新建立 repository 後仍存在", async () => {
    const storage = new MemoryStorage();
    const repo = new LocalRepository(storage);
    await repo.clearAll();
    const { supplement } = await repo.createSupplement(input);
    const again = new LocalRepository(storage);
    const snap = await again.load();
    expect(snap.supplements.map((s) => s.id)).toEqual([supplement.id]);
    expect(snap.transactions[0]).toMatchObject({ type: "initial", quantityDelta: 5 });
  });

  it("勾選 → 重複勾選被擋 → 撤銷 → 重複撤銷被擋，庫存只動一次", async () => {
    const repo = new LocalRepository(new MemoryStorage());
    await repo.clearAll();
    const { supplement } = await repo.createSupplement(input);
    const params = {
      supplementId: supplement.id,
      planDate: "2026-11-06",
      slot: "after_breakfast" as const,
      ordinal: 0,
    };

    const a = await repo.takeIntake(params);
    expect(a.ok).toBe(true);
    const b = await repo.takeIntake(params);
    expect(b.ok).toBe(false);
    let snap = await repo.load();
    expect(snap.supplements[0].stockQuantity).toBe(4);

    if (!a.ok) return;
    const c = await repo.reverseIntake(a.value.log.id);
    expect(c.ok).toBe(true);
    const d = await repo.reverseIntake(a.value.log.id);
    expect(d.ok).toBe(false);
    snap = await repo.load();
    expect(snap.supplements[0].stockQuantity).toBe(5);
    expect(ledgerBalance(snap.transactions, supplement.id)).toBe(5);
  });

  it("編輯時改庫存會記 adjustment；改名不影響既有紀錄快照", async () => {
    const repo = new LocalRepository(new MemoryStorage());
    await repo.clearAll();
    const { supplement } = await repo.createSupplement(input);
    await repo.takeIntake({ supplementId: supplement.id, planDate: "2026-11-06", slot: "after_breakfast", ordinal: 0 });

    const r = await repo.updateSupplement(supplement.id, { ...input, name: "維他命 C", stockQuantity: 10 });
    expect(r.transaction?.type).toBe("adjustment");
    expect(r.transaction?.quantityDelta).toBe(6); // 4 → 10
    const snap = await repo.load();
    expect(snap.supplements[0].name).toBe("維他命 C");
    expect(snap.intakeLogs[0].supplementNameSnapshot).toBe("維生素 C");
    expect(ledgerBalance(snap.transactions, supplement.id)).toBe(10);
  });

  it("補貨與封存", async () => {
    const repo = new LocalRepository(new MemoryStorage());
    await repo.clearAll();
    const { supplement } = await repo.createSupplement(input);
    const r = await repo.restock(supplement.id, {
      quantity: 30,
      note: undefined,
      purchaseDate: undefined,
      expirationDate: "2027-06-30",
    });
    expect(r.ok).toBe(true);
    const archived = await repo.setSupplementStatus(supplement.id, "archived");
    expect(archived.status).toBe("archived");
    const snap = await repo.load();
    expect(snap.supplements[0]).toMatchObject({ stockQuantity: 35, expirationDate: "2027-06-30", status: "archived" });
  });

  it("storage 內容損毀時回報錯誤而不是靜默重置", async () => {
    const storage = new MemoryStorage();
    storage.setItem("supplemate:v1", "{not json");
    const repo = new LocalRepository(storage);
    await expect(repo.load()).rejects.toThrow();
  });
});
