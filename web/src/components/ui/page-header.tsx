import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

/** 頂欄：logo 帶（E 下方有波浪邊）；右側放操作 */
export function AppTop({ action }: { action?: ReactNode }) {
  return (
    <>
      <header className="app-top">
        <div className="logo">
          <span className="main">SuppleMate</span>
          <span className="sub">保健品管理助手</span>
        </div>
        {action}
      </header>
      <div className="app-top-edge" aria-hidden />
    </>
  );
}

/** 英文小標：C 是黑色膠囊、E 是深藍大字 */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx("eyebrow", className)}>{children}</span>;
}

/** 頁面標題區 */
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3 px-5 pt-3">
      <div className="min-w-0">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="h1 mt-2">{title}</h1>
        {description && <div className="sub-text mt-1.5">{description}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** 區塊小標（時段名稱等）＋右側計數；en 是 E 主題顯示的英文小字 */
export function SectionTitle({
  children,
  aside,
  en,
  done,
}: {
  children: ReactNode;
  aside?: ReactNode;
  en?: string;
  done?: boolean;
}) {
  return (
    <div className="slot-head">
      <h2 className="h2">
        {en && <span className="en">{en}</span>}
        {children}
      </h2>
      {aside && <span className={cx("card-count", done && "done")}>{aside}</span>}
    </div>
  );
}
