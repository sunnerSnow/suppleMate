import { z } from "zod";
import { MAX_DAILY_FREQUENCY } from "../constants";
import { isIsoDate } from "../date";
import { PRODUCT_FORMS, SCHEDULE_SLOTS } from "../types";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `最多 ${max} 個字`)
    .optional()
    .transform((v) => (v ? v : undefined));

const optionalIsoDate = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || isIsoDate(v), "日期格式需為 YYYY-MM-DD");

const quantity = (label: string) =>
  z
    .number({ error: `${label}必須為有效數字` })
    .finite(`${label}必須為有效數字`)
    .min(0, `${label}不可小於 0`)
    .max(1_000_000, `${label}過大`);

/** 新增／編輯保健品表單的驗證規則 */
export const supplementInputSchema = z
  .object({
    name: z.string().trim().min(1, "請輸入名稱").max(60, "名稱最多 60 個字"),
    brand: optionalText(60),
    productForm: z.enum(PRODUCT_FORMS).optional(),
    servingSize: optionalText(30),
    dosePerIntake: quantity("每次服用量"),
    doseUnit: z.string().trim().min(1, "請輸入單位").max(10, "單位最多 10 個字"),
    dailyFrequency: z
      .number({ error: "每日次數必須為正整數" })
      .int("每日次數必須為正整數")
      .min(1, "每日次數至少 1 次")
      .max(MAX_DAILY_FREQUENCY, `每日次數最多 ${MAX_DAILY_FREQUENCY} 次`),
    scheduleSlots: z.array(z.enum(SCHEDULE_SLOTS)).min(1, "請選擇服用時段"),
    stockQuantity: quantity("庫存"),
    lowStockThreshold: quantity("低庫存門檻"),
    expirationDate: optionalIsoDate,
    notes: optionalText(500),
  })
  .refine((v) => v.scheduleSlots.length === v.dailyFrequency, {
    path: ["scheduleSlots"],
    message: "服用時段數量需與每日次數相同",
  });

export type SupplementInput = z.infer<typeof supplementInputSchema>;

export type FieldErrors = Partial<Record<string, string>>;

/** 把 zod 錯誤整理成「欄位 → 第一則訊息」，表單直接顯示 */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_form");
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

export const restockInputSchema = z.object({
  quantity: z
    .number({ error: "請輸入有效數字" })
    .finite("請輸入有效數字")
    .positive("補貨數量必須大於 0")
    .max(1_000_000, "數量過大"),
  purchaseDate: optionalIsoDate,
  expirationDate: optionalIsoDate,
  note: optionalText(200),
});

export type RestockInput = z.infer<typeof restockInputSchema>;

export const adjustInputSchema = z.object({
  newQuantity: quantity("庫存"),
  reason: z.string().trim().min(1, "請填寫調整原因").max(200, "最多 200 個字"),
});

export type AdjustInput = z.infer<typeof adjustInputSchema>;
