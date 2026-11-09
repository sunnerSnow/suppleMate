import { BottomNav } from "@/components/nav/bottom-nav";
import { ThemeSync } from "@/components/theme-sync";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getProfile } from "@/lib/services/profiles";
import { StoreProvider } from "@/lib/store/store-provider";
import { DEFAULT_THEME } from "@/lib/theme";

/** 登入後的頁面群：確認 session（查資料庫）→ 以個人設定的主題校正 → 掛上資料 store 與底部導覽 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const profile = await getProfile(await getDb(), user.id);
  return (
    <StoreProvider account={{ email: user.email, name: user.name }}>
      <ThemeSync theme={profile?.theme ?? DEFAULT_THEME} />
      <main className="mx-auto w-full max-w-lg flex-1 pb-28">{children}</main>
      <BottomNav />
    </StoreProvider>
  );
}
