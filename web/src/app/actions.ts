"use server";

import { APIError } from "better-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth/better-auth";
import { LOCAL_USERS } from "@/lib/auth/local-users";
import { getSessionUser } from "@/lib/auth/session";
import { isLocalMode } from "@/lib/config";
import { getDb } from "@/lib/db/client";
import type { IntakeResult, Result, StockResult } from "@/lib/domain/ledger";
import { AppError, unauthorized, type FieldIssue } from "@/lib/errors";
import { adjustStockDb, restockDb, reverseIntakeDb, takeIntakeDb } from "@/lib/services/ledger";
import { updateProfile } from "@/lib/services/profiles";
import { clientIp, consumeRateLimit } from "@/lib/services/rate-limit";
import { clearUserData, resetWithSampleData } from "@/lib/services/sample";
import { loadSnapshot } from "@/lib/services/snapshot";
import { createSupplement, setSupplementStatus, updateSupplement } from "@/lib/services/supplements";
import type { Snapshot, TakeIntakeParams } from "@/lib/store/repository";
import type { InventoryTransaction, Supplement, SupplementStatus, UserProfile } from "@/lib/types";
import { type Credentials, credentialsSchema } from "@/lib/validation/auth";

/**
 * Server Actions 都是公開的 POST 端點：每一個都自己檢查登入，輸入一律交給服務層驗證。
 * 回傳值一律是可序列化的 ActionResult，前端的 RemoteRepository 負責解開。
 */
export type ActionError = { code: string; message: string; issues?: FieldIssue[] };
export type ActionResult<T> = { ok: true; value: T } | { ok: false; error: ActionError };

function logError(error: unknown): void {
  const e = error as { name?: string; cause?: { code?: string; message?: string }; message?: string };
  const detail = e?.cause?.code
    ? `${e.cause.code} ${e.cause.message ?? ""}`
    : (e?.message ?? String(error)).split("\n")[0];
  console.error(`[sm] ${e?.name ?? "Error"}: ${detail.slice(0, 300)}`);
}

async function run<T>(fn: (userId: string) => Promise<T>): Promise<ActionResult<T>> {
  try {
    const user = await getSessionUser();
    if (!user) throw unauthorized();
    return { ok: true, value: await fn(user.id) };
  } catch (error) {
    if (error instanceof AppError) {
      return {
        ok: false,
        error: { code: error.code, message: error.message, ...(error.issues.length ? { issues: error.issues } : {}) },
      };
    }
    logError(error);
    return { ok: false, error: { code: "internal_error", message: "系統發生錯誤，請稍後再試" } };
  }
}

// ---------------------------------------------------------------------------
// 資料
// ---------------------------------------------------------------------------

export async function loadSnapshotAction(): Promise<ActionResult<Snapshot>> {
  return run(async (userId) => loadSnapshot(await getDb(), userId));
}

export async function createSupplementAction(
  input: unknown,
): Promise<ActionResult<{ supplement: Supplement; transaction: InventoryTransaction }>> {
  return run(async (userId) => createSupplement(await getDb(), userId, input));
}

export async function updateSupplementAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ supplement: Supplement; transaction?: InventoryTransaction }>> {
  return run(async (userId) => updateSupplement(await getDb(), userId, id, input));
}

export async function setSupplementStatusAction(
  id: string,
  status: SupplementStatus,
): Promise<ActionResult<Supplement>> {
  return run(async (userId) => setSupplementStatus(await getDb(), userId, id, status));
}

export async function takeIntakeAction(params: TakeIntakeParams): Promise<ActionResult<Result<IntakeResult>>> {
  return run(async (userId) => takeIntakeDb(await getDb(), userId, params));
}

export async function reverseIntakeAction(logId: string): Promise<ActionResult<Result<IntakeResult>>> {
  return run(async (userId) => reverseIntakeDb(await getDb(), userId, logId));
}

export async function restockAction(supplementId: string, input: unknown): Promise<ActionResult<Result<StockResult>>> {
  return run(async (userId) => restockDb(await getDb(), userId, supplementId, input));
}

