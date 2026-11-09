import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cx } from "@/lib/cx";

const CONTROL =
  "w-full rounded-[var(--radius-chip)] border-2 border-line-ui bg-white px-3.5 text-[15px] text-ink placeholder:text-placeholder transition-colors focus:border-focus focus:outline-none focus:ring-4 focus:ring-focus/25 disabled:bg-cream aria-[invalid=true]:border-red";

export function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-bold text-ink">
        {label}
        {required && (
          <span className="ml-1 text-pink-text" aria-hidden>
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p className="text-xs font-bold text-red-text" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-text-3">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className, invalid, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input className={cx(CONTROL, "h-12", className)} aria-invalid={invalid || undefined} {...rest} />;
}

export function Select({
  className,
  invalid,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean; children: ReactNode }) {
  return (
    <select
      className={cx(CONTROL, "h-12 appearance-none pr-10", className)}
      aria-invalid={invalid || undefined}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Textarea({
  className,
  invalid,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return <textarea className={cx(CONTROL, "min-h-24 py-3", className)} aria-invalid={invalid || undefined} {...rest} />;
}

/** select 的下拉箭頭包裝 */
export function SelectWrap({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      {children}
      <svg
        aria-hidden
        className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-text-2"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  );
}
