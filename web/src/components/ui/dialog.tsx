"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { IconButton } from "./button";
import { Close } from "./icons";

/**
 * 以原生 <dialog> 實作的底部抽屜（手機）／置中對話框（桌面）。
 * 原生 dialog 自帶焦點鎖定與 Esc 關閉。
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={cx(
        "m-0 w-full max-w-none bg-transparent p-0 backdrop:bg-ink/50 backdrop:backdrop-blur-[2px]",
        "fixed inset-x-0 bottom-0 top-auto max-h-[92dvh] sm:inset-0 sm:m-auto sm:max-h-[85dvh] sm:max-w-md",
        "open:animate-fade-up",
      )}
    >
      <div
        className={cx(
          "flex max-h-[92dvh] flex-col rounded-t-[32px] border-2 border-line bg-white shadow-2xl sm:max-h-[85dvh] sm:rounded-[32px]",
          className,
        )}
      >
        {/* 手機抽屜的小把手 */}
        <div aria-hidden className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-line-strong sm:hidden" />
        <div className="flex items-start gap-3 px-5 pt-4 pb-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-ink">{title}</h2>
            {description && <p className="mt-1 text-sm text-text-2">{description}</p>}
          </div>
          <IconButton label="關閉" onClick={onClose} className="-mr-2 -mt-1">
            <Close />
          </IconButton>
        </div>
        <div className="overflow-y-auto px-5 pb-5 pb-safe">{children}</div>
      </div>
    </dialog>
  );
}
