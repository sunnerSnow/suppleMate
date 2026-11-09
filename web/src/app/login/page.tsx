import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loginLocalAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Cloud, Sparkle } from "@/components/ui/decor";
import { Eyebrow } from "@/components/ui/page-header";
import { LOCAL_USERS } from "@/lib/auth/local-users";
import { getSessionUser } from "@/lib/auth/session";
import { isLocalMode } from "@/lib/config";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "登入" };

export default async function LoginPage() {
  if (await getSessionUser()) redirect("/today");
  const local = isLocalMode();

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-1 flex-col px-4 pt-8 pb-10 sm:px-6">
      <header className="relative overflow-hidden rounded-[var(--radius-card)] border-2 border-sky-deep bg-sky px-5 py-7 text-ink shadow-[0_4px_0_0_var(--sky-deep)]">
        <Cloud className="animate-drift absolute -right-4 top-2 w-24 text-white/90" />
        <Cloud className="animate-drift absolute -left-6 bottom-0 w-20 text-white/60 [animation-delay:-3s]" />
        <div className="relative">
          <Eyebrow tone="yellow">SuppleMate</Eyebrow>
          <h1 className="mt-3 text-[28px] font-bold leading-tight">
            保健品管理助手
            <Sparkle className="ml-1 inline size-5 align-[-2px] text-white" />
          </h1>
          <p className="mt-2 text-sm font-bold text-ink/80">每日服用表、庫存與補貨提醒，吃了沒一眼就知道。</p>
        </div>
      </header>

      <section className="mt-5 rounded-[var(--radius-card)] border-2 border-line bg-white p-5 shadow-[0_3px_0_0_var(--line)]">
        {local && (
          <>
            <p className="text-xs leading-relaxed text-text-2">
              本機示範模式：資料存在這台電腦的 <code className="font-en">web/.data/pglite</code>
              ，不是正式資料庫。可以一鍵以示範使用者登入；兩位的資料互相看不到。
            </p>
            <div className="mt-3 flex flex-col gap-3">
              {LOCAL_USERS.map((u) => (
                <form key={u.key} action={loginLocalAction}>
                  <input type="hidden" name="user" value={u.key} />
                  <Button type="submit" className="w-full" variant={u.key === "a" ? "primary" : "outline"}>
                    以{u.label}登入{u.sample ? "（有範例資料）" : ""}
                  </Button>
                </form>
              ))}
            </div>
            <p className="mt-5 border-t-2 border-cream pt-4 text-xs font-bold text-text-3">或用 Email 註冊／登入</p>
          </>
        )}
        <LoginForm />
        <p className="mt-4 text-xs leading-relaxed text-text-3">
          目前不需要驗證 Email。SuppleMate 只協助記錄與管理，不提供醫療建議。
        </p>
      </section>
    </main>
  );
}
