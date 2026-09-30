import "server-only";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { audit } from "@/lib/audit";
import { addDaysIso, todayIso } from "@/lib/dates";
import { db, type Tx } from "@/lib/db";
import { isUniqueViolation, rowsOf } from "@/lib/db/errors";
import {
  departments,
  employeeCards,
  employees,
  positions,
} from "@/lib/db/schema";
import { deletePhotoFiles, storePhoto } from "@/lib/photos";
import { getSettings } from "@/lib/settings";
import type { EmployeeInput } from "@/lib/validation/employee";
import { DomainError, disableActiveCardsFor } from "./cards";

type Actor = { id: string; email: string };

/* ------------------------------------------------------------------ */
/* Employee numbers                                                    */
/* ------------------------------------------------------------------ */

/**
 * Next free employee number from a Postgres sequence (never reused, even after
 * deletions). Numbers that were taken manually are skipped automatically.
 */
export async function generateEmployeeNumber(
  tx: Tx,
  prefix: string,
  digits: number,
): Promise<string> {
  for (let i = 0; i < 1000; i++) {
    const [row] = rowsOf<{ v: string | number }>(
      await tx.execute(sql`select nextval('employee_number_seq') as v`),
    );
    const candidate = `${prefix}-${String(row.v).padStart(digits, "0")}`;
    const [taken] = await tx
      .select({ id: employees.id })
      .from(employees)
      .where(sql`upper(${employees.employeeNumber}) = ${candidate}`)
      .limit(1);
    if (!taken) return candidate;
  }
  throw new DomainError(
    "Could not allocate an employee number. Please try again.",
  );
}

export async function previewNextEmployeeNumber(): Promise<string> {
  const s = await getSettings();
  const [row] = rowsOf<{ v: string | number | null; called: boolean }>(
    await db.execute(
      sql`select last_value as v, is_called as called from employee_number_seq`,
    ),
  );
  const next = row ? Number(row.v) + (row.called ? 1 : 0) : 1;
  return `${s.cards.employeeNumberPrefix}-${String(next).padStart(s.cards.employeeNumberDigits, "0")}`;
}

async function assertCatalogRefs(
  tx: Tx,
  input: Pick<EmployeeInput, "departmentId" | "positionId">,
) {
  if (input.departmentId) {
    const [d] = await tx
      .select({ id: departments.id })
      .from(departments)
      .where(eq(departments.id, input.departmentId))
      .limit(1);
    if (!d)
      throw new DomainError(
        "Selected department does not exist.",
        "departmentId",
      );
  }
  if (input.positionId) {
    const [p] = await tx
      .select({ id: positions.id })
      .from(positions)
      .where(eq(positions.id, input.positionId))
      .limit(1);
    if (!p)
      throw new DomainError("Selected position does not exist.", "positionId");
  }
}

/* ------------------------------------------------------------------ */
/* Mutations                                                           */
/* ------------------------------------------------------------------ */

export async function createEmployee(
  actor: Actor,
  input: EmployeeInput,
  ip: string | null,
  opts: { allowManualNumber: boolean },
) {
  const settings = await getSettings();
  try {
    return await db.transaction(async (tx) => {
      await assertCatalogRefs(tx, input);
      let employeeNumber = input.employeeNumber?.trim().toUpperCase() || null;
      if (employeeNumber && !opts.allowManualNumber)
        throw new DomainError(
          "You are not allowed to set employee numbers manually.",
          "employeeNumber",
        );
      employeeNumber ??= await generateEmployeeNumber(
        tx,
        settings.cards.employeeNumberPrefix,
        settings.cards.employeeNumberDigits,
      );
      const [row] = await tx
        .insert(employees)
        .values({
          employeeNumber,
          fullName: input.fullName,
          displayName: input.displayName,
          email: input.email,
          phone: input.phone,
          departmentId: input.departmentId,
          positionId: input.positionId,
          employmentStatus: input.employmentStatus,
          startDate: input.startDate,
          endDate: input.endDate,
          notes: input.notes,
          createdBy: actor.id,
          updatedBy: actor.id,
        })
        .returning({
          id: employees.id,
          employeeNumber: employees.employeeNumber,
        });
      await audit(
        {
          actor,
          action: "employee.created",
          entityType: "employee",
          entityId: row.id,
          summary: `${input.fullName} (${row.employeeNumber})`,
          ip,
        },
        tx,
      );
      return row;
    });
  } catch (err) {
    if (isUniqueViolation(err))
      throw new DomainError(
        "That employee number is already in use.",
        "employeeNumber",
      );
    throw err;
  }
}

