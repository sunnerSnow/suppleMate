import {
  adjustStockAction,
  clearAllDataAction,
  createSupplementAction,
  loadSnapshotAction,
  resetSampleDataAction,
  restockAction,
  reverseIntakeAction,
  setSupplementStatusAction,
  takeIntakeAction,
  updateProfileAction,
  updateSupplementAction,
  type ActionResult,
} from "@/app/actions";
import type { AdjustInput, RestockInput, SupplementInput } from "@/lib/domain/validation";
import type { ProfilePatch, SupplementStatus } from "@/lib/types";
import type { Snapshot, SuppleMateRepository, TakeIntakeParams } from "./repository";

/** Server Action 回傳的錯誤 → 丟給 StoreProvider 顯示；未登入則導回登入頁 */
function unwrap<T>(result: ActionResult<T>): T {
  if (result.ok) return result.value;
  if (result.error.code === "unauthorized" && typeof window !== "undefined") {
    // session 已失效：整頁重新載入，伺服端 layout 會導到 /login
    window.location.reload();
  }
  throw new RepositoryError(result.error.code, result.error.message, result.error.issues ?? []);
}

export class RepositoryError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly issues: { field: string; message: string }[],
  ) {
    super(message);
    this.name = "RepositoryError";
  }
}

/**
 * 透過 Server Action 存取資料庫的 repository。
 * 所有規則（防重複扣庫存、交易）都在伺服器端執行；這裡只負責呼叫與解開結果。
 */
export class RemoteRepository implements SuppleMateRepository {
  async load(): Promise<Snapshot> {
    return unwrap(await loadSnapshotAction());
  }
  async createSupplement(input: SupplementInput) {
    return unwrap(await createSupplementAction(input));
  }
  async updateSupplement(id: string, input: SupplementInput) {
    return unwrap(await updateSupplementAction(id, input));
  }
  async setSupplementStatus(id: string, status: SupplementStatus) {
    return unwrap(await setSupplementStatusAction(id, status));
  }
  async takeIntake(params: TakeIntakeParams) {
    return unwrap(await takeIntakeAction(params));
  }
  async reverseIntake(logId: string) {
    return unwrap(await reverseIntakeAction(logId));
  }
  async restock(supplementId: string, input: RestockInput) {
    return unwrap(await restockAction(supplementId, input));
  }
  async adjustStock(supplementId: string, input: AdjustInput) {
    return unwrap(await adjustStockAction(supplementId, input));
  }
  async updateProfile(patch: ProfilePatch) {
    return unwrap(await updateProfileAction(patch));
  }
  async resetWithSampleData() {
    return unwrap(await resetSampleDataAction());
  }
  async clearAll() {
    return unwrap(await clearAllDataAction());
  }
}
