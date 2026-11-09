import Link from "next/link";
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { cx } from "@/lib/cx";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

/**
 * 厚底「餅乾」按鈕：底下一條實色陰影，按下時往下壓（.press）。
 * 文字一律深色或白色且對比 ≥ 4.5:1：黃／天空藍底用深灰字，深綠／深灰底用白字。
 */
const VARIANTS: Record<Variant, { cls: string; shadow: string }> = {
  primary: { cls: "bg-yellow text-ink hover:brightness-105", shadow: "var(--yellow-deep)" },
  secondary: { cls: "bg-ink text-white hover:bg-text-2", shadow: "#111111" },
  outline: { cls: "bg-paper text-ink border-2 border-line-strong hover:bg-cream", shadow: "var(--line-strong)" },
  ghost: { cls: "bg-transparent text-text-2 hover:bg-cream-deep hover:text-ink", shadow: "transparent" },
  danger: { cls: "bg-red-soft text-red-text hover:bg-red-text hover:text-white", shadow: "#e0b4b3" },
};

const SIZES: Record<Size, string> = {
  sm: "h-10 px-4 text-sm gap-1.5",
  md: "h-12 px-6 text-[15px] gap-2",
  lg: "h-14 px-8 text-base gap-2",
};

const BASE =
  "press inline-flex items-center justify-center rounded-full font-bold leading-none whitespace-nowrap select-none cursor-pointer transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus";

function styleFor(variant: Variant): CSSProperties {
  const shadow = VARIANTS[variant].shadow;
  return variant === "ghost"
    ? {}
    : ({ "--btn-shadow": `0 4px 0 0 ${shadow}`, "--press-shadow": shadow } as CSSProperties);
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className,
  children,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      className={cx(BASE, VARIANTS[variant].cls, SIZES[size], className)}
      style={{ ...styleFor(variant), ...style }}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={cx(BASE, VARIANTS[variant].cls, SIZES[size], className)} style={styleFor(variant)}>
      {children}
    </Link>
  );
}

/** 圓形圖示按鈕（44px 以上的觸控目標） */
export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex size-11 cursor-pointer items-center justify-center rounded-full border-2 border-line bg-paper text-ink transition-colors hover:bg-cream active:scale-95 disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cx(
        "inline-block size-4 animate-spin rounded-full border-[2.5px] border-current border-t-transparent",
        className,
      )}
    />
  );
}
