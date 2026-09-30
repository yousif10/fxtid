import "server-only";
import { and, asc, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { addDaysIso, todayIso } from "@/lib/dates";
import { db } from "@/lib/db";
import { auditLogs, departments, employeeCards, employees, positions } from "@/lib/db/schema";
import { getSettings } from "@/lib/settings";

export async function getDashboardData(expiringWindowDays?: number) {
  const settings = await getSettings();
  const today = todayIso();
  const windowDays = expiringWindowDays ?? settings.cards.expiringSoonDays;
  const soon = addDaysIso(today, windowDays);

  // Stats are computed on each current (non-archived) employee's latest card.
  const latest = db
    .selectDistinctOn([employeeCards.employeeId], {
      employeeId: employeeCards.employeeId,
      status: sql<string>`${employeeCards.status}`.as("l_status"),
      expiresAt: sql<string>`${employeeCards.expiresAt}::text`.as("l_expires"),
    })
    .from(employeeCards)
    .orderBy(employeeCards.employeeId, desc(employeeCards.version))
    .as("l");

  const [stats] = await db
    .select({
      totalEmployees: sql<number>`count(*)::int`,
      activeEmployees: sql<number>`count(*) filter (where ${employees.employmentStatus} = 'active')::int`,
      activeCards: sql<number>`count(*) filter (where ${latest.status} = 'active' and ${latest.expiresAt} >= ${today})::int`,
      expiringSoon: sql<number>`count(*) filter (where ${latest.status} = 'active' and ${latest.expiresAt} >= ${today} and ${latest.expiresAt} <= ${soon})::int`,
      expiredCards: sql<number>`count(*) filter (where (${latest.status} = 'active' and ${latest.expiresAt} < ${today}) or ${latest.status} = 'expired')::int`,
      disabledCards: sql<number>`count(*) filter (where ${latest.status} in ('disabled','lost','revoked'))::int`,
      withoutCard: sql<number>`count(*) filter (where ${latest.employeeId} is null)::int`,
    })
    .from(employees)
    .leftJoin(latest, eq(latest.employeeId, employees.id))
    .where(isNull(employees.archivedAt));

  const [expiring, recentEmployees, recentActivity] = await Promise.all([
    db
      .select({
        cardId: employeeCards.id,
        cardNumber: employeeCards.cardNumber,
        expiresAt: employeeCards.expiresAt,
        employeeId: employees.id,
        fullName: employees.fullName,
        employeeNumber: employees.employeeNumber,
        photoKey: employees.photoKey,
        photoUpdatedAt: employees.photoUpdatedAt,
        departmentName: departments.name,
      })
      .from(employeeCards)
      .innerJoin(employees, eq(employees.id, employeeCards.employeeId))
      .leftJoin(departments, eq(departments.id, employees.departmentId))
      .where(
        and(
          eq(employeeCards.status, "active"),
          gte(employeeCards.expiresAt, today),
          lte(employeeCards.expiresAt, soon),
          isNull(employees.archivedAt),
        ),
      )
      .orderBy(asc(employeeCards.expiresAt))
      .limit(8),
    db
      .select({
        id: employees.id,
        fullName: employees.fullName,
        employeeNumber: employees.employeeNumber,
        photoKey: employees.photoKey,
        photoUpdatedAt: employees.photoUpdatedAt,
        positionName: positions.name,
        createdAt: employees.createdAt,
        isDemo: employees.isDemo,
      })
      .from(employees)
      .leftJoin(positions, eq(positions.id, employees.positionId))
      .where(isNull(employees.archivedAt))
      .orderBy(desc(employees.createdAt))
      .limit(6),
    db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        summary: auditLogs.summary,
        actorEmail: auditLogs.actorEmail,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(sql`${auditLogs.entityType} in ('card','employee')`)
      .orderBy(desc(auditLogs.createdAt))
      .limit(8),
  ]);

  return { stats, expiring, recentEmployees, recentActivity, windowDays, today };
}
