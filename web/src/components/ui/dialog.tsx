"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { IconButton } from "./button";
import { Close } from "./icons";

/** 原生 <dialog>：手機貼底抽屜、桌面置中；自帶焦點鎖定與 Esc 關閉 */
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
        "m-0 w-full max-w-none bg-transparent p-0 backdrop:bg-black/50",
        "fixed inset-x-0 bottom-0 top-auto max-h-[92dvh] sm:inset-0 sm:m-auto sm:max-h-[85dvh] sm:max-w-md",
        "open:animate-fade-up",
      )}
    >
      <div className={cx("sheet flex max-h-[92dvh] flex-col sm:max-h-[85dvh]", className)}>
        <div className="sheet-handle sm:hidden" aria-hidden />
        <div className="flex items-start gap-3 px-5 pt-4 pb-2">
          <div className="min-w-0 flex-1">
            <h2 className="h2 text-xl">{title}</h2>
            {description && <p className="sub-text mt-1">{description}</p>}
          </div>
          <IconButton label="關閉" onClick={onClose}>
            <Close />
          </IconButton>
        </div>
        <div className="on-surface overflow-y-auto px-5 pb-5 pb-safe">{children}</div>
      </div>
    </dialog>
  );
}
