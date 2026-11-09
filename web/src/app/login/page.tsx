import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loginLocalAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Heart } from "@/components/ui/decor";
import { AppTop, Eyebrow } from "@/components/ui/page-header";
import { LOCAL_USERS } from "@/lib/auth/local-users";
import { getSessionUser } from "@/lib/auth/session";
import { isLocalMode } from "@/lib/config";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "登入" };

export default async function LoginPage() {
  if (await getSessionUser()) redirect("/today");
  const local = isLocalMode();

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-1 flex-col pb-10">
      <AppTop />
      <div className="dark-block on-dark relative mt-2">
        <Eyebrow>Welcome</Eyebrow>
        <h1 className="h1 mt-2">
          吃了沒，
          <br />
          一眼就知道。
        </h1>
        <p className="mt-2 text-xs leading-relaxed">每日服用表、庫存與補貨提醒、保健品小知識與建議方案。</p>
        <Heart className="absolute right-5 top-5 w-8 text-accent" />
      </div>

      <section className="card mx-5 mt-5">
        {local && (
          <>
            <p className="sub-text m-0 text-xs leading-relaxed">
              本機示範模式：資料存在這台電腦的 <code className="font-en">web/.data/pglite</code>
              ，不是正式資料庫。可以一鍵以示範使用者登入；兩位的資料互相看不到。
            </p>
            <div className="mt-3 flex flex-col gap-3">
              {LOCAL_USERS.map((u) => (
                <form key={u.key} action={loginLocalAction}>
                  <input type="hidden" name="user" value={u.key} />
                  <Button type="submit" block variant={u.key === "a" ? "primary" : "ghost"}>
                    以{u.label}登入{u.sample ? "（有範例資料）" : ""}
                  </Button>
                </form>
              ))}
            </div>
            <p className="sub-text mt-5 border-t-2 border-dotted border-line pt-4 text-xs font-black">
              或用 Email 註冊／登入
            </p>
          </>
        )}
        <LoginForm />
        <p className="sub-text mt-4 text-xs leading-relaxed">
          目前不需要驗證 Email。SuppleMate 只協助記錄與管理，不提供醫療建議。
        </p>
      </section>
    </main>
  );
}
