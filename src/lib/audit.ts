import "server-only";
import { db, type Database, type Tx } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";

export type AuditAction =
  | "auth.login"
  | "auth.login_failed"
  | "auth.logout"
  | "auth.password_changed"
  | "user.created"
  | "user.updated"
  | "user.password_reset"
  | "employee.created"
  | "employee.updated"
  | "employee.photo_updated"
  | "employee.photo_removed"
  | "employee.archived"
  | "employee.restored"
  | "employee.deleted"
  | "employee.imported"
  | "card.issued"
  | "card.status_changed"
  | "card.reactivated"
  | "card.exported"
  | "department.created"
  | "department.updated"
  | "department.deleted"
  | "position.created"
  | "position.updated"
  | "position.deleted"
  | "template.created"
  | "template.updated"
  | "settings.updated";

export type AuditEntry = {
  actor: { id: string; email: string } | null;
  action: AuditAction;
  entityType: "user" | "employee" | "card" | "department" | "position" | "template" | "settings" | "auth";
  entityId?: string | null;
  summary?: string;
  /** Safe metadata only - never passwords, tokens or full personal records. */
  metadata?: Record<string, unknown>;
  ip?: string | null;
};

export async function audit(entry: AuditEntry, conn: Database | Tx = db): Promise<void> {
  await conn.insert(auditLogs).values({
    actorId: entry.actor?.id ?? null,
    actorEmail: entry.actor?.email ?? null,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    summary: entry.summary ?? null,
    metadata: entry.metadata ?? {},
    ipAddress: entry.ip ?? null,
  });
}

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  "auth.login": "Signed in",
  "auth.login_failed": "Failed sign-in",
  "auth.logout": "Signed out",
  "auth.password_changed": "Password changed",
  "user.created": "Administrator created",
  "user.updated": "Administrator updated",
  "user.password_reset": "Administrator password reset",
  "employee.created": "Employee created",
  "employee.updated": "Employee edited",
  "employee.photo_updated": "Photo updated",
  "employee.photo_removed": "Photo removed",
  "employee.archived": "Employee archived",
  "employee.restored": "Employee restored",
  "employee.deleted": "Employee deleted",
  "employee.imported": "Employees imported",
  "card.issued": "Card issued",
  "card.status_changed": "Card status changed",
  "card.reactivated": "Card reactivated",
  "card.exported": "Card exported",
  "department.created": "Department created",
  "department.updated": "Department updated",
  "department.deleted": "Department deleted",
  "position.created": "Position created",
  "position.updated": "Position updated",
  "position.deleted": "Position deleted",
  "template.created": "Template created",
  "template.updated": "Template updated",
  "settings.updated": "Settings changed",
};
