/**
 * 主題色調。每個頁面一個主色：今日＝sky、保健品＝green、庫存＝orange、紀錄＝purple。
 * 文字一律用深色（ink 或 *-text），彩色只拿來做背景、邊框與圖示，確保對比。
 */
export type Tone = "sky" | "green" | "orange" | "yellow" | "purple" | "pink" | "red" | "neutral";

/** 實色底。粉／紅的亮色版配任何文字都不達 4.5:1，所以實色底一律用深色版（*-text 色），搭白字。 */
export const TONE_BG: Record<Tone, string> = {
  sky: "bg-sky",
  green: "bg-green",
  orange: "bg-orange",
  yellow: "bg-yellow",
  purple: "bg-purple",
  pink: "bg-pink-text",
  red: "bg-red-text",
  neutral: "bg-cream-deep",
};

/** 放在實色主題底上的文字／圖示顏色：淺色底用深灰，紫／粉／紅底用白 */
export const TONE_ON: Record<Tone, string> = {
  sky: "text-ink",
  green: "text-ink",
  orange: "text-ink",
  yellow: "text-ink",
  purple: "text-white",
  pink: "text-white",
  red: "text-white",
  neutral: "text-ink",
};

export const TONE_SOFT: Record<Tone, string> = {
  sky: "bg-sky-soft",
  green: "bg-green-soft",
  orange: "bg-orange-soft",
  yellow: "bg-yellow-soft",
  purple: "bg-purple-soft",
  pink: "bg-pink-soft",
  red: "bg-red-soft",
  neutral: "bg-cream",
};

export const TONE_TEXT: Record<Tone, string> = {
  sky: "text-sky-text",
  green: "text-green-text",
  orange: "text-orange-text",
  yellow: "text-orange-text",
  purple: "text-purple-text",
  pink: "text-pink-text",
  red: "text-red-text",
  neutral: "text-text-2",
};

export const TONE_BORDER: Record<Tone, string> = {
  sky: "border-sky",
  green: "border-green",
  orange: "border-orange",
  yellow: "border-yellow",
  purple: "border-purple",
  pink: "border-pink",
  red: "border-red",
  neutral: "border-line-strong",
};

/** 徽章：淡色底＋深色字＋同色細框，不靠顏色單獨傳達意思（文字一定要有） */
export const TONE_BADGE: Record<Tone, string> = {
  sky: "bg-sky-soft text-sky-text",
  green: "bg-green-soft text-green-text",
  orange: "bg-orange-soft text-orange-text",
  yellow: "bg-yellow-soft text-orange-text",
  purple: "bg-purple-soft text-purple-text",
  pink: "bg-pink-soft text-pink-text",
  red: "bg-red-soft text-red-text",
  neutral: "bg-cream-deep text-text-2",
};
