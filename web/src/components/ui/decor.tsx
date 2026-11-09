import type { SVGProps } from "react";
import { cx } from "@/lib/cx";

/** 裝飾用的雲朵，預設白色；純裝飾，aria-hidden */
export function Cloud({ className, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 120 60" fill="currentColor" aria-hidden className={cx("block", className)} {...rest}>
      <path d="M28 58h66c13 0 22-8 22-19 0-10-8-18-19-18-1 0-2 0-3 .2C91 10 80 2 67 2 54 2 43 10 40 21c-2-.6-4-1-6-1-11 0-20 8-20 19 0 10 6 19 14 19z" />
    </svg>
  );
}

/** 圓潤的不規則色塊，當卡片或空狀態的背景 */
export function Blob({ className, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 200 200" fill="currentColor" aria-hidden className={cx("block", className)} {...rest}>
      <path d="M165 45c20 24 30 58 18 86s-46 48-80 50-66-12-84-38-20-62-6-88S56 14 86 10s59 11 79 35z" />
    </svg>
  );
}

/** 小星星／亮點 */
export function Sparkle({ className, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={cx("block", className)} {...rest}>
      <path d="M12 2c.6 5.5 4.5 9.4 10 10-5.5.6-9.4 4.5-10 10-.6-5.5-4.5-9.4-10-10 5.5-.6 9.4-4.5 10-10z" />
    </svg>
  );
}

/** 波浪分隔線（上方區塊顏色往下方延伸成波浪） */
export function Wave({ className, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 400 24"
      preserveAspectRatio="none"
      fill="currentColor"
      aria-hidden
      className={cx("block w-full", className)}
      {...rest}
    >
      <path d="M0 0h400v8c-25 10-50 14-75 10s-50-14-75-10-50 14-75 10-50-14-75-10S25 22 0 12z" />
    </svg>
  );
}

/** 點點虛線分隔 */
export function Dots({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cx("h-1.5 w-full", className)}
      style={{
        backgroundImage: "radial-gradient(circle, currentColor 1.5px, transparent 1.6px)",
        backgroundSize: "10px 6px",
        backgroundRepeat: "repeat-x",
        backgroundPosition: "center",
      }}
    />
  );
}
