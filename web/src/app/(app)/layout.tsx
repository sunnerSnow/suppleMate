import { BottomNav } from "@/components/nav/bottom-nav";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <main className="mx-auto w-full max-w-lg flex-1 px-4 pt-5 pb-28 sm:px-6">{children}</main>
      <BottomNav />
    </>
  );
}
