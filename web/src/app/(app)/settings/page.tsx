"use client";

import { useState } from "react";
import { logoutAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Select, SelectWrap } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store/store-provider";

const TIMEZONES = ["Asia/Taipei", "Asia/Tokyo", "Asia/Hong_Kong", "Asia/Singapore", "Asia/Shanghai", "UTC"];

export default function SettingsPage() {
  const store = useStore();
  const toast = useToast();
  const [confirm, setConfirm] = useState<"sample" | "clear" | null>(null);

  return (
    <div className="animate-fade-up">
      <PageHeader tone="purple" eyebrow="Settings" title="設定" />

      <Card className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-en text-[12px] font-semibold uppercase tracking-[0.14em] text-text-3">Account</p>
            <p className="mt-1 truncate text-base font-bold text-ink">{store.account.name || "未設定名稱"}</p>
            <p className="truncate text-sm text-text-2">{store.account.email ?? "—"}</p>
          </div>
          <Badge tone="purple">已登入</Badge>
        </div>
        <form action={logoutAction} className="mt-4">
          <Button type="submit" variant="outline" className="w-full">
            登出
          </Button>
        </form>
      </Card>

      <Card className="mb-4">
        <Field label="時區" htmlFor="tz" hint="用來判斷「今天」是哪一天，以及顯示服用時間。">
          <SelectWrap>
            <Select
              id="tz"
              value={store.timezone}
              disabled={store.status !== "ready" || store.isPending("profile")}
              onChange={async (e) => {
                if (await store.updateProfile({ timezone: e.target.value })) toast.success("已更新時區");
              }}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </Select>
          </SelectWrap>
        </Field>
      </Card>

      <Card className="mb-4">
        <h2 className="text-sm font-bold text-ink">資料</h2>
        <p className="mt-1 text-xs text-text-3">範例資料方便試用；清除後保健品、服用紀錄與庫存異動都會刪掉。</p>
        <div className="mt-4 flex flex-col gap-3">
          <Button variant="outline" onClick={() => setConfirm("sample")} disabled={store.status !== "ready"}>
            重設為範例資料
          </Button>
          <Button variant="danger" onClick={() => setConfirm("clear")} disabled={store.status !== "ready"}>
            清除全部資料
          </Button>
        </div>
      </Card>

      <p className="px-1 text-xs leading-relaxed text-text-3">
        SuppleMate 只協助記錄與管理，不提供醫療診斷、治療或停藥建議。服用方式請依產品標示或專業人員指示。
      </p>

      <Dialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm === "clear" ? "清除全部資料" : "重設為範例資料"}
        description="目前的保健品、服用紀錄與庫存異動都會被移除，無法復原。"
      >
        <div className="mt-2 flex flex-col gap-3">
          <Button
            variant="danger"
            loading={store.isPending("reset")}
            onClick={async () => {
              const action = confirm;
              setConfirm(null);
              if (action === "clear") {
                await store.clearAll();
                toast.info("已清除全部資料");
              } else if (action === "sample") {
                await store.resetWithSampleData();
                toast.success("已載入範例資料");
              }
            }}
          >
            確認
          </Button>
          <Button variant="ghost" onClick={() => setConfirm(null)}>
            取消
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
