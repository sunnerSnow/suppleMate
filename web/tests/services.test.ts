import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/local";
import { withUser } from "@/lib/db/with-user";
import type { SupplementInput } from "@/lib/domain/validation";
import { adjustStockDb, restockDb, reverseIntakeDb, takeIntakeDb } from "@/lib/services/ledger";
import { getProfile, updateProfile } from "@/lib/services/profiles";
import { clearUserData, resetWithSampleData, seedSampleData } from "@/lib/services/sample";
import { loadSnapshot } from "@/lib/services/snapshot";
import { createSupplement, setSupplementStatus, updateSupplement } from "@/lib/services/supplements";
import { createTestDb, createUser, expectDbRejects, rowsOf } from "./helpers/db";

const input: SupplementInput = {
  name: "維生素 C",
  brand: undefined,
  productForm: "tablet",
  servingSize: undefined,
  dosePerIntake: 1,
  doseUnit: "錠",
  dailyFrequency: 2,
  scheduleSlots: ["after_breakfast", "after_dinner"],
  stockQuantity: 5,
  lowStockThreshold: 2,
  expirationDate: undefined,
  notes: undefined,
};

let db: Db;
let userA: string;
let userB: string;

beforeEach(async () => {
  db = await createTestDb();
  userA = await createUser(db);
  userB = await createUser(db);
});

/** 異動帳加總，用 SQL 直接算（不經過服務層） */
async function ledgerSum(userId: string, supplementId: string): Promise<number> {
  const rows = rowsOf<{ total: string }>(
    await db.execute(
      sql`select coalesce(sum(quantity_delta), 0)::text as total from sm.inventory_transactions where user_id = ${userId} and supplement_id = ${supplementId}`,
    ),
  );
  return Number(rows[0].total);
}

describe("保健品 CRUD（Postgres／PGlite）", () => {
  it("新增會記初始庫存異動；編輯改庫存會記 adjustment；封存後快照仍保留", async () => {
    const { supplement, transaction } = await createSupplement(db, userA, input);
    expect(transaction).toMatchObject({ type: "initial", quantityDelta: 5 });
    expect(supplement.stockQuantity).toBe(5);

    const edited = await updateSupplement(db, userA, supplement.id, { ...input, name: "維他命 C", stockQuantity: 12 });
    expect(edited.supplement.name).toBe("維他命 C");
    expect(edited.transaction).toMatchObject({ type: "adjustment", quantityDelta: 7 });
    expect(await ledgerSum(userA, supplement.id)).toBe(12);

    const archived = await setSupplementStatus(db, userA, supplement.id, "archived");
    expect(archived.status).toBe("archived");
  });

  it("編輯時清空選填欄位會真的存成空值", async () => {
    const { supplement } = await createSupplement(db, userA, {
      ...input,
      brand: "品牌",
      notes: "備註",
      expirationDate: "2027-01-01",
      servingSize: "1 錠",
    });
    const edited = await updateSupplement(db, userA, supplement.id, {
      ...input,
      brand: "",
      notes: "",
      expirationDate: "",
      servingSize: "",
    });
    expect(edited.supplement.brand).toBeUndefined();
    expect(edited.supplement.notes).toBeUndefined();
    expect(edited.supplement.expirationDate).toBeUndefined();
    expect(edited.supplement.servingSize).toBeUndefined();
    const snap = await loadSnapshot(db, userA);
    expect(snap.supplements[0].notes).toBeUndefined();
    expect(snap.supplements[0].createdAt).toMatch(/T.*Z$/);
  });

  it("輸入驗證在伺服器端也會擋", async () => {
    await expect(createSupplement(db, userA, { ...input, dosePerIntake: -1 })).rejects.toMatchObject({
      code: "validation_failed",
    });
    await expect(createSupplement(db, userA, { ...input, scheduleSlots: ["bedtime"] })).rejects.toMatchObject({
      code: "validation_failed",
    });
  });
});

