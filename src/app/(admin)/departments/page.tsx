import type { Metadata } from "next";
import { CatalogManager } from "@/components/admin/catalog-manager";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { listDepartmentsWithCounts } from "@/lib/services/catalog";
import { deleteDepartmentAction, saveDepartmentAction } from "../catalog-actions";

export const metadata: Metadata = { title: "Departments" };

export default async function DepartmentsPage() {
  const user = await requirePagePermission("employees:read");
  const items = await listDepartmentsWithCounts();
  return (
    <>
      <PageHeader eyebrow="Organisation" title="Departments" description="Configurable departments printed on ID cards. Deactivate departments that are no longer used." />
      <Card>
        <CatalogManager kind="department" items={items} canManage={can(user.role, "catalog:manage")} saveAction={saveDepartmentAction} deleteAction={deleteDepartmentAction} />
      </Card>
    </>
  );
}
