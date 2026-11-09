import { describe, expect, it } from "vitest";
import { BUILTIN_ENTRIES } from "@/lib/knowledge/builtin";
import {
  GOAL_SUPPORT,
  checkupSummary,
  runCheckupRules,
  type CheckupItem,
  type CheckupProfile,
} from "@/lib/knowledge/checkup";
import { suggestSlots } from "@/lib/knowledge/advice";
import { sanitizeReport } from "@/lib/knowledge/checkup-report";
import { findBuiltin } from "@/lib/knowledge/match";
import { getCheckup, inputHash, runCheckup } from "@/lib/services/checkup";
import { getProfile, updateProfile } from "@/lib/services/profiles";
import { createSupplement } from "@/lib/services/supplements";
import type { ScheduleSlot, Supplement } from "@/lib/types";
import { createTestDb, createUser } from "./helpers/db";

let seq = 0;
const sup = (
  name: string,
  slots: ScheduleSlot[] = ["after_breakfast"],
  overrides: Partial<Supplement> = {},
): Supplement => ({
  id: `s${++seq}`,
  name,
  dosePerIntake: 1,
  doseUnit: "顆",
  dailyFrequency: slots.length,
  scheduleSlots: slots,
  stockQuantity: 10,
  lowStockThreshold: 2,
  status: "active",
  createdAt: "2026-11-09T00:00:00.000Z",
  updatedAt: "2026-11-09T00:00:00.000Z",
  ...overrides,
});
const item = (name: string, slots?: ScheduleSlot[], overrides?: Partial<Supplement>): CheckupItem => {
  const supplement = sup(name, slots, overrides);
  return { supplement, entry: findBuiltin(name) };
};
const none: CheckupProfile = { healthGoals: [], ageRange: undefined, sex: undefined };
const ids = (findings: ReturnType<typeof runCheckupRules>) => findings.map((f) => f.id);

describe("健檢規則", () => {
  it("GOAL_SUPPORT 列的名稱都對得到內建小知識", () => {
    for (const names of Object.values(GOAL_SUPPORT))
      for (const n of names) expect(findBuiltin(n)?.name, n).toBeTruthy();
  });

  it("同成分兩項 → 可以考慮不用；綜合維他命＋單方 → 注意總量", () => {
    const f = runCheckupRules([item("魚油"), item("Fish Oil 1000mg"), item("綜合維他命"), item("維生素 C")], none);
    const dup = f.find((x) => x.kind === "drop");
    expect(dup?.supplementIds).toHaveLength(2);
    expect(ids(f)).toContain("multi-overlap");
  });

  it("要分開卻同時段 → 高優先調整；尚未確認 → 可一鍵套用；隨餐卻排空腹 → 低優先調整", () => {
    const f = runCheckupRules(
      [
        item("鈣", ["after_dinner"]),
        item("鐵", ["after_dinner"]),
        item("魚油", ["unconfirmed"]),
        item("維生素 D", ["before_breakfast"]),
      ],
      none,
    );
    expect(f[0].kind).toBe("adjust");
    expect(f[0].severity).toBe("high");
    expect(f[0].supplementIds).toHaveLength(2);
    const unconfirmed = f.find((x) => x.id.startsWith("unconfirmed:"));
    expect(unconfirmed?.applySlots?.slots).toEqual(["after_breakfast"]);
    // 鐵是空腹、排在晚餐後也會被提醒；這裡看維生素 D（隨餐卻排早餐前）
    const food = f.find((x) => x.id.startsWith("food:") && x.title.includes("建議隨餐"));
    expect(food?.title).toContain("建議隨餐");
    expect(food?.applySlots?.slots).toEqual(["after_breakfast"]);
    // 已封存的不算
    const archived = runCheckupRules(
      [item("鈣", ["after_dinner"]), item("鐵", ["after_dinner"], { status: "archived" })],
      none,
    );
    expect(archived.some((x) => x.id.startsWith("sep:"))).toBe(false);
  });

  it("目標沒有對應的保健品 → 建議增加；已有就不提；素食看 B12", () => {
    const f = runCheckupRules([item("魚油")], {
      healthGoals: ["heart", "sleep", "vegetarian"],
      ageRange: undefined,
      sex: undefined,
    });
    expect(ids(f)).not.toContain("goal:heart");
    expect(f.find((x) => x.id === "goal:sleep")?.candidates).toContain("鎂");
    expect(ids(f)).toContain("goal:vegetarian");
    const withB12 = runCheckupRules([item("維生素 B12")], {
      healthGoals: ["vegetarian"],
      ageRange: undefined,
      sex: undefined,
    });
    expect(ids(withB12)).not.toContain("goal:vegetarian");
  });

  it("常見搭配還沒有 → 低優先建議增加（鈣 → 維生素 D）", () => {
    const f = runCheckupRules([item("鈣")], none);
    expect(f.find((x) => x.id === "pair:維生素 D")?.candidates).toEqual(["維生素 D"]);
    expect(runCheckupRules([item("鈣"), item("維生素 D")], none).some((x) => x.id === "pair:維生素 D")).toBe(false);
  });

  it("年齡與性別：男性補鐵 → 注意；65 歲以上缺 D／鈣／B12 → 建議；未成年 → 高優先注意", () => {
    const male = runCheckupRules([item("鐵")], { healthGoals: [], ageRange: "30_44", sex: "male" });
    expect(ids(male)).toContain("iron-check");
    expect(ids(runCheckupRules([item("鐵")], { healthGoals: [], ageRange: "30_44", sex: "female" }))).not.toContain(
      "iron-check",
    );
    const senior = runCheckupRules([item("維生素 D")], { healthGoals: [], ageRange: "65_plus", sex: undefined });
    expect(senior.find((x) => x.id === "age:65")?.candidates).toEqual(["鈣", "維生素 B12"]);
    const minor = runCheckupRules([], { healthGoals: [], ageRange: "under_18", sex: undefined });
    expect(minor[0]).toMatchObject({ id: "age:minor", severity: "high" });
    const summary = checkupSummary(senior);
    expect(summary.add).toBeGreaterThan(0);
  });

  it("套用內建資料的建議時段後，不會再被隨餐／空腹規則提醒", () => {
    for (const e of BUILTIN_ENTRIES) {
      const slots = suggestSlots(e, 1);
      const f = runCheckupRules([{ supplement: sup(e.name, slots), entry: e }], none);
      expect(
        f.some((x) => x.id.startsWith("food:")),
        e.name,
      ).toBe(false);
    }
  });

  it("同一名稱不會被目標與搭配兩條規則重複建議；品名沒對到小知識時目標建議降為可考慮", () => {
    const f = runCheckupRules([item("鈣")], { healthGoals: ["immunity"], ageRange: undefined, sex: undefined });
    expect(ids(f)).toContain("goal:immunity");
    expect(ids(f)).not.toContain("pair:維生素 D");
    const g = runCheckupRules([item("某牌神秘配方")], {
      healthGoals: ["heart"],
      ageRange: undefined,
      sex: undefined,
    });
    const goal = g.find((x) => x.id === "goal:heart");
    expect(goal?.severity).toBe("low");
    expect(goal?.detail).toContain("沒對到小知識");
  });

  it("同一時段 5 項以上 → 建議分散", () => {
    const f = runCheckupRules(
      ["魚油", "維生素 C", "B 群", "鋅", "益生菌"].map((n) => item(n, ["after_breakfast"])),
      none,
    );
    expect(ids(f)).toContain("crowded:after_breakfast");
  });

  it("AI 報告的 remove／adjust 只保留清單裡的名稱", () => {
    const r = sanitizeReport(
      {
        overview: "ok",
        add: [{ name: "維生素 D", reason: "r", priority: "low" }],
        remove: [
          { name: "魚油", reason: "r" },
          { name: "不存在的東西", reason: "r" },
        ],
        adjust: [{ name: "Fish Oil 1000mg", change: "c", reason: "r" }],
        cautions: [],
        askProfessional: [],
      },
      ["魚油", "Fish Oil 1000mg"],
    );
    expect(r.remove.map((x) => x.name)).toEqual(["魚油"]);
    expect(r.adjust).toHaveLength(1);
  });
});

