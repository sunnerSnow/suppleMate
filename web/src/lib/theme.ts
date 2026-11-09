import { THEMES, type Theme } from "@/lib/types";

/** 主題 cookie：讓伺服器端第一次渲染就套對主題，避免閃爍；個人設定才是正本 */
export const THEME_COOKIE = "sm-theme";
export const DEFAULT_THEME: Theme = "a";

export const THEME_LABELS: Record<Theme, { name: string; description: string }> = {
  a: { name: "繪本粗線", description: "奶油米底、黑色粗線框、珊瑚紅與藍，粗圓體；今日頁是時間軸。" },
  b: { name: "旅行雜誌濃彩", description: "濃綠底、深藍與水藍色帶、黃卡紅標籤、波浪與跑馬燈。" },
};

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

/**
 * 改名前的代號 c／e 對應到 a／b：舊 cookie 不會在改名後閃回預設主題；其他值一律預設。
 * 用明確比對而不是物件查表：cookie 是使用者可控的字串，查表會撈到原型鏈上的 constructor 之類的東西。
 */
export function normalizeTheme(value: unknown): Theme {
  if (isTheme(value)) return value;
  if (value === "c") return "a";
  if (value === "e") return "b";
  return DEFAULT_THEME;
}

/** 在瀏覽器端立即切換主題（設定頁用；伺服器端的正本由 Server Action 更新） */
export function applyThemeToDocument(theme: Theme): void {
  if (typeof document !== "undefined") document.documentElement.dataset.theme = theme;
}
