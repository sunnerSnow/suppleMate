import type { SVGProps } from "react";
import { cx } from "@/lib/cx";

/** 波浪分隔線（只在 E 主題顯示） */
export function Wave({ sky }: { sky?: boolean }) {
  return <div className={cx("wave", sky && "sky")} aria-hidden />;
}

/** 黃色點點列（只在 E 主題顯示） */
export function Dots({ className }: { className?: string }) {
  return <div className={cx("dots", className)} aria-hidden />;
}

/** 手繪愛心（C 主題的裝飾） */
export function Heart({ className, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="var(--line)"
      strokeWidth="2"
      strokeLinejoin="round"
      aria-hidden
      className={cx("block", className)}
      {...rest}
    >
      <path d="M12 21s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.4-7 10-7 10z" />
    </svg>
  );
}

/** 小圖示跑馬燈（只在 E 主題顯示） */
export function Marquee() {
  const tiles = (
    <>
      <span className="marquee-tile">
        <CapsuleGlyph />
      </span>
      <span className="marquee-tile y">
        <SunGlyph />
      </span>
      <span className="marquee-tile o">
        <BagGlyph />
      </span>
      <span className="marquee-tile b">
        <DropGlyph />
      </span>
      <span className="marquee-tile">
        <BottleGlyph />
      </span>
    </>
  );
  return (
    <div className="marquee" aria-hidden>
      <div className="marquee-track">
        {tiles}
        {tiles}
      </div>
    </div>
  );
}

const g = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};
const CapsuleGlyph = () => (
  <svg {...g}>
    <rect x="3" y="8" width="18" height="8" rx="4" transform="rotate(-35 12 12)" />
    <path d="M9.5 7.8l5 8.4" />
  </svg>
);
const SunGlyph = () => (
  <svg {...g} stroke="#1d2088">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2" />
  </svg>
);
const BagGlyph = () => (
  <svg {...g}>
    <path d="M6 20h12l-1-10H7z" />
    <path d="M9 10V6a3 3 0 0 1 6 0v4" />
  </svg>
);
const DropGlyph = () => (
  <svg {...g} stroke="#1d2088">
    <path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z" />
  </svg>
);
const BottleGlyph = () => (
  <svg {...g}>
    <path d="M9 3h6v3l2 3v11a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V9l2-3z" />
    <path d="M9 13h6" />
  </svg>
);
