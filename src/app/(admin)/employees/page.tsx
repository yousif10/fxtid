import type { Metadata } from "next";
import { Plus, Upload, Users } from "lucide-react";
import { EmployeeFilters } from "@/components/employees/employee-filters";
import { EmployeeTable } from "@/components/employees/employee-table";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Pagination } from "@/components/ui/pagination";
import { requirePagePermission } from "@/lib/auth/session";
import { todayIso } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { CARD_FILTERS, EMPLOYEE_SORTS, listCatalog, listEmployees, type EmployeeListParams } from "@/lib/services/employees";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Employees" };

type SP = Record<string, string | undefined>;
const STATUSES = ["current", "active", "on_leave", "suspended", "left", "archived"] as const;
const UUID = /^[0-9a-f-]{36}$/i;

function parseParams(sp: SP): EmployeeListParams {
  return {
    q: sp.q?.slice(0, 100),
    status: STATUSES.find((s) => s === sp.status),
    departmentId: sp.department && UUID.test(sp.department) ? sp.department : undefined,
    positionId: sp.position && UUID.test(sp.position) ? sp.position : undefined,
    card: CARD_FILTERS.find((c) => c === sp.card),
    sort: EMPLOYEE_SORTS.find((s) => s === sp.sort),
    dir: sp.dir === "desc" ? "desc" : "asc",
    page: Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1),
    pageSize: 20,
  };
}

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePagePermission("employees:read");
  const sp = await searchParams;
  const params = parseParams(sp);
  const [result, catalog, settings] = await Promise.all([listEmployees(params), listCatalog(), getSettings()]);
  const canWrite = can(user.role, "employees:write");

  const hrefFor = (page: number) => {
    const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
    qs.set("page", String(page));
    return `/employees?${qs}`;
  };
  const filtered = Boolean(params.q || params.departmentId || params.positionId || params.card || (params.status && params.status !== "current"));

  return (
    <>
      <PageHeader
        eyebrow="People"
        title="Employees"
        description="Search, filter and manage FXT staff records and their ID cards."
        actions={
          canWrite ? (
            <>
              {can(user.role, "employees:import") ? (
                <LinkButton href="/employees/import" variant="outline">
                  <Upload /> Import CSV
                </LinkButton>
              ) : null}
              <LinkButton href="/employees/new">
                <Plus /> Add employee
              </LinkButton>
            </>
          ) : null
        }
      />
      <Card>
        <EmployeeFilters
          departments={catalog.departments.map((d) => ({ id: d.id, name: d.name }))}
          positions={catalog.positions.map((p) => ({ id: p.id, name: p.name }))}
        />
        {result.rows.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title={filtered ? "No employees match your filters" : "No employees yet"}
            description={filtered ? "Try a different search or clear the filters." : "Add your first employee or import a CSV file."}
            action={
              filtered ? (
                <LinkButton href="/employees" variant="outline">
                  Clear filters
                </LinkButton>
              ) : canWrite ? (
                <LinkButton href="/employees/new">
                  <Plus /> Add employee
                </LinkButton>
              ) : null
            }
          />
        ) : (
          <>
            <EmployeeTable rows={result.rows} expiringSoonDays={settings.cards.expiringSoonDays} today={todayIso()} sort={params.sort ?? "name"} dir={params.dir ?? "asc"} searchParams={sp} />
            <div className="border-t border-border">
              <Pagination page={result.page} pageCount={result.pageCount} total={result.total} pageSize={result.pageSize} hrefFor={hrefFor} />
            </div>
          </>
        )}
      </Card>
    </>
  );
}
