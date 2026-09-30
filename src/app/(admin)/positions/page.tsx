import type { Metadata } from "next";
import { CatalogManager } from "@/components/admin/catalog-manager";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { listDepartmentsWithCounts, listPositionsWithCounts } from "@/lib/services/catalog";
import { deletePositionAction, savePositionAction } from "../catalog-actions";

export const metadata: Metadata = { title: "Positions" };

export default async function PositionsPage() {
  const user = await requirePagePermission("employees:read");
  const [items, departments] = await Promise.all([listPositionsWithCounts(), listDepartmentsWithCounts()]);
  return (
    <>
      <PageHeader eyebrow="Organisation" title="Positions / job titles" description="Job titles printed on ID cards. Link a title to a department to make employee forms quicker." />
      <Card>
        <CatalogManager
          kind="position"
          items={items}
          departments={departments.filter((d) => d.active).map((d) => ({ id: d.id, name: d.name }))}
          canManage={can(user.role, "catalog:manage")}
          saveAction={savePositionAction}
          deleteAction={deletePositionAction}
        />
      </Card>
    </>
  );
}
