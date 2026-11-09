import { BottomNav } from "@/components/nav/bottom-nav";
import { requireUser } from "@/lib/auth/session";
import { StoreProvider } from "@/lib/store/store-provider";

/** 登入後的頁面群：先確認 session（查資料庫），再掛上資料 store 與底部導覽 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  return (
    <StoreProvider account={{ email: user.email, name: user.name }}>
      <main className="mx-auto w-full max-w-lg flex-1 px-4 pt-5 pb-28 sm:px-6">{children}</main>
      <BottomNav />
    </StoreProvider>
  );
}