export async function adjustStockAction(
  supplementId: string,
  input: unknown,
): Promise<ActionResult<Result<StockResult>>> {
  return run(async (userId) => adjustStockDb(await getDb(), userId, supplementId, input));
}

export async function updateProfileAction(input: unknown): Promise<ActionResult<UserProfile>> {
  return run(async (userId) => updateProfile(await getDb(), userId, input));
}

export async function resetSampleDataAction(): Promise<ActionResult<Snapshot>> {
  return run(async (userId) => resetWithSampleData(await getDb(), userId));
}

export async function clearAllDataAction(): Promise<ActionResult<Snapshot>> {
  return run(async (userId) => clearUserData(await getDb(), userId));
}

// ---------------------------------------------------------------------------
// 登入（Better Auth；nextCookies plugin 會把 session cookie 寫進回應）
// ---------------------------------------------------------------------------

export interface AuthState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

/** Better Auth 的錯誤碼 → 使用者看得懂的訊息；不洩漏帳號是否存在 */
function authErrorMessage(error: unknown, intent: "signin" | "signup"): string {
  if (error instanceof APIError) {
    const code = error.body?.code ?? "";
    if (intent === "signup" && /ALREADY_EXISTS/.test(code)) return "這個 Email 已經註冊過，請直接登入";
    if (
      intent === "signin" &&
      (/INVALID_EMAIL_OR_PASSWORD|USER_NOT_FOUND|INVALID_PASSWORD/.test(code) || error.status === "UNAUTHORIZED")
    ) {
      return "Email 或密碼不正確";
    }
    if (/PASSWORD_TOO_SHORT|PASSWORD_TOO_LONG/.test(code)) return "密碼長度需為 8–72 個字元";
    if (error.status === "TOO_MANY_REQUESTS") return "嘗試次數太多，請稍後再試";
    logError(error);
    return intent === "signup" ? "註冊失敗，請稍後再試" : "登入失敗，請稍後再試";
  }
  logError(error);
  return "系統發生錯誤，請稍後再試";
}

/** 限流：每個 IP 每 10 分鐘 30 次、每個 Email 每 15 分鐘 10 次（登入與註冊合計；失敗也算） */
async function allowLoginAttempt(requestHeaders: Headers, email: string): Promise<boolean> {
  const db = await getDb();
  const ipOk = await consumeRateLimit(db, `login:ip:${clientIp(requestHeaders)}`, 30, 600);
  const emailOk = await consumeRateLimit(db, `login:email:${email.toLowerCase()}`, 10, 900);
  return ipOk && emailOk;
}

export async function loginAction(intent: "signin" | "signup", input: Credentials): Promise<AuthState> {
  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0].message,
      fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])),
    };
  }
  const requestHeaders = await headers();
  if (!(await allowLoginAttempt(requestHeaders, parsed.data.email))) return { error: "嘗試次數太多，請 10 分鐘後再試" };
  const auth = await getAuth();
  try {
    if (intent === "signup") {
      const name = parsed.data.name?.trim() || parsed.data.email.split("@")[0];
      await auth.api.signUpEmail({
        body: { email: parsed.data.email, password: parsed.data.password, name },
        headers: requestHeaders,
      });
    } else {
      await auth.api.signInEmail({
        body: { email: parsed.data.email, password: parsed.data.password },
        headers: requestHeaders,
      });
    }
  } catch (error) {
    return { error: authErrorMessage(error, intent) };
  }
  redirect("/today");
}

/** 本機示範模式：一鍵以示範使用者登入 */
export async function loginLocalAction(formData: FormData): Promise<void> {
  if (!isLocalMode()) redirect("/login");
  const user = LOCAL_USERS.find((u) => u.key === formData.get("user"));
  if (!user) redirect("/login");
  const requestHeaders = await headers();
  if (!(await allowLoginAttempt(requestHeaders, user.email))) redirect("/login");
  const auth = await getAuth();
  await auth.api.signInEmail({ body: { email: user.email, password: user.password }, headers: requestHeaders });
  redirect("/today");
}

export async function logoutAction(): Promise<void> {
  const auth = await getAuth();
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch (error) {
    // 沒有 session 也算登出成功
    if (!(error instanceof APIError)) logError(error);
  }
  redirect("/login");
}
