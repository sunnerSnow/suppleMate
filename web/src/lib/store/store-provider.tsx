"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useToast } from "@/components/ui/toast";
import { DEFAULT_TIMEZONE } from "../constants";
import { todayPlanDate } from "../date";
import type { IntakeResult, Result, StockResult } from "../domain/ledger";
import type { AdjustInput, RestockInput, SupplementInput } from "../domain/validation";
import type { IntakeLog, InventoryTransaction, Supplement, SupplementStatus, UserProfile } from "../types";
import { LocalRepository } from "./local-repository";
import type { Snapshot, SuppleMateRepository, TakeIntakeParams } from "./repository";

export type StoreStatus = "loading" | "ready" | "error";

export type StoreValue = {
  status: StoreStatus;
  error?: string;
  retry: () => void;

  profile: UserProfile | null;
  timezone: string;
  /** 使用者時區的今天 YYYY-MM-DD，跨日時自動更新 */
  today: string;
  supplements: Supplement[];
  intakeLogs: IntakeLog[];
  transactions: InventoryTransaction[];

  /** 正在處理中的操作鍵（例如計畫項目 key），用來鎖按鈕避免重複點擊 */
  isPending: (key: string) => boolean;

  createSupplement: (input: SupplementInput) => Promise<Supplement | null>;
  updateSupplement: (id: string, input: SupplementInput) => Promise<Supplement | null>;
  setSupplementStatus: (id: string, status: SupplementStatus) => Promise<boolean>;
  takeIntake: (params: TakeIntakeParams, pendingKey: string) => Promise<Result<IntakeResult> | null>;
  reverseIntake: (logId: string, pendingKey: string) => Promise<Result<IntakeResult> | null>;
  restock: (supplementId: string, input: RestockInput) => Promise<Result<StockResult> | null>;
  adjustStock: (supplementId: string, input: AdjustInput) => Promise<Result<StockResult> | null>;
  updateProfile: (patch: Partial<Pick<UserProfile, "displayName" | "timezone">>) => Promise<void>;
  resetWithSampleData: () => Promise<void>;
  clearAll: () => Promise<void>;
};

const StoreContext = createContext<StoreValue | null>(null);

function createDefaultRepository(): SuppleMateRepository {
  return new LocalRepository(window.localStorage);
}

