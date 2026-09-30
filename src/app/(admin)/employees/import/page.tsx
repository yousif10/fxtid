import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { requirePagePermission } from "@/lib/auth/session";
import { IMPORT_COLUMNS } from "@/lib/services/import";
import { ImportWizard } from "./import-wizard";

export const metadata: Metadata = { title: "Import employees" };

export default async function ImportPage() {
  await requirePagePermission("employees:import");
  return (
    <>
      <PageHeader
        eyebrow="Employees"
        title="Bulk import from CSV"
        description="Every row is validated first. The import only runs when the whole file is valid, so partial or corrupt data is never saved."
      />
      <ImportWizard columns={[...IMPORT_COLUMNS]} />
    </>
  );
}
