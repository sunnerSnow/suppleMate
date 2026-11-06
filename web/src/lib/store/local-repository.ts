import { DEFAULT_TIMEZONE } from "../constants";
import {
  adjustStock,
  initialTransaction,
  reverseIntake,
  restock,
  takeIntake,
  type IntakeResult,
  type Result,
  type StockResult,
} from "../domain/ledger";
import type { AdjustInput, RestockInput, SupplementInput } from "../domain/validation";
import { newId } from "../id";
import type { InventoryTransaction, Supplement, SupplementStatus, UserProfile } from "../types";
import { buildSampleSnapshot, emptySnapshot } from "./mock-data";
import { NotFoundError, type Snapshot, type SuppleMateRepository, type TakeIntakeParams } from "./repository";

const STORAGE_KEY = "supplemate:v1";

type Persisted = Snapshot & { version: 1 };

/** 抽象化儲存介面，方便測試時用記憶體取代 localStorage */
export type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export class MemoryStorage implements KeyValueStorage {
  private map = new Map<string, string>();
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
}

/**
 * localStorage 版資料存取層（Step 2 示範模式）。
 * 每個操作都是「讀快照 → 套用純函式 → 整份寫回」，單一分頁內等同於原子操作。
 * 第一次開啟（沒有任何資料）時自動載入範例資料，讓使用者能直接操作 UI。
 */
export class LocalRepository implements SuppleMateRepository {
  constructor(
    private readonly storage: KeyValueStorage,
    private readonly timezone: string = DEFAULT_TIMEZONE,
  ) {}

  private read(): Snapshot {
    const raw = this.storage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = buildSampleSnapshot(this.timezone);
      this.write(seeded);
      return seeded;
    }
    try {
      const parsed = JSON.parse(raw) as Persisted;
      if (parsed.version !== 1 || !Array.isArray(parsed.supplements)) throw new Error("格式不符");
      return {
        profile: parsed.profile ?? emptySnapshot(this.timezone).profile,
        supplements: parsed.supplements,
        intakeLogs: parsed.intakeLogs ?? [],
        transactions: parsed.transactions ?? [],
      };
    } catch {
      throw new Error("本機資料損毀，請到設定頁清除資料後重新開始。");
    }
  }

  private write(snapshot: Snapshot) {
    const persisted: Persisted = { version: 1, ...snapshot };
    this.storage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  }

  private requireSupplement(snapshot: Snapshot, id: string): Supplement {
    const found = snapshot.supplements.find((s) => s.id === id);
    if (!found) throw new NotFoundError("保健品");
    return found;
  }

  private replaceSupplement(snapshot: Snapshot, next: Supplement): Snapshot {
    return { ...snapshot, supplements: snapshot.supplements.map((s) => (s.id === next.id ? next : s)) };
  }

  async load(): Promise<Snapshot> {
    return this.read();
  }

  async createSupplement(input: SupplementInput) {
    const snapshot = this.read();
    const nowIso = new Date().toISOString();
    const supplement: Supplement = { ...input, id: newId(), status: "active", createdAt: nowIso, updatedAt: nowIso };
    const transaction = initialTransaction(supplement);
    this.write({
      ...snapshot,
      supplements: [...snapshot.supplements, supplement],
      transactions: [...snapshot.transactions, transaction],
    });
    return { supplement, transaction };
  }

  /**
   * 編輯保健品。若庫存數字被改動，不直接覆蓋，而是記一筆 adjustment 異動，
   * 讓庫存數量與異動紀錄保持一致。既有服用紀錄（快照）不會被改寫。
   */
  async updateSupplement(id: string, input: SupplementInput) {
    const snapshot = this.read();
    const existing = this.requireSupplement(snapshot, id);
    const nowIso = new Date().toISOString();
    let next: Supplement = { ...existing, ...input, updatedAt: nowIso };
    let transaction: InventoryTransaction | undefined;

    if (input.stockQuantity !== existing.stockQuantity) {
      const r = adjustStock({
        supplement: { ...next, stockQuantity: existing.stockQuantity },
        newQuantity: input.stockQuantity,
        reason: "編輯保健品時修正庫存",
      });
      if (!r.ok) throw new Error(r.error.message);
      next = r.value.supplement;
      transaction = r.value.transaction;
    }

    this.write({
      ...this.replaceSupplement(snapshot, next),
      transactions: transaction ? [...snapshot.transactions, transaction] : snapshot.transactions,
    });
    return { supplement: next, transaction };
  }

  async setSupplementStatus(id: string, status: SupplementStatus) {
    const snapshot = this.read();
    const existing = this.requireSupplement(snapshot, id);
    const next: Supplement = { ...existing, status, updatedAt: new Date().toISOString() };
    this.write(this.replaceSupplement(snapshot, next));
    return next;
  }

  async takeIntake(params: TakeIntakeParams): Promise<Result<IntakeResult>> {
    const snapshot = this.read();
    const supplement = this.requireSupplement(snapshot, params.supplementId);
    const r = takeIntake({
      supplement,
      planDate: params.planDate,
      slot: params.slot,
      ordinal: params.ordinal,
      existingLogs: snapshot.intakeLogs,
      allowInsufficientStock: params.allowInsufficientStock,
    });
    if (!r.ok) return r;
    this.write({
      ...this.replaceSupplement(snapshot, r.value.supplement),
      intakeLogs: [...snapshot.intakeLogs, r.value.log],
      transactions: [...snapshot.transactions, r.value.transaction],
    });
    return r;
  }

  async reverseIntake(logId: string): Promise<Result<IntakeResult>> {
    const snapshot = this.read();
    const log = snapshot.intakeLogs.find((l) => l.id === logId);
    if (!log) throw new NotFoundError("服用紀錄");
    const supplement = this.requireSupplement(snapshot, log.supplementId);
    const r = reverseIntake({ supplement, log });
    if (!r.ok) return r;
    this.write({
      ...this.replaceSupplement(snapshot, r.value.supplement),
      intakeLogs: snapshot.intakeLogs.map((l) => (l.id === logId ? r.value.log : l)),
      transactions: [...snapshot.transactions, r.value.transaction],
    });
    return r;
  }

  async restock(supplementId: string, input: RestockInput): Promise<Result<StockResult>> {
    const snapshot = this.read();
    const supplement = this.requireSupplement(snapshot, supplementId);
    const r = restock({ supplement, ...input });
    if (!r.ok) return r;
    this.write({
      ...this.replaceSupplement(snapshot, r.value.supplement),
      transactions: [...snapshot.transactions, r.value.transaction],
    });
    return r;
  }

  async adjustStock(supplementId: string, input: AdjustInput): Promise<Result<StockResult>> {
    const snapshot = this.read();
    const supplement = this.requireSupplement(snapshot, supplementId);
    const r = adjustStock({ supplement, ...input });
    if (!r.ok) return r;
    this.write({
      ...this.replaceSupplement(snapshot, r.value.supplement),
      transactions: [...snapshot.transactions, r.value.transaction],
    });
    return r;
  }

  async updateProfile(patch: Partial<Pick<UserProfile, "displayName" | "timezone">>) {
    const snapshot = this.read();
    const profile: UserProfile = { ...snapshot.profile, ...patch, updatedAt: new Date().toISOString() };
    this.write({ ...snapshot, profile });
    return profile;
  }

  async resetWithSampleData() {
    const seeded = buildSampleSnapshot(this.timezone);
    this.write(seeded);
    return seeded;
  }

  async clearAll() {
    const empty = emptySnapshot(this.timezone);
    this.write(empty);
    return empty;
  }
}
