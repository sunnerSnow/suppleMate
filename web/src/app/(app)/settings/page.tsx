"use client";

import { useState } from "react";
import { logoutAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Select, SelectWrap } from "@/components/ui/field";
import { AppTop, PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store/store-provider";
import { THEME_LABELS, applyThemeToDocument } from "@/lib/theme";
import { THEMES, type Theme } from "@/lib/types";

const TIMEZONES = ["Asia/Taipei", "Asia/Tokyo", "Asia/Hong_Kong", "Asia/Singapore", "Asia/Shanghai", "UTC"];

const SWATCHES: Record<Theme, string[]> = {
  c: ["#FAF2EB", "#222222", "#D57563", "#3280CF", "#F5E9DE"],
  e: ["#018C3E", "#1D2088", "#00B9EF", "#EA5504", "#FFF040"],
};

export default function SettingsPage() {
  const store = useStore();
  const toast = useToast();
  const [confirm, setConfirm] = useState<"sample" | "clear" | null>(null);
  const current: Theme = store.profile?.theme ?? "c";

  const pickTheme = async (theme: Theme) => {
    if (theme === current) return;
    const previous = current;
    applyThemeToDocument(theme);
    const ok = await store.updateProfile({ theme });
    if (ok) toast.success(`已切換成「${THEME_LABELS[theme].name}」`);
    else applyThemeToDocument(previous);
  };

  return (
    <div className="animate-fade-up">
      <AppTop />
      <PageHeader eyebrow="Settings" title="設定" />

      <div className="mx-5 flex flex-col gap-4">
        <Card>
          <div className="card-head">
            <h2 className="h2">
              <span className="en">Theme</span>介面主題
            </h2>
          </div>
          <div className="theme-pick" role="group" aria-label="選擇主題">
            {THEMES.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={current === t}
                disabled={store.status !== "ready" || store.isPending("profile")}
                onClick={() => pickTheme(t)}
              >
                <span className="theme-swatch" aria-hidden>
                  {SWATCHES[t].map((hex) => (
                    <i key={hex} style={{ background: hex }} />
                  ))}
                </span>
                <span className="block text-sm font-black">{THEME_LABELS[t].name}</span>
                <span className="mt-1 block text-[11px] leading-snug text-text-3">{THEME_LABELS[t].description}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card alt>
          <div className="card-head">
            <h2 className="h2">
              <span className="en">Account</span>帳號
            </h2>
            <Badge tone="info">已登入</Badge>
          </div>
          <p className="m-0 truncate text-base font-black text-ink">{store.account.name || "未設定名稱"}</p>
          <p className="sub-text m-0 truncate">{store.account.email ?? "—"}</p>
          <form action={logoutAction} className="mt-4">
            <Button type="submit" variant="ghost" block>
              登出
            </Button>
          </form>
        </Card>

        <Card>
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

        <Card alt>
          <div className="card-head">
            <h2 className="h2">
              <span className="en">Data</span>資料
            </h2>
          </div>
          <p className="sub-text m-0">範例資料方便試用；清除後保健品、服用紀錄與庫存異動都會刪掉。</p>
          <div className="mt-4 flex flex-col gap-3">
            <Button variant="ghost" block onClick={() => setConfirm("sample")} disabled={store.status !== "ready"}>
              重設為範例資料
            </Button>
            <Button variant="danger" block onClick={() => setConfirm("clear")} disabled={store.status !== "ready"}>
              清除全部資料
            </Button>
          </div>
        </Card>

        <p className="sub-text px-1 text-xs leading-relaxed">
          SuppleMate 只協助記錄與管理，不提供醫療診斷、治療或停藥建議。服用方式請依產品標示或專業人員指示。
        </p>
      </div>

      <Dialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm === "clear" ? "清除全部資料" : "重設為範例資料"}
        description="目前的保健品、服用紀錄與庫存異動都會被移除，無法復原。"
      >
        <div className="mt-2 flex flex-col gap-3">
          <Button
            variant="danger"
            block
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
          <Button variant="ghost" block onClick={() => setConfirm(null)}>
            取消
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