const TRACKED_FIELDS = [
  "employeeNumber",
  "fullName",
  "displayName",
  "email",
  "phone",
  "departmentId",
  "positionId",
  "employmentStatus",
  "startDate",
  "endDate",
  "notes",
] as const;

export async function updateEmployee(
  actor: Actor,
  id: string,
  input: EmployeeInput,
  ip: string | null,
  opts: { allowManualNumber: boolean },
) {
  try {
    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(employees)
        .where(eq(employees.id, id))
        .for("update")
        .limit(1);
      if (!existing) throw new DomainError("Employee not found.");
      await assertCatalogRefs(tx, input);
      const employeeNumber =
        input.employeeNumber?.trim().toUpperCase() || existing.employeeNumber;
      if (
        employeeNumber !== existing.employeeNumber &&
        !opts.allowManualNumber
      ) {
        throw new DomainError(
          "You are not allowed to change employee numbers.",
          "employeeNumber",
        );
      }
      const next = { ...input, employeeNumber };
      const changed = TRACKED_FIELDS.filter(
        (f) => (existing[f] ?? null) !== (next[f] ?? null),
      );
      await tx
        .update(employees)
        .set({ ...next, updatedBy: actor.id })
        .where(eq(employees.id, id));

      // Leaving / suspension immediately invalidates the active card.
      if (
        (next.employmentStatus === "left" ||
          next.employmentStatus === "suspended") &&
        existing.employmentStatus !== next.employmentStatus
      ) {
        await disableActiveCardsFor(
          tx,
          actor,
          id,
          `Employment status changed to ${next.employmentStatus}`,
        );
      }
      await audit(
        {
          actor,
          action: "employee.updated",
          entityType: "employee",
          entityId: id,
          summary: `${next.fullName} (${employeeNumber})`,
          // Field names only - values may contain personal data.
          metadata: { changedFields: changed },
          ip,
        },
        tx,
      );
      return { changed };
    });
  } catch (err) {
    if (isUniqueViolation(err))
      throw new DomainError(
        "That employee number is already in use.",
        "employeeNumber",
      );
    throw err;
  }
}

export async function setArchived(
  actor: Actor,
  id: string,
  archived: boolean,
  ip: string | null,
) {
  await db.transaction(async (tx) => {
    const [emp] = await tx
      .select()
      .from(employees)
      .where(eq(employees.id, id))
      .for("update")
      .limit(1);
    if (!emp) throw new DomainError("Employee not found.");
    await tx
      .update(employees)
      .set({ archivedAt: archived ? new Date() : null, updatedBy: actor.id })
      .where(eq(employees.id, id));
    if (archived)
      await disableActiveCardsFor(tx, actor, id, "Employee archived");
    await audit(
      {
        actor,
        action: archived ? "employee.archived" : "employee.restored",
        entityType: "employee",
        entityId: id,
        summary: `${emp.fullName} (${emp.employeeNumber})`,
        ip,
      },
      tx,
    );
  });
}

/** Hard delete is only allowed for employees who have never been issued a card. */
export async function deleteEmployee(
  actor: Actor,
  id: string,
  ip: string | null,
) {
  const photoKey = await db.transaction(async (tx) => {
    const [emp] = await tx
      .select()
      .from(employees)
      .where(eq(employees.id, id))
      .for("update")
      .limit(1);
    if (!emp) throw new DomainError("Employee not found.");
    const [{ n }] = await tx
      .select({ n: count() })
      .from(employeeCards)
      .where(eq(employeeCards.employeeId, id));
    if (n > 0)
      throw new DomainError(
        "This employee has card history and cannot be deleted. Archive them instead.",
      );
    await tx.delete(employees).where(eq(employees.id, id));
    await audit(
      {
        actor,
        action: "employee.deleted",
        entityType: "employee",
        entityId: id,
        summary: `${emp.fullName} (${emp.employeeNumber})`,
        ip,
      },
      tx,
    );
    return emp.photoKey;
  });
  if (photoKey) await deletePhotoFiles(photoKey).catch(() => undefined);
}

