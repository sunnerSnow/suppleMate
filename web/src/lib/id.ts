/** 產生唯一 ID；瀏覽器與 Node 22 都有 crypto.randomUUID，保留 fallback 以防舊環境 */
export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
