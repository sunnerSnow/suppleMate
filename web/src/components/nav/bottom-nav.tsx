"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BoxIcon, CapsuleIcon, ClockIcon, SunIcon } from "@/components/ui/icons";
import { TONE_BG, TONE_ON, type Tone } from "@/components/ui/tone";
import { cx } from "@/lib/cx";

const TABS: { href: string; label: string; Icon: typeof SunIcon; tone: Tone }[] = [
  { href: "/today", label: "今日", Icon: SunIcon, tone: "sky" },
  { href: "/supplements", label: "保健品", Icon: CapsuleIcon, tone: "green" },
  { href: "/inventory", label: "庫存", Icon: BoxIcon, tone: "orange" },
  { href: "/history", label: "紀錄", Icon: ClockIcon, tone: "purple" },
];

/** 浮在底部的膠囊導覽；作用中的頁籤變成該頁主題色的圓形貼紙 */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="主要導覽" className="fixed inset-x-0 bottom-0 z-40 px-4 pb-safe">
      <ul className="mx-auto mb-3 flex max-w-md items-stretch rounded-full border-2 border-line bg-white p-1.5 shadow-[0_4px_0_0_var(--line),0_12px_30px_-12px_rgba(0,0,0,0.25)]">
        {TABS.map(({ href, label, Icon, tone }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex h-14 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-bold transition-colors",
                  active ? "text-ink" : "text-text-2 hover:bg-cream hover:text-ink",
                )}
              >
                <span
                  className={cx(
                    "flex h-7 w-11 items-center justify-center rounded-full transition-[background-color,transform] duration-300",
                    active && cx(TONE_BG[tone], TONE_ON[tone], "animate-pop"),
                  )}
                >
                  <Icon size={20} strokeWidth={2.4} />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