async function photoReferencedByCards(key: string): Promise<boolean> {
  const [row] = await db
    .select({ id: employeeCards.id })
    .from(employeeCards)
    .where(sql`${employeeCards.snapshot}->>'photoKey' = ${key}`)
    .limit(1);
  return !!row;
}

export async function setEmployeePhoto(
  actor: Actor,
  id: string,
  photo: { master: Buffer; thumb: Buffer } | null,
  ip: string | null,
) {
  const [emp] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, id))
    .limit(1);
  if (!emp) throw new DomainError("Employee not found.");
  const newKey = photo ? await storePhoto(photo) : null;
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(employees)
        .set({
          photoKey: newKey,
          photoUpdatedAt: newKey ? new Date() : null,
          updatedBy: actor.id,
        })
        .where(eq(employees.id, id));
      await audit(
        {
          actor,
          action: newKey ? "employee.photo_updated" : "employee.photo_removed",
          entityType: "employee",
          entityId: id,
          summary: `${emp.fullName} (${emp.employeeNumber})`,
          ip,
        },
        tx,
      );
    });
  } catch (err) {
    // The database still points at the previous photo: remove the orphaned new upload
    // and keep the existing photo untouched.
    if (newKey) await deletePhotoFiles(newKey).catch(() => undefined);
    throw err;
  }
  // Old photo files are kept while any issued card still references them (card history).
  // Deleted only after the database change has committed.
  if (
    emp.photoKey &&
    emp.photoKey !== newKey &&
    !(await photoReferencedByCards(emp.photoKey))
  ) {
    await deletePhotoFiles(emp.photoKey).catch(() => undefined);
  }
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export const EMPLOYEE_SORTS = [
  "name",
  "number",
  "department",
  "expiry",
  "created",
] as const;
export type EmployeeSort = (typeof EMPLOYEE_SORTS)[number];
export const CARD_FILTERS = [
  "active",
  "expiring",
  "expired",
  "inactive",
  "none",
] as const;
export type CardFilter = (typeof CARD_FILTERS)[number];

