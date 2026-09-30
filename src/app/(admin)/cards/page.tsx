import type { Metadata } from "next";
import Link from "next/link";
import { and, count, desc, eq, gte, ilike, inArray, lt, lte, or, sql, type SQL } from "drizzle-orm";
import { IdCard } from "lucide-react";
import { CardStatusBadge, DemoBadge, OrientationBadge } from "@/components/cards/card-status-badge";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Pagination } from "@/components/ui/pagination";
import { requirePagePermission } from "@/lib/auth/session";
import { templateDisplayName } from "@/lib/cards/templates";
import { addDaysIso, formatUkDate, todayIso } from "@/lib/dates";
import { db } from "@/lib/db";
import { cardTemplates, employeeCards, employees } from "@/lib/db/schema";
import { getSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "ID Cards" };

const FILTERS = [
  ["", "All cards"],
  ["valid", "Valid"],
  ["expiring", "Expiring soon"],
  ["expired", "Expired"],
  ["disabled", "Disabled"],
  ["lost", "Lost"],
  ["revoked", "Revoked"],
  ["replaced", "Replaced"],
] as const;

export default async function CardsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string; orientation?: string }> }) {
  await requirePagePermission("cards:read");
  const sp = await searchParams;
  const settings = await getSettings();
  const today = todayIso();
  const soon = addDaysIso(today, settings.cards.expiringSoonDays);
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const pageSize = 25;

  const where: SQL[] = [];
  switch (sp.status) {
    case "valid":
      where.push(eq(employeeCards.status, "active"), gte(employeeCards.expiresAt, today));
      break;
    case "expiring":
      where.push(eq(employeeCards.status, "active"), gte(employeeCards.expiresAt, today), lte(employeeCards.expiresAt, soon));
      break;
    case "expired":
      where.push(or(and(eq(employeeCards.status, "active"), lt(employeeCards.expiresAt, today)), eq(employeeCards.status, "expired"))!);
      break;
    case "disabled":
    case "lost":
    case "revoked":
    case "replaced":
      where.push(inArray(employeeCards.status, [sp.status]));
      break;
  }
  if (sp.orientation === "portrait" || sp.orientation === "landscape") where.push(eq(employeeCards.orientation, sp.orientation));
  const q = sp.q?.trim().slice(0, 100);
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    where.push(or(ilike(employeeCards.cardNumber, like), ilike(employees.fullName, like), ilike(employees.employeeNumber, like))!);
  }

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: employeeCards.id,
        cardNumber: employeeCards.cardNumber,
        status: employeeCards.status,
        issuedAt: employeeCards.issuedAt,
        expiresAt: employeeCards.expiresAt,
        version: employeeCards.version,
        employeeId: employees.id,
        fullName: sql<string>`${employeeCards.snapshot}->>'fullName'`,
        employeeNumber: employees.employeeNumber,
        isDemo: employees.isDemo,
        templateName: cardTemplates.name,
        orientation: employeeCards.orientation,
      })
      .from(employeeCards)
      .innerJoin(employees, eq(employees.id, employeeCards.employeeId))
      .leftJoin(cardTemplates, eq(cardTemplates.id, employeeCards.templateId))
      .where(and(...where))
      .orderBy(desc(employeeCards.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ total: count() })
      .from(employeeCards)
      .innerJoin(employees, eq(employees.id, employeeCards.employeeId))
      .where(and(...where)),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/cards?${p}`;
  };

  return (
    <>
      <PageHeader eyebrow="Cards" title="ID Cards" description="Every card ever issued, including replaced and deactivated cards." />
      <Card>
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center">
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:pb-0" role="tablist" aria-label="Filter by status">
            {FILTERS.map(([value, label]) => (
              <Link
                key={value}
                href={qs({ status: value || undefined, page: undefined })}
                role="tab"
                aria-selected={(sp.status ?? "") === value}
                className={cn(
                  "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
                  (sp.status ?? "") === value && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                )}
              >
                {label}
              </Link>
            ))}
          </div>
          <div className="flex gap-1 rounded-lg border border-border p-0.5 text-xs font-semibold lg:ml-auto" role="group" aria-label="Filter by orientation">
            {(
              [
                ["", "Any"],
                ["portrait", "Portrait"],
                ["landscape", "Landscape"],
              ] as const
            ).map(([value, label]) => (
              <Link
                key={value}
                href={qs({ orientation: value || undefined, page: undefined })}
                aria-current={(sp.orientation ?? "") === value ? "true" : undefined}
                className={cn("rounded-md px-2.5 py-1 text-muted-foreground hover:text-foreground", (sp.orientation ?? "") === value && "bg-muted text-foreground")}
              >
                {label}
              </Link>
            ))}
          </div>
          <form role="search">
            {sp.status ? <input type="hidden" name="status" value={sp.status} /> : null}
            {sp.orientation ? <input type="hidden" name="orientation" value={sp.orientation} /> : null}
            <label htmlFor="card-search" className="sr-only">
              Search cards
            </label>
            <input
              id="card-search"
              name="q"
              defaultValue={q}
              type="search"
              placeholder="Card no., name or employee ID"
              className="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm lg:w-72"
            />
          </form>
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={<IdCard />} title="No cards found" description="Cards are issued from an employee's record." />
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th scope="col" className="px-5 py-3">Card number</th>
                  <th scope="col" className="px-4 py-3">Employee</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Issued</th>
                  <th scope="col" className="px-4 py-3">Expires</th>
                  <th scope="col" className="px-4 py-3">Design</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.id} className="relative hover:bg-muted/40">
                    <td className="px-5 py-3">
                      <Link href={`/cards/${r.id}`} className="font-mono font-semibold after:absolute after:inset-0">
                        {r.cardNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 font-medium">
                        {r.fullName} {r.isDemo ? <DemoBadge /> : null}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">{r.employeeNumber}</div>
                    </td>
                    <td className="px-4 py-3">
                      <CardStatusBadge card={r} expiringSoonDays={settings.cards.expiringSoonDays} today={today} />
                    </td>
                    <td className="px-4 py-3 tabular-nums">{formatUkDate(r.issuedAt)}</td>
                    <td className="px-4 py-3 tabular-nums">{formatUkDate(r.expiresAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <OrientationBadge orientation={r.orientation} />
                        <span className="text-xs text-muted-foreground">{templateDisplayName(r.templateName, r.orientation)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-border">
          <Pagination page={page} pageCount={pageCount} total={total} pageSize={pageSize} hrefFor={(p) => qs({ page: String(p) })} />
        </div>
      </Card>
    </>
  );
}
