/**
 * SuppleMate 領域型別。
 *
 * 時間戳一律用 ISO 8601 字串（UTC），日期（planDate、expirationDate）用使用者時區的 YYYY-MM-DD。
 * 串接 Firestore 時在資料存取層轉成 Timestamp，領域層不碰 SDK 型別。
 */

export const SCHEDULE_SLOTS = [
  "before_breakfast",
  "after_breakfast",
  "before_lunch",
  "after_lunch",
  "before_dinner",
  "after_dinner",
  "bedtime",
  "unconfirmed",
] as const;

export type ScheduleSlot = (typeof SCHEDULE_SLOTS)[number];

export const PRODUCT_FORMS = ["capsule", "tablet", "powder", "liquid", "other"] as const;

export type ProductForm = (typeof PRODUCT_FORMS)[number];

export type SupplementStatus = "active" | "archived";

export type Supplement = {
  id: string;
  name: string;
  brand?: string;
  productForm?: ProductForm;
  /** 每份數量的文字描述，例如「1 顆」「5 mL」，僅供顯示 */
  servingSize?: string;

  /** 每次服用量（數值），單位見 doseUnit */
  dosePerIntake: number;
  /** 顆、粒、錠、mL、包等。單位要保留，避免把「顆」和「mL」相加 */
  doseUnit: string;
  /** 每日次數，等於 scheduleSlots.length */
  dailyFrequency: number;
  /**
   * 每日各次的服用時段，長度等於 dailyFrequency。
   * 使用者未確認的那一次填 "unconfirmed"，系統不得自行推定。
   */
  scheduleSlots: ScheduleSlot[];

  stockQuantity: number;
  lowStockThreshold: number;
  expirationDate?: string;

  notes?: string;
  status: SupplementStatus;

  createdAt: string;
  updatedAt: string;
};

export type IntakeLogStatus = "taken" | "reversed";

export type IntakeLog = {
  id: string;
  supplementId: string;
  /** 使用者時區的計畫日期 YYYY-MM-DD */
  planDate: string;
  planSlot: ScheduleSlot;
  /**
   * 計畫項目的唯一鍵（supplementId + planDate + slot + 同時段序號）。
   * 同一計畫項目同一天只能有一筆 taken 紀錄，避免重複扣庫存。
   */
  planItemKey: string;

  supplementNameSnapshot: string;
  doseSnapshot: number;
  unitSnapshot: string;

  status: IntakeLogStatus;
  takenAt?: string;
  reversedAt?: string;

  createdAt: string;
};

export type InventoryTransactionType = "initial" | "intake" | "reversal" | "restock" | "adjustment";

export type InventoryTransaction = {
  id: string;
  supplementId: string;
  type: InventoryTransactionType;
  /** 入庫為正，扣庫存為負 */
  quantityDelta: number;
  relatedIntakeLogId?: string;
  note?: string;
  createdAt: string;
};

export type UserProfile = {
  displayName?: string;
  email?: string;
  /** 預設 Asia/Taipei */
  timezone: string;
  createdAt: string;
  updatedAt: string;
};

/** 今日頁的一個待勾選項目（由保健品的 scheduleSlots 展開而來） */
export type PlanItem = {
  key: string;
  supplementId: string;
  supplementName: string;
  brand?: string;
  dose: number;
  unit: string;
  slot: ScheduleSlot;
  notes?: string;
  /** 該項目當日的有效（taken）紀錄，沒有則為 undefined */
  log?: IntakeLog;
  /** 目前庫存是否足夠扣這一次 */
  stockSufficient: boolean;
  stockQuantity: number;
};

export type StockStatus = "sufficient" | "low" | "out";