export type EmployeeListParams = {
  q?: string;
  status?:
    "active" | "on_leave" | "suspended" | "left" | "archived" | "current";
  departmentId?: string;
  positionId?: string;
  card?: CardFilter;
  sort?: EmployeeSort;
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export type EmployeeListRow = {
  id: string;
  employeeNumber: string;
  fullName: string;
  displayName: string | null;
  photoKey: string | null;
  photoUpdatedAt: Date | null;
  employmentStatus: "active" | "on_leave" | "suspended" | "left";
  archivedAt: Date | null;
  isDemo: boolean;
  departmentName: string | null;
  positionName: string | null;
  cardId: string | null;
  cardStatus:
    "active" | "expired" | "disabled" | "replaced" | "lost" | "revoked" | null;
  cardExpiresAt: string | null;
  cardNumber: string | null;
  createdAt: Date;
};

function latestCardSubquery() {
  return db
    .selectDistinctOn([employeeCards.employeeId], {
      employeeId: employeeCards.employeeId,
      cardId: sql<string>`${employeeCards.id}`.as("card_id"),
      cardStatus: sql<
        EmployeeListRow["cardStatus"]
      >`${employeeCards.status}`.as("card_status"),
      cardExpiresAt: sql<string>`${employeeCards.expiresAt}::text`.as(
        "card_expires_at",
      ),
      cardNumber: sql<string>`${employeeCards.cardNumber}`.as("card_number"),
    })
    .from(employeeCards)
    .orderBy(employeeCards.employeeId, desc(employeeCards.version))
    .as("latest_card");
}

export async function listEmployees(params: EmployeeListParams) {
  const settings = await getSettings();
  const today = todayIso();
  const soon = addDaysIso(today, settings.cards.expiringSoonDays);
  const latest = latestCardSubquery();
  const pageSize = Math.min(Math.max(params.pageSize ?? 20, 5), 100);
  const page = Math.max(params.page ?? 1, 1);

  const where: SQL[] = [];
  const q = params.q?.trim();
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    where.push(
      or(
        ilike(employees.fullName, like),
        ilike(employees.displayName, like),
        ilike(employees.employeeNumber, like),
        ilike(departments.name, like),
        ilike(positions.name, like),
        ilike(latest.cardNumber, like),
      )!,
    );
  }
  switch (params.status) {
    case "archived":
      where.push(isNotNull(employees.archivedAt));
      break;
    case undefined:
    case "current":
      where.push(isNull(employees.archivedAt));
      break;
    default:
      where.push(
        isNull(employees.archivedAt),
        eq(employees.employmentStatus, params.status),
      );
  }
  if (params.departmentId)
    where.push(eq(employees.departmentId, params.departmentId));
  if (params.positionId)
    where.push(eq(employees.positionId, params.positionId));
  switch (params.card) {
    case "none":
      where.push(isNull(latest.cardId));
      break;
    case "active":
      where.push(
        eq(latest.cardStatus, "active"),
        gte(latest.cardExpiresAt, today),
      );
      break;
    case "expiring":
      where.push(
        eq(latest.cardStatus, "active"),
        gte(latest.cardExpiresAt, today),
        lte(latest.cardExpiresAt, soon),
      );
      break;
    case "expired":
      where.push(
        or(
          and(eq(latest.cardStatus, "active"), lt(latest.cardExpiresAt, today)),
          eq(latest.cardStatus, "expired"),
        )!,
      );
      break;
    case "inactive":
      where.push(
        inArray(latest.cardStatus, ["disabled", "lost", "revoked", "replaced"]),
      );
      break;
  }

  const dir = params.dir === "desc" ? desc : asc;
  const orderBy = (() => {
    switch (params.sort) {
      case "number":
        return [dir(employees.employeeNumber)];
      case "department":
        return [dir(departments.name), asc(employees.fullName)];
      case "expiry":
        return [
          sql`${latest.cardExpiresAt} ${params.dir === "desc" ? sql`desc` : sql`asc`} nulls last`,
          asc(employees.fullName),
        ];
      case "created":
        return [dir(employees.createdAt)];
      default:
        return [dir(employees.fullName)];
    }
  })();

  const base = db
    .select({
      id: employees.id,
      employeeNumber: employees.employeeNumber,
      fullName: employees.fullName,
      displayName: employees.displayName,
      photoKey: employees.photoKey,
      photoUpdatedAt: employees.photoUpdatedAt,
      employmentStatus: employees.employmentStatus,
      archivedAt: employees.archivedAt,
      isDemo: employees.isDemo,
      departmentName: departments.name,
      positionName: positions.name,
      cardId: latest.cardId,
      cardStatus: latest.cardStatus,
      cardExpiresAt: latest.cardExpiresAt,
      cardNumber: latest.cardNumber,
      createdAt: employees.createdAt,
    })
    .from(employees)
    .leftJoin(departments, eq(departments.id, employees.departmentId))
    .leftJoin(positions, eq(positions.id, employees.positionId))
    .leftJoin(latest, eq(latest.employeeId, employees.id))
    .where(and(...where));

  const [rows, [{ total }]] = await Promise.all([
    base
      .orderBy(...orderBy)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ total: count() })
      .from(employees)
      .leftJoin(departments, eq(departments.id, employees.departmentId))
      .leftJoin(positions, eq(positions.id, employees.positionId))
      .leftJoin(latest, eq(latest.employeeId, employees.id))
      .where(and(...where)),
  ]);
  return {
    rows: rows as EmployeeListRow[],
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getEmployee(id: string) {
  const [row] = await db
    .select({
      employee: employees,
      departmentName: departments.name,
      positionName: positions.name,
    })
    .from(employees)
    .leftJoin(departments, eq(departments.id, employees.departmentId))
    .leftJoin(positions, eq(positions.id, employees.positionId))
    .where(eq(employees.id, id))
    .limit(1);
  if (!row) return null;
  return {
    ...row.employee,
    departmentName: row.departmentName,
    positionName: row.positionName,
  };
}
export type EmployeeDetail = NonNullable<
  Awaited<ReturnType<typeof getEmployee>>
>;

export async function listCatalog() {
  const [deps, pos] = await Promise.all([
    db
      .select()
      .from(departments)
      .orderBy(asc(departments.sortOrder), asc(departments.name)),
    db.select().from(positions).orderBy(asc(positions.name)),
  ]);
  return { departments: deps, positions: pos };
}
