import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarClock, CircleSlash, IdCard, Plus, UserPlus, Users, UserX } from "lucide-react";
import { EmployeeAvatar } from "@/components/employees/employee-avatar";
import { DemoBadge } from "@/components/cards/card-status-badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { AUDIT_ACTION_LABELS, type AuditAction } from "@/lib/audit";
import { requireUser } from "@/lib/auth/session";
import { daysUntilExpiry } from "@/lib/cards/status";
import { formatRelative, formatUkDate } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { getDashboardData } from "@/lib/services/dashboard";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

const WINDOWS = [30, 60, 90] as const;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ window?: string }> }) {
  const user = await requireUser();
  const { window } = await searchParams;
  const win = WINDOWS.find((w) => String(w) === window);
  const data = await getDashboardData(win);
  const { stats } = data;

  const kpis = [
    { label: "Active employees", value: stats.activeEmployees, sub: `${stats.totalEmployees} on record`, icon: Users, href: "/employees?status=active", tone: "navy" },
    { label: "Active ID cards", value: stats.activeCards, sub: "Currently valid", icon: IdCard, href: "/employees?card=active", tone: "green" },
    { label: "Expiring soon", value: stats.expiringSoon, sub: `Within ${data.windowDays} days`, icon: CalendarClock, href: "/employees?card=expiring", tone: "amber" },
    { label: "Expired cards", value: stats.expiredCards, sub: "Need renewal", icon: AlertTriangle, href: "/employees?card=expired", tone: "red" },
  ] as const;

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title={`Good ${greeting()}, ${user.fullName.split(" ")[0]}`}
        description="Live status of FXT staff and their identity cards."
        actions={
          can(user.role, "employees:write") ? (
            <>
              <LinkButton href="/employees/import" variant="outline">
                Import CSV
              </LinkButton>
              <LinkButton href="/employees/new">
                <Plus /> Add employee
              </LinkButton>
            </>
          ) : null
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k, i) => (
          <Link
            key={k.label}
            href={k.href}
            className="group relative animate-rise overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-pop"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="flex items-start justify-between">
              <p className="text-sm font-medium text-muted-foreground">{k.label}</p>
              <span
                className={cn(
                  "grid size-9 place-items-center rounded-xl [&_svg]:size-[18px]",
                  k.tone === "navy" && "bg-info-soft text-primary dark:text-ring",
                  k.tone === "green" && "bg-success-soft text-success",
                  k.tone === "amber" && "bg-warning-soft text-warning",
                  k.tone === "red" && "bg-danger-soft text-danger",
                )}
              >
                <k.icon aria-hidden />
              </span>
            </div>
            <p className="mt-3 text-3xl font-bold tracking-tight tabular-nums">{k.value}</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              {k.sub}
              <ArrowRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
            </p>
          </Link>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MiniStat href="/employees?card=none" icon={UserX} label="Employees without a card" value={stats.withoutCard} />
        <MiniStat href="/employees?card=inactive" icon={CircleSlash} label="Disabled, lost or revoked cards" value={stats.disabledCards} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader
            title="Cards expiring soon"
            description={`Active cards expiring in the next ${data.windowDays} days`}
            actions={
              <div className="flex rounded-lg border border-border p-0.5 text-xs font-semibold" role="group" aria-label="Expiry window">
                {WINDOWS.map((w) => (
                  <Link
                    key={w}
                    href={`/dashboard?window=${w}`}
                    aria-current={data.windowDays === w ? "true" : undefined}
                    className={cn("rounded-md px-2.5 py-1 text-muted-foreground hover:text-foreground", data.windowDays === w && "bg-muted text-foreground")}
                  >
                    {w}d
                  </Link>
                ))}
              </div>
            }
          />
          {data.expiring.length === 0 ? (
            <EmptyState icon={<CalendarClock />} title="Nothing expiring" description={`No active cards expire in the next ${data.windowDays} days.`} />
          ) : (
            <ul className="divide-y divide-border">
              {data.expiring.map((c) => {
                const days = daysUntilExpiry(c.expiresAt, data.today);
                return (
                  <li key={c.cardId}>
                    <Link href={`/employees/${c.employeeId}`} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/60">
                      <EmployeeAvatar employeeId={c.employeeId} name={c.fullName} hasPhoto={!!c.photoKey} version={c.photoUpdatedAt} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{c.fullName}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {c.employeeNumber} · {c.departmentName ?? "No department"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={cn("text-sm font-semibold tabular-nums", days <= 7 ? "text-danger" : "text-warning")}>
                          {days === 0 ? "Today" : `${days} day${days === 1 ? "" : "s"}`}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatUkDate(c.expiresAt)}</p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Recently added" actions={<LinkButton href="/employees?sort=created&dir=desc" variant="ghost" size="sm">View all</LinkButton>} />
          {data.recentEmployees.length === 0 ? (
            <EmptyState
              icon={<UserPlus />}
              title="No employees yet"
              description="Add your first employee to start issuing ID cards."
              action={can(user.role, "employees:write") ? <LinkButton href="/employees/new">Add employee</LinkButton> : null}
            />
          ) : (
            <ul className="divide-y divide-border">
              {data.recentEmployees.map((e) => (
                <li key={e.id}>
                  <Link href={`/employees/${e.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/60">
                    <EmployeeAvatar employeeId={e.id} name={e.fullName} hasPhoto={!!e.photoKey} version={e.photoUpdatedAt} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-sm font-semibold">
                        {e.fullName} {e.isDemo ? <DemoBadge /> : null}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{e.positionName ?? "No position"}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatRelative(e.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Recent card & employee activity"
          actions={can(user.role, "audit:read") ? <LinkButton href="/audit" variant="ghost" size="sm">Full audit log</LinkButton> : null}
        />
        {data.recentActivity.length === 0 ? (
          <EmptyState title="No activity yet" description="Actions like issuing or disabling cards will appear here." />
        ) : (
          <ol className="divide-y divide-border">
            {data.recentActivity.map((a) => (
              <li key={a.id} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:gap-4">
                <span className="w-40 shrink-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {AUDIT_ACTION_LABELS[a.action as AuditAction] ?? a.action}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{a.summary}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {a.actorEmail ?? "System"} · {formatRelative(a.createdAt)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </>
  );
}

function MiniStat({ href, icon: Icon, label, value }: { href: string; icon: typeof Users; label: string; value: number }) {
  return (
    <Link href={href} className="flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4 shadow-card hover:bg-muted/40">
      <span className="grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="flex-1 text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-2xl font-bold tabular-nums">{value}</span>
    </Link>
  );
}

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/London" }).format(new Date()));
  return h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
}
