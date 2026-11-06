import type { ProductForm, ScheduleSlot, StockStatus } from "./types";

export const DEFAULT_TIMEZONE = "Asia/Taipei";

export const SLOT_LABELS: Record<ScheduleSlot, string> = {
  before_breakfast: "早餐前",
  after_breakfast: "早餐後",
  before_lunch: "午餐前",
  after_lunch: "午餐後",
  before_dinner: "晚餐前",
  after_dinner: "晚餐後",
  bedtime: "睡前",
  unconfirmed: "尚未確認",
};

export const PRODUCT_FORM_LABELS: Record<ProductForm, string> = {
  capsule: "膠囊",
  tablet: "錠劑",
  powder: "粉末",
  liquid: "液體",
  other: "其他",
};

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  sufficient: "庫存充足",
  low: "即將補貨",
  out: "庫存不足",
};

/** 常用單位，表單提供快速選擇，也允許自訂 */
export const COMMON_UNITS = ["顆", "粒", "錠", "包", "mL", "g", "滴", "匙"] as const;

export const MAX_DAILY_FREQUENCY = 6;
