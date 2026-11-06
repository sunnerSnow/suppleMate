import { DEFAULT_TIMEZONE } from "./constants";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

/**
 * 以使用者時區取得某個時刻的 YYYY-MM-DD。
 * 不可直接用 UTC 日期判斷台灣使用者的「今天」。
 */
export function toPlanDate(instant: Date, timezone: string = DEFAULT_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

export function todayPlanDate(timezone: string = DEFAULT_TIMEZONE, now: Date = new Date()): string {
  return toPlanDate(now, timezone);
}

/** 對 YYYY-MM-DD 加減天數，純字串運算，不受本機時區影響 */
export function addDays(planDate: string, days: number): string {
  const [y, m, d] = planDate.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  const yy = next.getUTCFullYear();
  const mm = String(next.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(next.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** 兩個 YYYY-MM-DD 相差的天數（b - a） */
export function diffDays(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const ms = Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad);
  return Math.round(ms / 86_400_000);
}

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

/** 顯示用：11 月 6 日（週四） */
export function formatPlanDate(planDate: string): string {
  const [y, m, d] = planDate.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m} 月 ${d} 日（週${weekday}）`;
}

/** 顯示用：相對今天的標籤 */
export function relativeDayLabel(planDate: string, today: string): string | null {
  const diff = diffDays(today, planDate);
  if (diff === 0) return "今天";
  if (diff === -1) return "昨天";
  if (diff === 1) return "明天";
  return null;
}

/** 顯示用：以使用者時區顯示 HH:mm */
export function formatTime(iso: string, timezone: string = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

/** 顯示用：以使用者時區顯示 MM/DD HH:mm */
export function formatDateTime(iso: string, timezone: string = DEFAULT_TIMEZONE): string {
  const d = new Date(iso);
  const date = toPlanDate(d, timezone);
  const [, m, day] = date.split("-");
  return `${m}/${day} ${formatTime(iso, timezone)}`;
}
