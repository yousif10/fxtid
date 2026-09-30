"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-form-action";
import { EMPLOYMENT_STATUSES, EMPLOYMENT_STATUS_LABELS } from "@/lib/validation/employee";
import { createEmployeeAction, updateEmployeeAction } from "@/app/(admin)/employees/actions";
import type { ActionState } from "@/lib/actions";

type Option = { id: string; name: string; active: boolean };
type PositionOption = Option & { departmentId: string | null };

export type EmployeeFormValues = {
  id?: string;
  employeeNumber?: string;
  fullName?: string;
  displayName?: string | null;
  email?: string | null;
  phone?: string | null;
  departmentId?: string | null;
  positionId?: string | null;
  employmentStatus?: string;
  startDate?: string | null;
  endDate?: string | null;
  notes?: string | null;
};

export function EmployeeForm({
  mode,
  initial,
  departments,
  positions,
  canSetNumber,
  nextNumberPreview,
}: {
  mode: "create" | "edit";
  initial?: EmployeeFormValues;
  departments: Option[];
  positions: PositionOption[];
  canSetNumber: boolean;
  nextNumberPreview?: string;
}) {
  const action = (mode === "create" ? createEmployeeAction : updateEmployeeAction) as unknown as (p: ActionState, fd: FormData) => Promise<ActionState>;
  const { pending, onSubmit, errorFor } = useFormAction(action, { successToast: false });
  const [departmentId, setDepartmentId] = useState(initial?.departmentId ?? "");
  const [positionId, setPositionId] = useState(initial?.positionId ?? "");

  // Show positions for the chosen department first; positions without a department are always available.
  const positionOptions = useMemo(() => {
    const usable = positions.filter((p) => p.active || p.id === initial?.positionId);
    if (!departmentId) return { primary: usable, other: [] as PositionOption[] };
    return {
      primary: usable.filter((p) => p.departmentId === departmentId || p.departmentId === null),
      other: usable.filter((p) => p.departmentId !== departmentId && p.departmentId !== null),
    };
  }, [positions, departmentId, initial?.positionId]);

  const err = (n: string) => errorFor(n);
  const aria = (n: string) => (err(n) ? { "aria-invalid": true, "aria-describedby": `${n}-error` } : {});

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6 xl:grid-cols-3">
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <div className="space-y-6 xl:col-span-2">
        <Card>
          <CardHeader title="Identity" description="Shown on the ID card and verification page." />
          <CardBody className="grid gap-5 sm:grid-cols-2">
            <Field label="Full name" htmlFor="fullName" required error={err("fullName")} className="sm:col-span-2" hint="Legal name as it should appear on the card.">
              <Input id="fullName" name="fullName" defaultValue={initial?.fullName ?? ""} autoComplete="off" required maxLength={120} {...aria("fullName")} />
            </Field>
            <Field label="Preferred name" htmlFor="displayName" error={err("displayName")} hint="Optional. Used inside the admin system only.">
              <Input id="displayName" name="displayName" defaultValue={initial?.displayName ?? ""} maxLength={60} {...aria("displayName")} />
            </Field>
            <Field
              label="Employee ID"
              htmlFor="employeeNumber"
              error={err("employeeNumber")}
              hint={
                canSetNumber
                  ? mode === "create"
                    ? `Leave blank to assign ${nextNumberPreview ?? "the next number"} automatically.`
                    : "Changing an ID does not change cards already issued."
                  : "Assigned automatically."
              }
            >
              <Input
                id="employeeNumber"
                name="employeeNumber"
                defaultValue={initial?.employeeNumber ?? ""}
                placeholder={mode === "create" ? nextNumberPreview : undefined}
                readOnly={!canSetNumber}
                className="font-mono uppercase"
                maxLength={32}
                {...aria("employeeNumber")}
              />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Role" />
          <CardBody className="grid gap-5 sm:grid-cols-2">
            <Field label="Department" htmlFor="departmentId" error={err("departmentId")}>
              <Select id="departmentId" name="departmentId" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} {...aria("departmentId")}>
                <option value="">— Not set —</option>
                {departments
                  .filter((d) => d.active || d.id === initial?.departmentId)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                      {d.active ? "" : " (inactive)"}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Position / job title" htmlFor="positionId" error={err("positionId")}>
              <Select id="positionId" name="positionId" value={positionId} onChange={(e) => setPositionId(e.target.value)} {...aria("positionId")}>
                <option value="">— Not set —</option>
                {positionOptions.primary.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
                {positionOptions.other.length ? (
                  <optgroup label="Other departments">
                    {positionOptions.other.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </Select>
            </Field>
            <Field label="Employment status" htmlFor="employmentStatus" error={err("employmentStatus")} hint="Suspended or left immediately disables the active card.">
              <Select id="employmentStatus" name="employmentStatus" defaultValue={initial?.employmentStatus ?? "active"}>
                {EMPLOYMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {EMPLOYMENT_STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start date" htmlFor="startDate" error={err("startDate")}>
                <Input id="startDate" name="startDate" type="date" defaultValue={initial?.startDate ?? ""} {...aria("startDate")} />
              </Field>
              <Field label="End date" htmlFor="endDate" error={err("endDate")}>
                <Input id="endDate" name="endDate" type="date" defaultValue={initial?.endDate ?? ""} {...aria("endDate")} />
              </Field>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader title="Contact" description="Private - never shown on cards or verification." />
          <CardBody className="grid gap-5">
            <Field label="Work email" htmlFor="email" error={err("email")}>
              <Input id="email" name="email" type="email" defaultValue={initial?.email ?? ""} autoComplete="off" {...aria("email")} />
            </Field>
            <Field label="Phone" htmlFor="phone" error={err("phone")}>
              <Input id="phone" name="phone" type="tel" defaultValue={initial?.phone ?? ""} autoComplete="off" {...aria("phone")} />
            </Field>
            <Field label="Internal notes" htmlFor="notes" error={err("notes")}>
              <Textarea id="notes" name="notes" defaultValue={initial?.notes ?? ""} maxLength={2000} rows={4} />
            </Field>
          </CardBody>
        </Card>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end xl:flex-col-reverse xl:items-stretch">
          <Link href={initial?.id ? `/employees/${initial.id}` : "/employees"} className={buttonVariants({ variant: "outline" })}>
            Cancel
          </Link>
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            {mode === "create" ? "Create employee" : "Save changes"}
          </Button>
        </div>
      </div>
    </form>
  );
}
