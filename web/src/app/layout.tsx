import type { Metadata, Viewport } from "next";
import { Albert_Sans, Noto_Sans_TC } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import { StoreProvider } from "@/lib/store/store-provider";
import "./globals.css";

const albert = Albert_Sans({ variable: "--font-albert", subsets: ["latin"], weight: ["500", "700", "800"] });
const notoTC = Noto_Sans_TC({ variable: "--font-noto-tc", weight: ["500", "700", "900"], preload: false });

export const metadata: Metadata = {
  title: { default: "SuppleMate", template: "%s · SuppleMate" },
  description: "保健品管理助手：每日服用表、庫存與補貨提醒。",
  applicationName: "SuppleMate",
};

export const viewport: Viewport = {
  themeColor: "#f8f5f1",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-Hant" className={`${albert.variable} ${notoTC.variable} h-full`}>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ToastProvider>
          <StoreProvider>{children}</StoreProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
