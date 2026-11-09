import type { Metadata, Viewport } from "next";
import { Fredoka, Huninn } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import { StoreProvider } from "@/lib/store/store-provider";
import "./globals.css";

// 英文與數字：圓體 Fredoka（可變字重）
const fredoka = Fredoka({ variable: "--font-fredoka", subsets: ["latin"] });
// 繁體中文：粉圓體 Huninn（單一字重，粗體由瀏覽器合成）
// adjustFontFallback: next/font 沒有 Huninn 的度量資料，無法產生尺寸校正的備援字型，交給 CSS 字型堆疊即可
const huninn = Huninn({ variable: "--font-huninn", weight: "400", preload: false, adjustFontFallback: false });

export const metadata: Metadata = {
  title: { default: "SuppleMate", template: "%s · SuppleMate" },
  description: "保健品管理助手：每日服用表、庫存與補貨提醒。",
  applicationName: "SuppleMate",
};

export const viewport: Viewport = {
  themeColor: "#fffcf8",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-Hant" className={`${fredoka.variable} ${huninn.variable} h-full`}>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ToastProvider>
          <StoreProvider>{children}</StoreProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