describe("勾選／取消／補貨（交易內）", () => {
  it("勾選扣庫存一次，重複勾選被擋；撤銷回補一次，重複撤銷被擋；帳目一致", async () => {
    const { supplement } = await createSupplement(db, userA, input);
    const params = {
      supplementId: supplement.id,
      planDate: "2026-11-09",
      slot: "after_breakfast" as const,
      ordinal: 0,
    };

    const a = await takeIntakeDb(db, userA, params);
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    expect(a.value.supplement.stockQuantity).toBe(4);
    expect(a.value.log.supplementNameSnapshot).toBe("維生素 C");

    const b = await takeIntakeDb(db, userA, params);
    expect(b.ok).toBe(false);
    if (b.ok) return;
    expect(b.error.code).toBe("ALREADY_TAKEN");

    const other = await takeIntakeDb(db, userA, { ...params, slot: "after_dinner" });
    expect(other.ok).toBe(true);

    const c = await reverseIntakeDb(db, userA, a.value.log.id);
    expect(c.ok).toBe(true);
    const d = await reverseIntakeDb(db, userA, a.value.log.id);
    expect(d.ok).toBe(false);
    if (d.ok) return;
    expect(d.error.code).toBe("ALREADY_REVERSED");

    const snap = await loadSnapshot(db, userA);
    expect(snap.supplements[0].stockQuantity).toBe(4);
    expect(await ledgerSum(userA, supplement.id)).toBe(4);
    expect(snap.intakeLogs.filter((l) => l.status === "taken")).toHaveLength(1);
    expect(snap.intakeLogs.filter((l) => l.status === "reversed")).toHaveLength(1);
  });

  it("時段或序號不在計畫內、日期或 id 格式錯誤都會被擋", async () => {
    const { supplement } = await createSupplement(db, userA, input); // after_breakfast、after_dinner 各一次
    const wrongSlot = await takeIntakeDb(db, userA, {
      supplementId: supplement.id,
      planDate: "2026-11-09",
      slot: "bedtime",
      ordinal: 0,
    });
    expect(wrongSlot.ok).toBe(false);
    if (wrongSlot.ok) return;
    expect(wrongSlot.error.code).toBe("INVALID_PLAN_ITEM");
    const extraOrdinal = await takeIntakeDb(db, userA, {
      supplementId: supplement.id,
      planDate: "2026-11-09",
      slot: "after_breakfast",
      ordinal: 1,
    });
    expect(extraOrdinal.ok).toBe(false);
    await expect(
      takeIntakeDb(db, userA, {
        supplementId: supplement.id,
        planDate: "2026-13-45",
        slot: "after_breakfast",
        ordinal: 0,
      }),
    ).rejects.toMatchObject({ code: "validation_failed" });
    await expect(
      takeIntakeDb(db, userA, {
        supplementId: "not-a-uuid",
        planDate: "2026-11-09",
        slot: "after_breakfast",
        ordinal: 0,
      }),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(reverseIntakeDb(db, userA, "not-a-uuid")).rejects.toMatchObject({ code: "not_found" });
    expect(await ledgerSum(userA, supplement.id)).toBe(5);
  });

  it("資料庫的部分唯一索引擋下第二筆 taken（即使繞過服務層）", async () => {
    const { supplement } = await createSupplement(db, userA, input);
    const r = await takeIntakeDb(db, userA, {
      supplementId: supplement.id,
      planDate: "2026-11-09",
      slot: "after_breakfast",
      ordinal: 0,
    });
    expect(r.ok).toBe(true);
    const message = await expectDbRejects(
      db.execute(
        sql`insert into sm.intake_logs (user_id, supplement_id, plan_date, plan_slot, plan_item_key, supplement_name_snapshot, dose_snapshot, unit_snapshot, status)
            values (${userA}, ${supplement.id}, '2026-11-09', 'after_breakfast', ${`${supplement.id}|2026-11-09|after_breakfast|0`}, 'x', 1, '錠', 'taken')`,
      ),
    );
    expect(message).toMatch(/intake_logs_taken_once_uq/);
  });

  it("庫存不足預設拒絕，明確確認後記錄並允許負庫存", async () => {
    const { supplement } = await createSupplement(db, userA, { ...input, stockQuantity: 0 });
    const denied = await takeIntakeDb(db, userA, {
      supplementId: supplement.id,
      planDate: "2026-11-09",
      slot: "after_breakfast",
      ordinal: 0,
    });
    expect(denied.ok).toBe(false);
    const forced = await takeIntakeDb(db, userA, {
      supplementId: supplement.id,
      planDate: "2026-11-09",
      slot: "after_breakfast",
      ordinal: 0,
      allowInsufficientStock: true,
    });
    expect(forced.ok).toBe(true);
    if (!forced.ok) return;
    expect(forced.value.supplement.stockQuantity).toBe(-1);
    expect(await ledgerSum(userA, supplement.id)).toBe(-1);
  });

  it("補貨與人工調整", async () => {
    const { supplement } = await createSupplement(db, userA, input);
    const r = await restockDb(db, userA, supplement.id, { quantity: 30, expirationDate: "2027-06-30", note: "藥局" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.supplement.stockQuantity).toBe(35);
    expect(r.value.supplement.expirationDate).toBe("2027-06-30");
    const adj = await adjustStockDb(db, userA, supplement.id, { newQuantity: 20, reason: "盤點" });
    expect(adj.ok).toBe(true);
    expect(await ledgerSum(userA, supplement.id)).toBe(20);
    await expect(restockDb(db, userA, supplement.id, { quantity: 0 })).rejects.toMatchObject({
      code: "validation_failed",
    });
  });
});

describe("使用者隔離（RLS）", () => {
  it("使用者 B 看不到、也動不了 A 的資料", async () => {
    const { supplement } = await createSupplement(db, userA, input);
    const snapB = await loadSnapshot(db, userB);
    expect(snapB.supplements).toHaveLength(0);

    await expect(updateSupplement(db, userB, supplement.id, input)).rejects.toMatchObject({ code: "not_found" });
    await expect(
      takeIntakeDb(db, userB, { supplementId: supplement.id, planDate: "2026-11-09", slot: "bedtime", ordinal: 0 }),
    ).rejects.toMatchObject({ code: "not_found" });

    // 直接用 B 的身分對 A 的列下 SQL：RLS 讓它看起來不存在
    const rows = rowsOf<{ n: number }>(
      await withUser(db, userB, (tx) =>
        tx.execute(sql`select count(*)::int n from sm.supplements where id = ${supplement.id}`),
      ),
    );
    expect(rows[0].n).toBe(0);
    // 以 B 的身分插入 user_id = A 的列會被 with check 擋下
    const message = await expectDbRejects(
      withUser(db, userB, (tx) =>
        tx.execute(
          sql`insert into sm.supplements (user_id, name, dose_per_intake, dose_unit, daily_frequency, schedule_slots, stock_quantity, low_stock_threshold)
              values (${userA}, 'x', 1, '顆', 1, array['bedtime'], 1, 0)`,
        ),
      ),
    );
    expect(message).toMatch(/row-level security/i);
  });
});

describe("個人設定與範例資料", () => {
  it("profile 預設時區 Asia/Taipei，可改時區，不合法的時區被拒絕", async () => {
    expect((await getProfile(db, userA))?.timezone).toBe("Asia/Taipei");
    const updated = await updateProfile(db, userA, { timezone: "Asia/Tokyo" });
    expect(updated.timezone).toBe("Asia/Tokyo");
    await expect(updateProfile(db, userA, { timezone: "Mars/Olympus" })).rejects.toMatchObject({
      code: "validation_failed",
    });
  });

  it("範例資料的庫存與異動帳一致，重設與清除只影響自己", async () => {
    await seedSampleData(db, userA);
    const snap = await loadSnapshot(db, userA);
    expect(snap.supplements.length).toBeGreaterThan(3);
    for (const s of snap.supplements) expect(await ledgerSum(userA, s.id)).toBe(s.stockQuantity);
    expect(snap.intakeLogs.length).toBeGreaterThan(0);

    await createSupplement(db, userB, input);
    const reset = await resetWithSampleData(db, userA);
    expect(reset.supplements.length).toBe(snap.supplements.length);
    const cleared = await clearUserData(db, userA);
    expect(cleared.supplements).toHaveLength(0);
    expect(cleared.intakeLogs).toHaveLength(0);
    expect((await loadSnapshot(db, userB)).supplements).toHaveLength(1);
  });
});
