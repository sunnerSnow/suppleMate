import type { IntakeResult, Result, StockResult } from "../domain/ledger";
import type { AdjustInput, RestockInput, SupplementInput } from "../domain/validation";
import type {
  IntakeLog,
  InventoryTransaction,
  ProfilePatch,
  ScheduleSlot,
  Supplement,
  SupplementStatus,
  UserProfile,
} from "../types";

/** 使用者的全部資料快照（MVP 資料量小，整份載入即可） */
export type Snapshot = {
  profile: UserProfile;
  supplements: Supplement[];
  intakeLogs: IntakeLog[];
  transactions: InventoryTransaction[];
};

export type TakeIntakeParams = {
  supplementId: string;
  planDate: string;
  slot: ScheduleSlot;
  ordinal: number;
  allowInsufficientStock?: boolean;
};

/**
 * 資料存取層介面。
 * Step 2 以 localStorage 實作（LocalRepository）；Step 5 換成 Firestore 實作時，
 * 勾選／取消／補貨要放在 Firestore transaction 內執行，介面不變。
 */
export interface SuppleMateRepository {
  load(): Promise<Snapshot>;

  createSupplement(input: SupplementInput): Promise<{ supplement: Supplement; transaction: InventoryTransaction }>;
  updateSupplement(
    id: string,
    input: SupplementInput,
  ): Promise<{ supplement: Supplement; transaction?: InventoryTransaction }>;
  setSupplementStatus(id: string, status: SupplementStatus): Promise<Supplement>;

  takeIntake(params: TakeIntakeParams): Promise<Result<IntakeResult>>;
  reverseIntake(logId: string): Promise<Result<IntakeResult>>;

  restock(supplementId: string, input: RestockInput): Promise<Result<StockResult>>;
  adjustStock(supplementId: string, input: AdjustInput): Promise<Result<StockResult>>;

  updateProfile(patch: ProfilePatch): Promise<UserProfile>;

  /** 清除資料並載入範例資料（示範模式用） */
  resetWithSampleData(): Promise<Snapshot>;
  /** 清除全部資料 */
  clearAll(): Promise<Snapshot>;
}

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what}不存在`);
    this.name = "NotFoundError";
  }
}
