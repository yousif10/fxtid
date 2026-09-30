"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Pencil, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-form-action";
import { ADMIN_ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, type AdminRole } from "@/lib/permissions";
import { createUserAction, resetUserPasswordAction, updateUserAction } from "@/app/(admin)/settings/actions";

export type AdminUserRow = {
  id: string;
  email: string;
  fullName: string;
  role: AdminRole;
  active: boolean;
  lastLoginAt: string | null;
  isSelf: boolean;
};

function RoleSelect({ id, defaultValue }: { id: string; defaultValue?: AdminRole }) {
  return (
    <Select id={id} name="role" defaultValue={defaultValue ?? "viewer"}>
      {ADMIN_ROLES.map((r) => (
        <option key={r} value={r}>
          {ROLE_LABELS[r]} — {ROLE_DESCRIPTIONS[r]}
        </option>
      ))}
    </Select>
  );
}

export function UserManager({ users }: { users: AdminUserRow[] }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<{ type: "create" } | { type: "edit" | "reset"; user: AdminUserRow } | null>(null);
  const done = () => {
    setDialog(null);
    router.refresh();
  };
  const create = useFormAction(createUserAction, { onSuccess: done });
  const update = useFormAction(updateUserAction, { onSuccess: done });
  const reset = useFormAction(resetUserPasswordAction, { onSuccess: done });
  const target = dialog && dialog.type !== "create" ? dialog.user : null;

  return (
    <>
      <div className="flex justify-end border-b border-border px-5 py-3">
        <Button size="sm" onClick={() => setDialog({ type: "create" })}>
          <UserPlus /> Add administrator
        </Button>
      </div>
      <ul className="divide-y divide-border">
        {users.map((u) => (
          <li key={u.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-semibold">
                {u.fullName} {u.isSelf ? <Badge tone="info">You</Badge> : null} {!u.active ? <Badge tone="danger">Disabled</Badge> : null}
              </p>
              <p className="text-sm text-muted-foreground">{u.email}</p>
            </div>
            <Badge tone={u.role === "super_admin" ? "navy" : "neutral"}>{ROLE_LABELS[u.role]}</Badge>
            <span className="text-xs text-muted-foreground sm:w-40 sm:text-right">{u.lastLoginAt ? `Last sign-in ${u.lastLoginAt}` : "Never signed in"}</span>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={() => setDialog({ type: "edit", user: u })} aria-label={`Edit ${u.fullName}`}>
                <Pencil />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setDialog({ type: "reset", user: u })} aria-label={`Reset password for ${u.fullName}`}>
                <KeyRound />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <Dialog open={dialog?.type === "create"} onClose={() => setDialog(null)} title="Add administrator" description="Create an account and share the password with the person securely (not by email in plain text).">
        <form onSubmit={create.onSubmit} className="space-y-4" noValidate>
          <Field label="Full name" htmlFor="u-name" required error={create.errorFor("fullName")}>
            <Input id="u-name" name="fullName" />
          </Field>
          <Field label="Email" htmlFor="u-email" required error={create.errorFor("email")}>
            <Input id="u-email" name="email" type="email" autoComplete="off" />
          </Field>
          <Field label="Role" htmlFor="u-role" error={create.errorFor("role")}>
            <RoleSelect id="u-role" />
          </Field>
          <Field label="Initial password" htmlFor="u-pass" required error={create.errorFor("password")} hint="At least 12 characters with letters and numbers.">
            <Input id="u-pass" name="password" type="password" autoComplete="new-password" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.pending}>
              {create.pending ? <Loader2 className="animate-spin" /> : null} Create
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={dialog?.type === "edit"} onClose={() => setDialog(null)} title={`Edit ${target?.fullName ?? ""}`} description="Changing role or disabling the account signs the person out immediately.">
        {target ? (
          <form onSubmit={update.onSubmit} className="space-y-4" noValidate>
            <input type="hidden" name="userId" value={target.id} />
            <Field label="Full name" htmlFor="e-name" error={update.errorFor("fullName")}>
              <Input id="e-name" name="fullName" defaultValue={target.fullName} />
            </Field>
            <Field label="Role" htmlFor="e-role" error={update.errorFor("role")}>
              <RoleSelect id="e-role" defaultValue={target.role} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="active" defaultChecked={target.active} /> Account active
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={update.pending}>
                {update.pending ? <Loader2 className="animate-spin" /> : null} Save
              </Button>
            </div>
          </form>
        ) : null}
      </Dialog>

      <Dialog open={dialog?.type === "reset"} onClose={() => setDialog(null)} title={`Reset password for ${target?.fullName ?? ""}`} size="sm">
        {target ? (
          <form onSubmit={reset.onSubmit} className="space-y-4" noValidate>
            <input type="hidden" name="userId" value={target.id} />
            <Field label="New password" htmlFor="r-pass" required error={reset.errorFor("password")} hint="At least 12 characters with letters and numbers.">
              <Input id="r-pass" name="password" type="password" autoComplete="new-password" />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={reset.pending}>
                {reset.pending ? <Loader2 className="animate-spin" /> : null} Reset password
              </Button>
            </div>
          </form>
        ) : null}
      </Dialog>
    </>
  );
}
