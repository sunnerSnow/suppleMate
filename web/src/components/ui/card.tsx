import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "@/lib/cx";
import { TONE_BADGE, type Tone } from "./tone";

/** 白色厚圓角卡片，2px 淡邊框＋一點點底部陰影 */
export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      className={cx(
        "rounded-[var(--radius-card)] border-2 border-line bg-white p-4 shadow-[0_3px_0_0_var(--line)]",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/** 貼紙式徽章：淡色底、深色字。顏色只是輔助，文字本身要能表達意思。 */
export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold leading-none whitespace-nowrap",
        TONE_BADGE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
