"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { loginAction, type AuthState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { cx } from "@/lib/cx";
import { credentialsSchema } from "@/lib/validation/auth";

export function LoginForm() {
  const id = useId();
  const [intent, setIntent] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [state, setState] = useState<AuthState>({});
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = credentialsSchema.safeParse({ email, password, name: intent === "signup" ? name : undefined });
    if (!parsed.success) {
      setState({
        error: parsed.error.issues[0].message,
        fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])),
      });
      return;
    }
    setState({});
    startTransition(async () => {
      setState(await loginAction(intent, parsed.data));
    });
  };

  const fieldError = (key: string) => state.fieldErrors?.[key];

  return (
    <form onSubmit={onSubmit} noValidate className="mt-4 flex flex-col gap-4">
      <div role="tablist" aria-label="登入或註冊" className="flex rounded-full border-2 border-line bg-cream p-1">
        {(["signin", "signup"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={intent === v}
            onClick={() => {
              setIntent(v);
              setState({});
            }}
            className={cx(
              "flex-1 cursor-pointer rounded-full py-2 text-sm font-bold transition-colors",
              intent === v ? "bg-ink text-white" : "text-text-2 hover:text-ink",
            )}
          >
            {v === "signin" ? "登入" : "註冊"}
          </button>
        ))}
      </div>

      {state.error && (
        <p
          role="alert"
          className="rounded-[var(--radius-chip)] border-2 border-red bg-red-soft px-3 py-2 text-sm font-bold text-red-text"
        >
          {state.error}
        </p>
      )}

      {intent === "signup" && (
        <Field label="顯示名稱" htmlFor={`${id}-name`} error={fieldError("name")} hint="留空就用 Email 的帳號部分">
          <Input id={`${id}-name`} autoComplete="nickname" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
      )}
      <Field label="Email" htmlFor={`${id}-email`} required error={fieldError("email")}>
        <Input
          id={`${id}-email`}
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          invalid={Boolean(fieldError("email"))}
        />
      </Field>
      <Field label="密碼" htmlFor={`${id}-password`} required error={fieldError("password")} hint="至少 8 個字元">
        <Input
          id={`${id}-password`}
          type="password"
          autoComplete={intent === "signup" ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          invalid={Boolean(fieldError("password"))}
        />
      </Field>
      <Button type="submit" size="lg" className="mt-1 w-full" loading={pending}>
        {intent === "signup" ? "建立帳號" : "登入"}
      </Button>
    </form>
  );
}
