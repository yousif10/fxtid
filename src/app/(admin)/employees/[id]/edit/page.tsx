import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmployeeForm } from "@/components/employees/employee-form";
import { PageHeader } from "@/components/ui/misc";
import { requirePagePermission } from "@/lib/auth/session";
import { UUID_RE } from "@/lib/http";
import { can } from "@/lib/permissions";
import { getEmployee, listCatalog } from "@/lib/services/employees";

export const metadata: Metadata = { title: "Edit employee" };

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission("employees:write");
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const [emp, catalog] = await Promise.all([getEmployee(id), listCatalog()]);
  if (!emp) notFound();
  return (
    <>
      <PageHeader eyebrow={emp.employeeNumber} title={`Edit ${emp.fullName}`} description="Changes apply to the staff record. Issued cards keep the details printed at the time of issue." />
      <EmployeeForm mode="edit" initial={emp} departments={catalog.departments} positions={catalog.positions} canSetNumber={can(user.role, "employees:set_number")} />
    </>
  );
}