describe("健檢服務（PGlite，mock provider）", () => {
  const input = (name: string) => ({
    name,
    dosePerIntake: 1,
    doseUnit: "顆",
    dailyFrequency: 1,
    scheduleSlots: ["after_breakfast"],
    stockQuantity: 10,
    lowStockThreshold: 2,
  });

  it("個人資料：目標／年齡／性別可存可清，不合法的值被拒", async () => {
    const db = await createTestDb();
    const user = await createUser(db);
    const p = await updateProfile(db, user, {
      healthGoals: ["sleep", "heart", "sleep"],
      ageRange: "30_44",
      sex: "female",
    });
    expect(p.healthGoals).toEqual(["sleep", "heart"]);
    expect(p.ageRange).toBe("30_44");
    expect((await getProfile(db, user))?.sex).toBe("female");
    expect((await updateProfile(db, user, { ageRange: null })).ageRange).toBeUndefined();
    await expect(updateProfile(db, user, { healthGoals: ["hacking"] })).rejects.toMatchObject({
      code: "validation_failed",
    });
    await expect(updateProfile(db, user, { sex: "x" })).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("沒有保健品也沒有目標就拒絕；有資料時產生報告並快取；資料改了就過期", async () => {
    process.env.AI_HOURLY_LIMIT = "1";
    try {
      const db = await createTestDb();
      const user = await createUser(db);
      expect(await getCheckup(db, user)).toBeNull();
      await expect(runCheckup(db, user)).rejects.toMatchObject({ code: "validation_failed" });

      await createSupplement(db, user, input("魚油"));
      const first = await runCheckup(db, user);
      expect(first.source).toBe("mock");
      expect(first.stale).toBe(false);
      // 每小時只允許 1 次，但同樣的資料直接回快取、不扣額度
      const again = await runCheckup(db, user);
      expect(again.updatedAt).toBe(first.updatedAt);
      expect((await getCheckup(db, user))?.stale).toBe(false);

      await updateProfile(db, user, { healthGoals: ["sleep"] });
      expect((await getCheckup(db, user))?.stale).toBe(true);
      // 資料變了要重新產生，這次就會撞到額度
      await expect(runCheckup(db, user)).rejects.toMatchObject({ code: "rate_limited" });
    } finally {
      delete process.env.AI_HOURLY_LIMIT;
    }
  });

  it("雜湊只看會影響分析的欄位", () => {
    const a = inputHash([item("魚油", ["after_breakfast"])], {
      healthGoals: ["sleep"],
      ageRange: undefined,
      sex: undefined,
    });
    const b = inputHash([item("魚油", ["after_breakfast"], { notes: "x", stockQuantity: 99 })], {
      healthGoals: ["sleep"],
      ageRange: undefined,
      sex: undefined,
    });
    const c = inputHash([item("魚油", ["after_dinner"])], {
      healthGoals: ["sleep"],
      ageRange: undefined,
      sex: undefined,
    });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
