import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { Sparkle } from "./decor";
import { TONE_BG, TONE_ON, TONE_TEXT, type Tone } from "./tone";

/**
 * 頁首：英文圓體小標做成彩色貼紙，下面是中文大標。
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  tone = "sky",
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  tone?: Tone;
}) {
  return (
    <header className="mb-5 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <Eyebrow tone={tone}>{eyebrow}</Eyebrow>
        <h1 className="mt-2 text-[28px] font-bold leading-tight text-ink">{title}</h1>
        {description && <div className="mt-1.5 text-sm text-text-2">{description}</div>}
      </div>
      {action && <div className="shrink-0 pb-1">{action}</div>}
    </header>
  );
}

/** 英文小標貼紙 */
export function Eyebrow({
  tone = "sky",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "font-en inline-flex -rotate-2 items-center gap-1 rounded-full px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.12em]",
        TONE_BG[tone],
        TONE_ON[tone],
        className,
      )}
    >
      <Sparkle className="size-3 opacity-80" />
      {children}
    </span>
  );
}

/** 區塊小標（例如時段名稱）：彩色圓點＋文字 */
export function SectionTitle({
  children,
  aside,
  tone = "sky",
}: {
  children: ReactNode;
  aside?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-3 px-1">
      <h2 className="flex items-center gap-2 text-[15px] font-bold text-ink">
        <span aria-hidden className={cx("inline-block size-3 rounded-full", TONE_BG[tone])} />
        {children}
      </h2>
      {aside && <div className={cx("font-en tnum text-sm font-semibold", TONE_TEXT[tone])}>{aside}</div>}
    </div>
  );
}
