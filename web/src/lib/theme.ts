import { THEMES, type Theme } from "@/lib/types";

/** 主題 cookie：讓伺服器端第一次渲染就套對主題，避免閃爍；個人設定才是正本 */
export const THEME_COOKIE = "sm-theme";
export const DEFAULT_THEME: Theme = "c";

export const THEME_LABELS: Record<Theme, { name: string; description: string }> = {
  c: { name: "繪本粗線", description: "奶油米底、黑色粗線框、珊瑚紅與藍，粗圓體；今日頁是時間軸。" },
  e: { name: "旅行雜誌濃彩", description: "濃綠底、深藍與水藍色帶、黃卡紅標籤、波浪與跑馬燈。" },
};

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

/** 在瀏覽器端立即切換主題（設定頁用；伺服器端的正本由 Server Action 更新） */
export function applyThemeToDocument(theme: Theme): void {
  if (typeof document !== "undefined") document.documentElement.dataset.theme = theme;
}
