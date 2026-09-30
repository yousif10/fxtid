"use client";

import { useRef } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-form-action";
import { changeOwnPasswordAction } from "../settings/actions";

export function ChangePasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const { pending, onSubmit, errorFor } = useFormAction(changeOwnPasswordAction, { onSuccess: () => formRef.current?.reset() });
  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="Current password" htmlFor="currentPassword" error={errorFor("currentPassword")}>
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" />
      </Field>
      <Field label="New password" htmlFor="newPassword" error={errorFor("newPassword")} hint="At least 12 characters with letters and numbers.">
        <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" />
      </Field>
      <Field label="Confirm new password" htmlFor="confirmPassword" error={errorFor("confirmPassword")}>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null} Update password
      </Button>
    </form>
  );
}
