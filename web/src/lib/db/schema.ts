import { date, integer, jsonb, numeric, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { authSchema } from "@/lib/db/auth-schema";
import { AGE_RANGES, HEALTH_GOALS, PRODUCT_FORMS, SCHEDULE_SLOTS, SEXES } from "@/lib/types";

/**
 * 與 db/migrations/20261109000100_init.sql 對應的 Drizzle schema（帳號表在 auth-schema.ts）。
 * 約束、RLS 與權限以 SQL migration 為準；這裡只描述欄位，讓查詢有型別。
 * 時間戳用 string（ISO）、日期用 string（YYYY-MM-DD），與領域型別一致；數量用 number。
 */
export const sm = pgSchema("sm");

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "string" });
const qty = (name: string) => numeric(name, { precision: 12, scale: 3, mode: "number" });

export const profiles = sm.table("profiles", {
  id: uuid("id").primaryKey(),
  email: text("email"),
  displayName: text("display_name"),
  timezone: text("timezone").notNull().default("Asia/Taipei"),
  theme: text("theme", { enum: ["c", "e"] })
    .notNull()
    .default("c"),
  healthGoals: text("health_goals", { enum: HEALTH_GOALS }).array().notNull().default([]),
  ageRange: text("age_range", { enum: AGE_RANGES }),
  sex: text("sex", { enum: SEXES }),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

/** AI 健檢報告（每位使用者一份；input_hash 不等於目前資料的雜湊就是過期） */
export const checkups = sm.table("checkups", {
  userId: uuid("user_id").primaryKey(),
  inputHash: text("input_hash").notNull(),
  report: jsonb("report").notNull(),
  source: text("source", { enum: ["ai", "mock"] }).notNull(),
  model: text("model"),
  promptVersion: text("prompt_version").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const supplements = sm.table("supplements", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  name: text("name").notNull(),
  brand: text("brand"),
  productForm: text("product_form", { enum: PRODUCT_FORMS }),
  servingSize: text("serving_size"),
  dosePerIntake: qty("dose_per_intake").notNull(),
  doseUnit: text("dose_unit").notNull(),
  dailyFrequency: integer("daily_frequency").notNull(),
  scheduleSlots: text("schedule_slots", { enum: SCHEDULE_SLOTS }).array().notNull(),
  stockQuantity: qty("stock_quantity").notNull(),
  lowStockThreshold: qty("low_stock_threshold").notNull(),
  expirationDate: date("expiration_date", { mode: "string" }),
  notes: text("notes"),
  status: text("status", { enum: ["active", "archived"] })
    .notNull()
    .default("active"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const intakeLogs = sm.table("intake_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  supplementId: uuid("supplement_id").notNull(),
  planDate: date("plan_date", { mode: "string" }).notNull(),
  planSlot: text("plan_slot", { enum: SCHEDULE_SLOTS }).notNull(),
  planItemKey: text("plan_item_key").notNull(),
  supplementNameSnapshot: text("supplement_name_snapshot").notNull(),
  doseSnapshot: qty("dose_snapshot").notNull(),
  unitSnapshot: text("unit_snapshot").notNull(),
  status: text("status", { enum: ["taken", "reversed"] }).notNull(),
  takenAt: ts("taken_at"),
  reversedAt: ts("reversed_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const inventoryTransactions = sm.table("inventory_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  supplementId: uuid("supplement_id").notNull(),
  type: text("type", { enum: ["initial", "intake", "reversal", "restock", "adjustment"] }).notNull(),
  quantityDelta: qty("quantity_delta").notNull(),
  relatedIntakeLogId: uuid("related_intake_log_id"),
  note: text("note"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const knowledge = sm.table("knowledge", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  aliases: text("aliases").array().notNull().default([]),
  entry: jsonb("entry").notNull(),
  source: text("source", { enum: ["ai", "mock"] }).notNull(),
  model: text("model"),
  promptVersion: text("prompt_version").notNull(),
  createdBy: uuid("created_by"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const schema = { ...authSchema, profiles, supplements, intakeLogs, inventoryTransactions, knowledge, checkups };
