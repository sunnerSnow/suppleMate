import type { ReactNode } from "react";

/**
 * 頁首：英文小標 + 中文大標，右側可放操作。
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="mb-5 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-sage-600">{eyebrow}</p>
        <h1 className="mt-1 text-[26px] font-black leading-tight tracking-tight text-ink">{title}</h1>
        {description && <div className="mt-1.5 text-sm text-text-2">{description}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

/** 區塊小標（例如時段名稱） */
export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3 px-1">
      <h2 className="flex items-center gap-2 text-sm font-black text-ink">
        <span aria-hidden className="inline-block size-2 rounded-full bg-sage-600" />
        {children}
      </h2>
      {aside && <div className="text-xs font-bold text-text-3 tnum">{aside}</div>}
    </div>
  );
}
