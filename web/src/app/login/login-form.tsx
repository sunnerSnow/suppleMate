"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { loginAction, type AuthState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
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
      <div role="tablist" aria-label="登入或註冊" className="flex gap-2">
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
            className={`chip flex-1 justify-center ${intent === v ? "on" : ""}`}
          >
            {v === "signin" ? "登入" : "註冊"}
          </button>
        ))}
      </div>

      {state.error && (
        <p role="alert" className="error-text m-0 text-sm">
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
      <Button type="submit" size="lg" block loading={pending}>
        {intent === "signup" ? "建立帳號" : "登入"}
      </Button>
    </form>
  );
}