export function StoreProvider({
  children,
  repository,
}: {
  children: ReactNode;
  /** 測試或日後換 Firestore 時注入；預設用 localStorage */
  repository?: SuppleMateRepository;
}) {
  const toast = useToast();
  const repoRef = useRef<SuppleMateRepository | null>(repository ?? null);
  const [status, setStatus] = useState<StoreStatus>("loading");
  const [error, setError] = useState<string>();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [pending, setPending] = useState<Set<string>>(() => new Set());
  const [loadVersion, setLoadVersion] = useState(0);

  const timezone = snapshot?.profile.timezone ?? DEFAULT_TIMEZONE;
  // 每分鐘更新一次時鐘，「今天」由時鐘與時區推導（跨日或改時區都會更新）
  // 初始為 null：預先渲染時不能讀目前時間，資料載入完成後才設定
  const [clock, setClock] = useState<number | null>(null);
  const today = clock === null ? "" : todayPlanDate(timezone, new Date(clock));

  // 載入資料（只在瀏覽器執行，localStorage 在伺服器不存在）；狀態重設在 retry() 內做
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        repoRef.current ??= createDefaultRepository();
        const data = await repoRef.current.load();
        if (!cancelled) {
          setClock(Date.now());
          setSnapshot(data);
          setStatus("ready");
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "載入資料失敗");
          setStatus("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadVersion]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const retry = useCallback(() => {
    setStatus("loading");
    setError(undefined);
    setLoadVersion((v) => v + 1);
  }, []);

  const withPending = useCallback(
    async <T,>(key: string, fn: () => Promise<T>): Promise<T | null> => {
      if (pending.has(key)) return null;
      setPending((prev) => new Set(prev).add(key));
      try {
        return await fn();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "操作失敗，請再試一次");
        return null;
      } finally {
        setPending((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [pending, toast],
  );

  const repo = () => {
    if (!repoRef.current) throw new Error("資料尚未載入");
    return repoRef.current;
  };

  const patch = (fn: (prev: Snapshot) => Snapshot) => setSnapshot((prev) => (prev ? fn(prev) : prev));

  const replaceSupplement = (prev: Snapshot, s: Supplement): Snapshot => ({
    ...prev,
    supplements: prev.supplements.map((x) => (x.id === s.id ? s : x)),
  });

  const value: StoreValue = {
    status,
    error,
    retry,
    profile: snapshot?.profile ?? null,
    timezone,
    today,
    supplements: snapshot?.supplements ?? [],
    intakeLogs: snapshot?.intakeLogs ?? [],
    transactions: snapshot?.transactions ?? [],
    isPending: (key) => pending.has(key),

    createSupplement: (input) =>
      withPending("supplement:create", async () => {
        const { supplement, transaction } = await repo().createSupplement(input);
        patch((prev) => ({
          ...prev,
          supplements: [...prev.supplements, supplement],
          transactions: [...prev.transactions, transaction],
        }));
        return supplement;
      }),

    updateSupplement: (id, input) =>
      withPending(`supplement:update:${id}`, async () => {
        const { supplement, transaction } = await repo().updateSupplement(id, input);
        patch((prev) => ({
          ...replaceSupplement(prev, supplement),
          transactions: transaction ? [...prev.transactions, transaction] : prev.transactions,
        }));
        return supplement;
      }),

    setSupplementStatus: async (id, newStatus) =>
      (await withPending(`supplement:status:${id}`, async () => {
        const supplement = await repo().setSupplementStatus(id, newStatus);
        patch((prev) => replaceSupplement(prev, supplement));
        return true;
      })) ?? false,

    takeIntake: (params, pendingKey) =>
      withPending(pendingKey, async () => {
        const r = await repo().takeIntake(params);
        if (r.ok) {
          const { supplement, log, transaction } = r.value;
          patch((prev) => ({
            ...replaceSupplement(prev, supplement),
            intakeLogs: [...prev.intakeLogs, log],
            transactions: [...prev.transactions, transaction],
          }));
        }
        return r;
      }),

    reverseIntake: (logId, pendingKey) =>
      withPending(pendingKey, async () => {
        const r = await repo().reverseIntake(logId);
        if (r.ok) {
          const { supplement, log, transaction } = r.value;
          patch((prev) => ({
            ...replaceSupplement(prev, supplement),
            intakeLogs: prev.intakeLogs.map((l) => (l.id === log.id ? log : l)),
            transactions: [...prev.transactions, transaction],
          }));
        }
        return r;
      }),

    restock: (supplementId, input) =>
      withPending(`restock:${supplementId}`, async () => {
        const r = await repo().restock(supplementId, input);
        if (r.ok) {
          patch((prev) => ({
            ...replaceSupplement(prev, r.value.supplement),
            transactions: [...prev.transactions, r.value.transaction],
          }));
        }
        return r;
      }),

    adjustStock: (supplementId, input) =>
      withPending(`adjust:${supplementId}`, async () => {
        const r = await repo().adjustStock(supplementId, input);
        if (r.ok) {
          patch((prev) => ({
            ...replaceSupplement(prev, r.value.supplement),
            transactions: [...prev.transactions, r.value.transaction],
          }));
        }
        return r;
      }),

    updateProfile: async (p) => {
      await withPending("profile", async () => {
        const profile = await repo().updateProfile(p);
        patch((prev) => ({ ...prev, profile }));
      });
    },

    resetWithSampleData: async () => {
      await withPending("reset", async () => {
        setSnapshot(await repo().resetWithSampleData());
      });
    },

    clearAll: async () => {
      await withPending("reset", async () => {
        setSnapshot(await repo().clearAll());
      });
    },
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore 必須在 StoreProvider 內使用");
  return ctx;
}
