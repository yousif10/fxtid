import type { Metadata } from "next";
import Link from "next/link";
import { and, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Pagination } from "@/components/ui/pagination";
import { AUDIT_ACTION_LABELS, type AuditAction } from "@/lib/audit";
import { requirePagePermission } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/dates";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";

export const metadata: Metadata = { title: "Audit log" };

const ENTITY_TYPES = ["employee", "card", "user", "department", "position", "template", "settings", "auth"] as const;

function entityHref(type: string, id: string | null) {
  if (!id) return null;
  if (type === "employee") return `/employees/${id}`;
  if (type === "card") return `/cards/${id}`;
  return null;
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ type?: string; q?: string; page?: string }> }) {
  await requirePagePermission("audit:read");
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const pageSize = 40;
  const where: SQL[] = [];
  const type = ENTITY_TYPES.find((t) => t === sp.type);
  if (type) where.push(eq(auditLogs.entityType, type));
  const q = sp.q?.trim().slice(0, 100);
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    where.push(or(ilike(auditLogs.summary, like), ilike(auditLogs.actorEmail, like), ilike(auditLogs.action, like))!);
  }
  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(auditLogs)
      .where(and(...where))
      .orderBy(desc(auditLogs.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(auditLogs).where(and(...where)),
  ]);
  const href = (p: number) => {
    const qs = new URLSearchParams(Object.entries({ ...sp, page: String(p) }).filter(([, v]) => v) as [string, string][]);
    return `/audit?${qs}`;
  };

  return (
    <>
      <PageHeader eyebrow="Security" title="Audit log" description="Append-only record of administrative actions. Entries cannot be edited." />
      <Card>
        <form className="flex flex-col gap-2 border-b border-border p-4 sm:flex-row">
          <label htmlFor="audit-q" className="sr-only">
            Search
          </label>
          <input id="audit-q" name="q" defaultValue={q} type="search" placeholder="Search summary, user or action" className="h-10 flex-1 rounded-lg border border-input bg-card px-3 text-sm" />
          <Select name="type" defaultValue={type ?? ""} aria-label="Entity type" className="sm:w-48">
            <option value="">All entities</option>
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t[0].toUpperCase() + t.slice(1)}
              </option>
            ))}
          </Select>
          <button type="submit" className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">
            Filter
          </button>
        </form>
        {rows.length === 0 ? (
          <EmptyState icon={<ScrollText />} title="No entries" />
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th scope="col" className="px-5 py-3">When</th>
                  <th scope="col" className="px-4 py-3">User</th>
                  <th scope="col" className="px-4 py-3">Action</th>
                  <th scope="col" className="px-4 py-3">Details</th>
                  <th scope="col" className="px-4 py-3">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => {
                  const link = entityHref(r.entityType, r.entityId);
                  const meta = r.metadata as Record<string, unknown>;
                  const changed = Array.isArray(meta?.changedFields) ? (meta.changedFields as string[]) : null;
                  return (
                    <tr key={r.id} className="align-top hover:bg-muted/40">
                      <td className="whitespace-nowrap px-5 py-3 tabular-nums text-muted-foreground">{formatDateTime(r.createdAt)}</td>
                      <td className="px-4 py-3">{r.actorEmail ?? <span className="text-muted-foreground">System</span>}</td>
                      <td className="px-4 py-3">
                        <Badge tone={r.action.includes("failed") || r.action.includes("deleted") ? "danger" : r.action.startsWith("card") ? "info" : "neutral"}>
                          {AUDIT_ACTION_LABELS[r.action as AuditAction] ?? r.action}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {link ? (
                          <Link href={link} className="font-medium hover:underline">
                            {r.summary ?? r.entityId}
                          </Link>
                        ) : (
                          <span>{r.summary ?? "—"}</span>
                        )}
                        {changed?.length ? <div className="mt-0.5 text-xs text-muted-foreground">Changed: {changed.join(", ")}</div> : null}
                        {typeof meta?.reason === "string" ? <div className="mt-0.5 text-xs text-muted-foreground">Reason: {meta.reason}</div> : null}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.ipAddress ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-border">
          <Pagination page={page} pageCount={Math.max(1, Math.ceil(total / pageSize))} total={total} pageSize={pageSize} hrefFor={href} />
        </div>
      </Card>
    </>
  );
}
