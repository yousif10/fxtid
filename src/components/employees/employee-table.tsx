import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronRight } from "lucide-react";
import { CardStatusBadge, DemoBadge, EmploymentStatusBadge } from "@/components/cards/card-status-badge";
import { formatUkDate } from "@/lib/dates";
import type { EmployeeListRow, EmployeeSort } from "@/lib/services/employees";
import { cn } from "@/lib/utils";
import { EmployeeAvatar } from "./employee-avatar";

type Props = {
  rows: EmployeeListRow[];
  expiringSoonDays: number;
  today: string;
  sort: EmployeeSort;
  dir: "asc" | "desc";
  searchParams: Record<string, string | undefined>;
};

function SortHead({
  k,
  sort,
  dir,
  href,
  children,
  className,
}: {
  k: EmployeeSort;
  sort: EmployeeSort;
  dir: "asc" | "desc";
  href: (k: EmployeeSort) => string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th scope="col" className={cn("px-4 py-3 text-left", className)} aria-sort={sort === k ? (dir === "asc" ? "ascending" : "descending") : undefined}>
      <Link href={href(k)} className="inline-flex items-center gap-1 hover:text-foreground" scroll={false}>
        {children}
        {sort === k ? dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : null}
      </Link>
    </th>
  );
}

export function EmployeeTable({ rows, expiringSoonDays, today, sort, dir, searchParams }: Props) {
  const sortHref = (key: EmployeeSort) => {
    const qs = new URLSearchParams(Object.entries(searchParams).filter(([, v]) => v) as [string, string][]);
    qs.set("sort", key);
    qs.set("dir", sort === key && dir === "asc" ? "desc" : "asc");
    qs.delete("page");
    return `/employees?${qs}`;
  };
  const card = (r: EmployeeListRow) => (r.cardStatus && r.cardExpiresAt ? { status: r.cardStatus, expiresAt: r.cardExpiresAt } : null);

  return (
    <>
      {/* Desktop / tablet table */}
      <div className="relative hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <tr>
              <SortHead sort={sort} dir={dir} href={sortHref} k="name" className="pl-5">
                Employee
              </SortHead>
              <SortHead sort={sort} dir={dir} href={sortHref} k="number">ID</SortHead>
              <SortHead sort={sort} dir={dir} href={sortHref} k="department">Department / role</SortHead>
              <th scope="col" className="px-4 py-3 text-left">
                Card status
              </th>
              <SortHead sort={sort} dir={dir} href={sortHref} k="expiry">Expiry</SortHead>
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id} className="group relative transition-colors hover:bg-muted/50">
                <td className="py-3 pl-5 pr-4">
                  <div className="flex items-center gap-3">
                    <EmployeeAvatar employeeId={r.id} name={r.fullName} hasPhoto={!!r.photoKey} version={r.photoUpdatedAt} />
                    <div className="min-w-0">
                      <Link href={`/employees/${r.id}`} className="font-semibold text-foreground after:absolute after:inset-0 focus-visible:outline-none">
                        {r.fullName}
                      </Link>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <EmploymentStatusBadge status={r.employmentStatus} archived={!!r.archivedAt} />
                        {r.isDemo ? <DemoBadge /> : null}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-[13px] font-medium tabular-nums">{r.employeeNumber}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{r.departmentName ?? <span className="text-muted-foreground">—</span>}</div>
                  <div className="text-xs text-muted-foreground">{r.positionName ?? "No position"}</div>
                </td>
                <td className="px-4 py-3">
                  <CardStatusBadge card={card(r)} expiringSoonDays={expiringSoonDays} today={today} />
                </td>
                <td className="px-4 py-3 tabular-nums text-muted-foreground">{formatUkDate(r.cardExpiresAt)}</td>
                <td className="px-4 py-3 text-right">
                  <ChevronRight className="ml-auto size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="divide-y divide-border md:hidden">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/employees/${r.id}`} className="flex items-center gap-3 px-4 py-3.5 active:bg-muted">
              <EmployeeAvatar employeeId={r.id} name={r.fullName} hasPhoto={!!r.photoKey} version={r.photoUpdatedAt} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate font-semibold">
                  <span className="truncate">{r.fullName}</span>
                  {r.isDemo ? <DemoBadge /> : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  <span className="font-mono">{r.employeeNumber}</span> · {r.positionName ?? "No position"}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <CardStatusBadge card={card(r)} expiringSoonDays={expiringSoonDays} today={today} />
                  {r.cardExpiresAt ? <span className="text-xs text-muted-foreground">Exp. {formatUkDate(r.cardExpiresAt)}</span> : null}
                </div>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
