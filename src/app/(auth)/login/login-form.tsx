"use client";

import { startTransition, useActionState, useState } from "react";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { loginAction } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(loginAction, null);
  const [show, setShow] = useState(false);

  return (
    <form
      className="mt-8 space-y-5"
      noValidate
      onSubmit={(e) => {
        // Manual dispatch: avoids React's automatic form reset so the email survives a failed attempt.
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      <input type="hidden" name="next" value={next} />
      {state && !state.ok ? (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {state.message}
        </div>
      ) : null}
      <Field label="Email address" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="username" required autoFocus placeholder="name@company.co.uk" />
      </Field>
      <Field label="Password" htmlFor="password">
        <div className="relative">
          <Input id="password" name="password" type={show ? "text" : "password"} autoComplete="current-password" required className="pr-10" />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground"
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
