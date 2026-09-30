import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { Download, Eye, FileText, History, IdCard, Pencil, Printer, ShieldAlert } from "lucide-react";
import { CardPair } from "@/components/cards/card-artwork";
import { CardStatusBadge, DemoBadge, EmploymentStatusBadge, OrientationBadge } from "@/components/cards/card-status-badge";
import { CardStatusDialog, ReactivateCardDialog } from "@/components/cards/card-status-dialog";
import { IssueCardDialog } from "@/components/cards/issue-card-dialog";
import { EmployeeDangerActions } from "@/components/employees/employee-danger-actions";
import { PhotoManager } from "@/components/employees/photo-manager";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DescriptionList, EmptyState } from "@/components/ui/misc";
import { AUDIT_ACTION_LABELS, type AuditAction } from "@/lib/audit";
import { requirePagePermission } from "@/lib/auth/session";
import { effectiveCardStatus, ISSUE_REASON_LABELS } from "@/lib/cards/status";
import { templateDisplayName } from "@/lib/cards/templates";
import { formatDateTime, formatRelative, formatUkDate, todayIso } from "@/lib/dates";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { UUID_RE } from "@/lib/http";
import { can } from "@/lib/permissions";
import { buildCardSvg } from "@/lib/services/card-artwork";
import { getCard, getEmployeeCards } from "@/lib/services/cards";
import { getEmployee } from "@/lib/services/employees";
import { listTemplates } from "@/lib/services/templates";
import { getSettings } from "@/lib/settings";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const emp = UUID_RE.test(id) ? await getEmployee(id) : null;
  return { title: emp ? emp.fullName : "Employee" };
}

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission("employees:read");
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const emp = await getEmployee(id);
  if (!emp) notFound();

  const [cards, settings, templates] = await Promise.all([getEmployeeCards(id), getSettings(), listTemplates()]);
  const today = todayIso();
  const current = cards.find((c) => c.status === "active") ?? cards[0] ?? null;
  const currentFull = current ? await getCard(current.id) : null;
  const [front, back] = currentFull
    ? await Promise.all([buildCardSvg(currentFull, "front", "preview"), buildCardSvg(currentFull, "back", "preview")])
    : [null, null];
  const cardIds = cards.map((c) => c.id);
  const activity = await db
    .select()
    .from(auditLogs)
    .where(
      or(
        and(eq(auditLogs.entityType, "employee"), eq(auditLogs.entityId, id)),
        cardIds.length ? and(eq(auditLogs.entityType, "card"), inArray(auditLogs.entityId, cardIds)) : undefined,
      ),
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(12);

  const canWrite = can(user.role, "employees:write");
  const canIssue = can(user.role, "cards:issue");
  const canManage = can(user.role, "cards:manage");
  const archived = !!emp.archivedAt;
  const issueBlock = archived
    ? "Restore the employee to issue a card"
    : emp.employmentStatus === "left" || emp.employmentStatus === "suspended"
      ? "Employee is not active"
      : settings.cards.requirePhotoForIssue && !emp.photoKey
        ? "Upload a photo first"
        : null;
  const hasActiveCard = !!current && current.status === "active";

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <nav aria-label="Breadcrumb" className="mb-2 text-sm text-muted-foreground">
            <Link href="/employees" className="hover:text-foreground">
              Employees
            </Link>{" "}
            / <span className="font-mono">{emp.employeeNumber}</span>
          </nav>
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-bold tracking-tight sm:text-[28px]">
            {emp.fullName}
            <EmploymentStatusBadge status={emp.employmentStatus} archived={archived} />
            {emp.isDemo ? <DemoBadge /> : null}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {[emp.positionName, emp.departmentName].filter(Boolean).join(" · ") || "No role assigned"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canWrite ? (
            <LinkButton href={`/employees/${id}/edit`} variant="outline">
              <Pencil /> Edit
            </LinkButton>
          ) : null}
          <EmployeeDangerActions
            employeeId={id}
            name={emp.fullName}
            archived={archived}
            canArchive={canWrite}
            canDelete={can(user.role, "employees:delete")}
            hasCards={cards.length > 0}
          />
        </div>
      </div>

      {archived ? (
        <div role="status" className="mb-6 flex items-center gap-3 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
          <ShieldAlert className="size-5 shrink-0" /> This employee was archived on {formatDateTime(emp.archivedAt)}. Their cards no longer verify as valid.
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] xl:grid-cols-[19rem_minmax(0,1fr)]">
        {/* Left column */}
        <div className="space-y-6">
          <Card>
            <CardBody>
              <PhotoManager employeeId={id} name={emp.fullName} hasPhoto={!!emp.photoKey} version={emp.photoUpdatedAt} canEdit={canWrite} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Employee details" />
            <CardBody>
              <DescriptionList
                className="lg:grid-cols-1 xl:grid-cols-2"
                items={[
                  { label: "Employee ID", value: <span className="font-mono">{emp.employeeNumber}</span> },
                  { label: "Preferred name", value: emp.displayName ?? "—" },
                  { label: "Department", value: emp.departmentName ?? "—" },
                  { label: "Position", value: emp.positionName ?? "—" },
                  { label: "Start date", value: formatUkDate(emp.startDate) },
                  { label: "End date", value: formatUkDate(emp.endDate) },
                  { label: "Work email", value: emp.email ?? "—" },
                  { label: "Phone", value: emp.phone ?? "—" },
                ]}
              />
              {emp.notes ? (
                <div className="mt-5 rounded-lg bg-muted p-3 text-sm">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Internal notes</p>
                  <p className="whitespace-pre-wrap">{emp.notes}</p>
                </div>
              ) : null}
              <p className="mt-5 text-xs text-muted-foreground">
                Created {formatDateTime(emp.createdAt)} · Updated {formatRelative(emp.updatedAt)}
              </p>
            </CardBody>
          </Card>
        </div>

        {/* Right column */}
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader
              title={hasActiveCard ? "Current ID card" : current ? "Most recent card" : "ID card"}
              description={
                currentFull ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-mono">{currentFull.cardNumber}</span>
                    <CardStatusBadge card={currentFull} expiringSoonDays={settings.cards.expiringSoonDays} today={today} />
                    <OrientationBadge orientation={currentFull.orientation} />
                    <span>{templateDisplayName(currentFull.templateName, currentFull.orientation)}</span>
                    <span>· Expires {formatUkDate(currentFull.expiresAt)}</span>
                  </span>
                ) : (
                  "No card has been issued yet."
                )
              }
              actions={
                canIssue ? (
                  <IssueCardDialog
                    employeeId={id}
                    hasActiveCard={hasActiveCard}
                    hasAnyCard={cards.length > 0}
                    templates={templates
                      .filter((t) => t.active)
                      .map((t) => ({ id: t.id, name: t.name, isDefault: t.isDefault, layout: t.layout, orientation: t.orientation, config: t.config }))}
                    defaultTemplateId={currentFull?.templateId ?? templates.find((t) => t.isDefault)?.id ?? null}
                    preview={{
                      fullName: emp.fullName,
                      positionName: emp.positionName,
                      departmentName: emp.departmentName,
                      employeeNumber: emp.employeeNumber,
                      photoUrl: emp.photoKey ? `/api/employees/${id}/photo?variant=full&v=${emp.photoUpdatedAt ? new Date(emp.photoUpdatedAt).getTime() : 0}` : null,
                      company: settings.company,
                      colors: { primary: settings.branding.primaryColor, secondary: settings.branding.secondaryColor, accent: settings.branding.accentColor },
                      today,
                    }}
                    defaultValidityMonths={settings.cards.defaultValidityMonths}
                    disabledReason={issueBlock}
                  />
                ) : null
              }
            />
            {currentFull && front && back ? (
              <CardBody>
                <CardPair front={front} back={back} orientation={currentFull.orientation} />
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  <LinkButton href={`/cards/${currentFull.id}`}>
                    <Eye /> Open preview
                  </LinkButton>
                  <LinkButton href={`/print/cards/${currentFull.id}?side=both`} variant="outline" target="_blank">
                    <Printer /> Print
                  </LinkButton>
                  <a className="inline-flex h-10 items-center gap-2 rounded-lg border border-input bg-card px-4 text-sm font-semibold hover:bg-muted" href={`/api/cards/${currentFull.id}/export?format=pdf&side=both`}>
                    <FileText className="size-4" /> PDF
                  </a>
                  <a className="inline-flex h-10 items-center gap-2 rounded-lg border border-input bg-card px-4 text-sm font-semibold hover:bg-muted" href={`/api/cards/${currentFull.id}/export?format=png&side=front`}>
                    <Download className="size-4" /> PNG
                  </a>
                  {canManage && effectiveCardStatus(currentFull, today) === "active" ? <CardStatusDialog cardId={currentFull.id} cardNumber={currentFull.cardNumber} /> : null}
                  {canManage && currentFull.status === "disabled" ? <ReactivateCardDialog cardId={currentFull.id} cardNumber={currentFull.cardNumber} /> : null}
                </div>
              </CardBody>
            ) : (
              <EmptyState
                icon={<IdCard />}
                title="No ID card yet"
                description={issueBlock ?? "Generate a card to print it and enable QR verification."}
              />
            )}
          </Card>

          <Card>
            <CardHeader title="Card history" description="Every card ever issued to this employee is retained." />
            {cards.length === 0 ? (
              <EmptyState icon={<History />} title="No cards issued" className="py-10" />
            ) : (
              <div className="relative overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-5 py-3">Card</th>
                      <th scope="col" className="px-4 py-3">Status</th>
                      <th scope="col" className="px-4 py-3">Issued</th>
                      <th scope="col" className="px-4 py-3">Expires</th>
                      <th scope="col" className="px-4 py-3">Reason</th>
                      <th scope="col" className="px-4 py-3"><span className="sr-only">Open</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {cards.map((c) => (
                      <tr key={c.id} className="hover:bg-muted/40">
                        <td className="px-5 py-3">
                          <div className="font-mono font-medium">{c.cardNumber}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            <OrientationBadge orientation={c.orientation} />
                            <span>
                              v{c.version} · {templateDisplayName(c.templateName, c.orientation)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <CardStatusBadge card={c} expiringSoonDays={settings.cards.expiringSoonDays} today={today} />
                          {c.statusReason ? <div className="mt-1 max-w-[14rem] truncate text-xs text-muted-foreground" title={c.statusReason}>{c.statusReason}</div> : null}
                        </td>
                        <td className="px-4 py-3 tabular-nums">{formatUkDate(c.issuedAt)}</td>
                        <td className="px-4 py-3 tabular-nums">{formatUkDate(c.expiresAt)}</td>
                        <td className="px-4 py-3">
                          <Badge tone="neutral">{ISSUE_REASON_LABELS[c.issueReason]}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/cards/${c.id}`} className="text-sm font-semibold text-primary hover:underline dark:text-ring">
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Activity" />
            {activity.length === 0 ? (
              <EmptyState title="No activity recorded" className="py-10" />
            ) : (
              <ol className="relative space-y-4 p-5">
                {activity.map((a) => (
                  <li key={a.id} className="flex gap-3">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {AUDIT_ACTION_LABELS[a.action as AuditAction] ?? a.action}
                        {a.entityType === "card" && a.summary ? <span className="font-normal text-muted-foreground"> — {a.summary}</span> : null}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {a.actorEmail ?? "System"} · {formatDateTime(a.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
