import type { Metadata } from "next";
import { EmployeeForm } from "@/components/employees/employee-form";
import { PageHeader } from "@/components/ui/misc";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { listCatalog, previewNextEmployeeNumber } from "@/lib/services/employees";

export const metadata: Metadata = { title: "Add employee" };

export default async function NewEmployeePage() {
  const user = await requirePagePermission("employees:write");
  const [catalog, nextNumber] = await Promise.all([listCatalog(), previewNextEmployeeNumber()]);
  return (
    <>
      <PageHeader eyebrow="Employees" title="Add employee" description="Create the staff record first, then upload a photo and issue their ID card." />
      <EmployeeForm
        mode="create"
        departments={catalog.departments}
        positions={catalog.positions}
        canSetNumber={can(user.role, "employees:set_number")}
        nextNumberPreview={nextNumber}
      />
    </>
  );
}
