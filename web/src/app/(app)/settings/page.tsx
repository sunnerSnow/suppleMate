"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
        <Field label="時區" htmlFor="tz" hint="用來判斷「今天」是哪一天，以及顯示服用時間。">
          <SelectWrap>
            <Select
              id="tz"
              value={store.timezone}
              disabled={store.status !== "ready"}
              onChange={async (e) => {
                await store.updateProfile({ timezone: e.target.value });
                toast.success("已更新時區");
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
        <p className="mt-1 text-xs text-text-3">示範模式：資料只存在這個瀏覽器裡，尚未同步到雲端。</p>
        <div className="mt-4 flex flex-col gap-2">
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
        <div className="mt-2 flex flex-col gap-2">
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
