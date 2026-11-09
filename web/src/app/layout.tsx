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

async function currentTheme() {
  const cookieTheme = (await cookies()).get(THEME_COOKIE)?.value;
  return isTheme(cookieTheme) ? cookieTheme : DEFAULT_THEME;
}

/** icon 跟著主題：C 繪本粗線／E 旅行雜誌濃彩各一套（public/icons/，由 design/icon-proposals.html 的概念 C 產生） */
export async function generateMetadata(): Promise<Metadata> {
  const theme = await currentTheme();
  return {
    title: { default: "SuppleMate", template: "%s · SuppleMate" },
    description: "保健品管理助手：每日服用表、庫存與補貨提醒、小知識與一鍵健檢。",
    applicationName: "SuppleMate",
    icons: {
      icon: [
        { url: `/icons/icon-${theme}.svg`, type: "image/svg+xml" },
        { url: `/icons/icon-${theme}-192.png`, sizes: "192x192", type: "image/png" },
      ],
      apple: [{ url: `/icons/apple-${theme}.png`, sizes: "180x180", type: "image/png" }],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const theme = await currentTheme();
  return (
    <html lang="zh-Hant" data-theme={theme} className={`${zenMaru.variable} ${montserrat.variable} h-full`}>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
