import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "@/lib/cx";

/** 白色線框卡片；alt 換另一組不對稱圓角；soft 是淡色無框版本 */
export function Card({
  className,
  alt,
  soft,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { alt?: boolean; soft?: boolean; children: ReactNode }) {
  return (
    <div className={cx("card", alt && "alt", soft && "soft", className)} {...rest}>
      {children}
    </div>
  );
}

export type BadgeTone = "ok" | "low" | "out" | "info" | "neutral";

/** 徽章：顏色只是輔助，文字本身要能表達意思 */
export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return <span className={cx("badge", `badge-${tone}`, className)}>{children}</span>;
}

/** 類別小膠囊（例如「隨餐」「空腹」） */
export function Cat({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cx("cat", className)}>{children}</span>;
}
