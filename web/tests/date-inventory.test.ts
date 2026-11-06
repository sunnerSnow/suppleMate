import { describe, expect, it } from "vitest";
import { addDays, diffDays, formatTime, isIsoDate, relativeDayLabel, toPlanDate } from "@/lib/date";
import { dailyConsumption, estimateDaysLeft, formatQuantity, stockStatus } from "@/lib/domain/inventory";

describe("toPlanDate（時區）", () => {
  it("UTC 深夜在台北已是隔天", () => {
    // 2026-11-05 17:30 UTC = 2026-11-06 01:30 Asia/Taipei
    expect(toPlanDate(new Date("2026-11-05T17:30:00Z"), "Asia/Taipei")).toBe("2026-11-06");
    expect(toPlanDate(new Date("2026-11-05T17:30:00Z"), "UTC")).toBe("2026-11-05");
  });
  it("台北 23:59 仍是同一天", () => {
    expect(toPlanDate(new Date("2026-11-06T15:59:00Z"), "Asia/Taipei")).toBe("2026-11-06");
  });
  it("formatTime 以使用者時區顯示", () => {
    expect(formatTime("2026-11-05T17:30:00Z", "Asia/Taipei")).toBe("01:30");
  });
});

describe("addDays / diffDays", () => {
  it("跨月跨年正確", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(diffDays("2026-11-06", "2026-11-08")).toBe(2);
    expect(diffDays("2026-11-06", "2026-11-05")).toBe(-1);
  });
  it("relativeDayLabel", () => {
    expect(relativeDayLabel("2026-11-06", "2026-11-06")).toBe("今天");
    expect(relativeDayLabel("2026-11-05", "2026-11-06")).toBe("昨天");
    expect(relativeDayLabel("2026-11-07", "2026-11-06")).toBe("明天");
    expect(relativeDayLabel("2026-11-01", "2026-11-06")).toBeNull();
  });
  it("isIsoDate", () => {
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2026-11-06")).toBe(true);
    expect(isIsoDate("2026/11/06")).toBe(false);
  });
});

describe("inventory", () => {
  it("每日消耗量 = 每次用量 × 每日次數", () => {
    expect(dailyConsumption({ dosePerIntake: 1.5, dailyFrequency: 2 })).toBe(3);
  });
  it("預估剩餘天數向下取整", () => {
    expect(
      estimateDaysLeft({
        dosePerIntake: 1,
        dailyFrequency: 2,
        stockQuantity: 9,
        scheduleSlots: ["after_breakfast", "bedtime"],
      }),
    ).toBe(4);
  });
  it("消耗量 0 或全部尚未確認時無法估算", () => {
    expect(
      estimateDaysLeft({ dosePerIntake: 0, dailyFrequency: 1, stockQuantity: 9, scheduleSlots: ["bedtime"] }),
    ).toBeNull();
    expect(
      estimateDaysLeft({ dosePerIntake: 1, dailyFrequency: 1, stockQuantity: 9, scheduleSlots: ["unconfirmed"] }),
    ).toBeNull();
  });
  it("部分時段未確認仍可估算（使用者已輸入每日次數）", () => {
    expect(
      estimateDaysLeft({
        dosePerIntake: 1,
        dailyFrequency: 2,
        stockQuantity: 10,
        scheduleSlots: ["bedtime", "unconfirmed"],
      }),
    ).toBe(5);
  });
  it("庫存 0 → 0 天", () => {
    expect(
      estimateDaysLeft({ dosePerIntake: 1, dailyFrequency: 1, stockQuantity: 0, scheduleSlots: ["bedtime"] }),
    ).toBe(0);
  });
  it("庫存狀態以門檻判斷", () => {
    expect(stockStatus({ stockQuantity: 20, lowStockThreshold: 5, dosePerIntake: 1 })).toBe("sufficient");
    expect(stockStatus({ stockQuantity: 5, lowStockThreshold: 5, dosePerIntake: 1 })).toBe("low");
    expect(stockStatus({ stockQuantity: 0, lowStockThreshold: 5, dosePerIntake: 1 })).toBe("out");
    expect(stockStatus({ stockQuantity: 1, lowStockThreshold: 0, dosePerIntake: 2 })).toBe("out");
  });
  it("formatQuantity", () => {
    expect(formatQuantity(3)).toBe("3");
    expect(formatQuantity(0.1 + 0.2)).toBe("0.3");
  });
});
