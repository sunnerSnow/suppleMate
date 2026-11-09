import type { Metadata, Viewport } from "next";
import { Montserrat, Zen_Maru_Gothic } from "next/font/google";
import { cookies } from "next/headers";
import { ToastProvider } from "@/components/ui/toast";
import { DEFAULT_THEME, THEME_COOKIE, isTheme } from "@/lib/theme";
import "./globals.css";
// 繁中字型自架分片（scripts/subset-font.py 產生）：建置不再依賴 Google Fonts 的下載是否成功
import "./fonts/huninn/huninn.css";
import "./fonts/noto-sans-tc/noto-sans-tc.css";

// 主題 C：粉圓體（繁中，自架）＋ Zen Maru Gothic（英數）
const zenMaru = Zen_Maru_Gothic({ variable: "--font-zen-maru", weight: ["700", "900"], subsets: ["latin"] });
// 主題 E：Noto Sans TC（繁中，自架）＋ Montserrat（英數）
const montserrat = Montserrat({
  variable: "--font-montserrat",
  weight: ["700", "800", "900"],
  style: ["normal", "italic"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "SuppleMate", template: "%s · SuppleMate" },
  description: "保健品管理助手：每日服用表、庫存與補貨提醒。",
  applicationName: "SuppleMate",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const cookieTheme = (await cookies()).get(THEME_COOKIE)?.value;
  const theme = isTheme(cookieTheme) ? cookieTheme : DEFAULT_THEME;
  return (
    <html lang="zh-Hant" data-theme={theme} className={`${zenMaru.variable} ${montserrat.variable} h-full`}>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
