import type { MetadataRoute } from "next";
import { cookies } from "next/headers";
import { THEME_COOKIE, normalizeTheme } from "@/lib/theme";
import type { Theme } from "@/lib/types";

/** 加到主畫面時的名稱、顏色與 icon；跟著 sm-theme cookie 用 A 或 B 版 */
const COLORS: Record<Theme, { background: string; theme: string }> = {
  a: { background: "#FAF2EB", theme: "#222222" },
  b: { background: "#018C3E", theme: "#1D2088" },
};

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const cookieTheme = (await cookies()).get(THEME_COOKIE)?.value;
  const theme: Theme = normalizeTheme(cookieTheme);
  return {
    name: "SuppleMate 保健品管理助手",
    short_name: "SuppleMate",
    description: "每日服用表、庫存與補貨提醒、小知識與一鍵健檢。",
    start_url: "/today",
    display: "standalone",
    lang: "zh-Hant",
    background_color: COLORS[theme].background,
    theme_color: COLORS[theme].theme,
    icons: [
      { src: `/icons/icon-${theme}-192.png`, sizes: "192x192", type: "image/png" },
      { src: `/icons/icon-${theme}-512.png`, sizes: "512x512", type: "image/png" },
      { src: `/icons/maskable-${theme}-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
