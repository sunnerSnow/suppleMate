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
        // 點背景關閉
        if (e.target === e.currentTarget) onClose();
      }}
      className={cx(
        "m-0 w-full max-w-none bg-transparent p-0 backdrop:bg-ink/40 backdrop:backdrop-blur-[2px]",
        // 手機：貼底；桌面：置中
        "fixed inset-x-0 bottom-0 top-auto max-h-[92dvh] sm:inset-0 sm:m-auto sm:max-w-md sm:max-h-[85dvh]",
        "open:animate-fade-up",
      )}
    >
      <div
        className={cx(
          "flex max-h-[92dvh] flex-col rounded-t-[28px] bg-paper shadow-2xl sm:max-h-[85dvh] sm:rounded-[28px]",
          className,
        )}
      >
        <div className="flex items-start gap-3 px-5 pt-5 pb-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-black text-ink">{title}</h2>
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
