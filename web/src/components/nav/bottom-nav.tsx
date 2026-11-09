"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BoxIcon, CapsuleIcon, ClockIcon, ListIcon, SunIcon } from "@/components/ui/icons";

const TABS = [
  { href: "/today", label: "今日", Icon: SunIcon },
  { href: "/supplements", label: "保健品", Icon: CapsuleIcon },
  { href: "/inventory", label: "庫存", Icon: BoxIcon },
  { href: "/history", label: "紀錄", Icon: ClockIcon },
  { href: "/guide", label: "方案", Icon: ListIcon },
] as const;

/** 底部導覽：C 是文字＋紅色點狀底線；E 是深藍底、作用中變黃色圓形 */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="主要導覽" className="nav">
      <ul className="nav-list">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex flex-1">
              <Link href={href} aria-current={active ? "page" : undefined} className="nav-item">
                <span className="ic">
                  <Icon size={18} strokeWidth={2.6} />
                </span>
                <span className="nav-label">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
