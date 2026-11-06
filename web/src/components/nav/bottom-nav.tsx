"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BoxIcon, CapsuleIcon, ClockIcon, SunIcon } from "@/components/ui/icons";
import { cx } from "@/lib/cx";

const TABS = [
  { href: "/today", label: "今日", Icon: SunIcon },
  { href: "/supplements", label: "保健品", Icon: CapsuleIcon },
  { href: "/inventory", label: "庫存", Icon: BoxIcon },
  { href: "/history", label: "紀錄", Icon: ClockIcon },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="主要導覽"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line-soft bg-paper/95 backdrop-blur pb-safe"
    >
      <ul className="mx-auto flex max-w-lg items-stretch">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-bold transition-colors",
                  active ? "text-sage-700" : "text-text-3 hover:text-text",
                )}
              >
                <span
                  className={cx(
                    "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                    active && "bg-sage-100",
                  )}
                >
                  <Icon size={20} />
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
