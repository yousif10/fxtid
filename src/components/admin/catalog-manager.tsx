"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/misc";
import { useFormAction } from "@/components/ui/use-form-action";
import type { ActionState } from "@/lib/actions";

export type CatalogItem = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  employeeCount: number;
  sortOrder?: number;
  departmentId?: string | null;
  departmentName?: string | null;
};

type Kind = "department" | "position";

/** Shared list + create/edit/delete UI for departments and positions. */
export function CatalogManager({
  kind,
  items,
  canManage,
  departments = [],
  saveAction,
  deleteAction,
}: {
  kind: Kind;
  items: CatalogItem[];
  canManage: boolean;
  departments?: Array<{ id: string; name: string }>;
  saveAction: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  deleteAction: (id: string) => Promise<ActionState>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<CatalogItem | "new" | null>(null);
  const [deleting, setDeleting] = useState<CatalogItem | null>(null);
  const [pending, startTransition] = useTransition();
  const noun = kind === "department" ? "department" : "position";
  const { pending: saving, onSubmit, errorFor } = useFormAction(saveAction, {
    onSuccess: () => {
      setEditing(null);
      router.refresh();
    },
  });
  const current = editing && editing !== "new" ? editing : null;

  return (
    <>
      {canManage ? (
        <div className="flex justify-end border-b border-border px-5 py-3">
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus /> Add {noun}
          </Button>
        </div>
      ) : null}
      {items.length === 0 ? (
        <EmptyState title={`No ${noun}s yet`} description={`Add your first ${noun}.`} />
      ) : (
        <ul className="divide-y divide-border">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-4 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {it.name}
                  {!it.active ? <Badge>Inactive</Badge> : null}
                  {it.departmentName ? <Badge tone="info">{it.departmentName}</Badge> : null}
                </p>
                {it.description ? <p className="mt-0.5 truncate text-sm text-muted-foreground">{it.description}</p> : null}
              </div>
              <span className="whitespace-nowrap text-sm text-muted-foreground">
                <span className="font-semibold text-foreground tabular-nums">{it.employeeCount}</span> employee{it.employeeCount === 1 ? "" : "s"}
              </span>
              {canManage ? (
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => setEditing(it)} aria-label={`Edit ${it.name}`}>
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleting(it)}
                    aria-label={`Delete ${it.name}`}
                    disabled={it.employeeCount > 0}
                    title={it.employeeCount > 0 ? "In use - deactivate instead" : undefined}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={current ? `Edit ${noun}` : `Add ${noun}`}>
        <form onSubmit={onSubmit} className="space-y-4" noValidate key={current?.id ?? "new"}>
          {current ? <input type="hidden" name="id" value={current.id} /> : null}
          <Field label="Name" htmlFor="cat-name" required error={errorFor("name")}>
            <Input id="cat-name" name="name" defaultValue={current?.name ?? ""} maxLength={80} autoFocus />
          </Field>
          {kind === "position" ? (
            <Field label="Default department" htmlFor="cat-dept" hint="Optional - helps filter job titles on the employee form." error={errorFor("departmentId")}>
              <Select id="cat-dept" name="departmentId" defaultValue={current?.departmentId ?? ""}>
                <option value="">— Any department —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label="Sort order" htmlFor="cat-sort" hint="Lower numbers appear first." error={errorFor("sortOrder")}>
              <Input id="cat-sort" name="sortOrder" type="number" min={0} max={9999} defaultValue={current?.sortOrder ?? 100} />
            </Field>
          )}
          <Field label="Description" htmlFor="cat-desc" error={errorFor("description")}>
            <Textarea id="cat-desc" name="description" rows={2} defaultValue={current?.description ?? ""} maxLength={300} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="active" defaultChecked={current?.active ?? true} /> Active (available for new employees)
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : null} Save
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={!!deleting} onClose={() => setDeleting(null)} title={`Delete ${deleting?.name}?`} description="This cannot be undone." size="sm">
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await deleteAction(deleting!.id);
                if (res?.ok) {
                  toast.success(res.message);
                  setDeleting(null);
                  router.refresh();
                } else toast.error(res?.message ?? "Could not delete.");
              })
            }
          >
            {pending ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete
          </Button>
        </div>
      </Dialog>
    </>
  );
}
