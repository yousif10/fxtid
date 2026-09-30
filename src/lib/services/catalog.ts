import "server-only";
import { asc, count, eq, sql } from "drizzle-orm";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/db/errors";
import { departments, employees, positions } from "@/lib/db/schema";
import type { DepartmentInput, PositionInput } from "@/lib/validation/catalog";
import { DomainError } from "./cards";

type Actor = { id: string; email: string };

export async function listDepartmentsWithCounts() {
  return db
    .select({
      id: departments.id,
      name: departments.name,
      description: departments.description,
      active: departments.active,
      sortOrder: departments.sortOrder,
      employeeCount: sql<number>`(select count(*)::int from ${employees} where ${employees.departmentId} = ${departments.id} and ${employees.archivedAt} is null)`,
    })
    .from(departments)
    .orderBy(asc(departments.sortOrder), asc(departments.name));
}

export async function listPositionsWithCounts() {
  return db
    .select({
      id: positions.id,
      name: positions.name,
      description: positions.description,
      active: positions.active,
      departmentId: positions.departmentId,
      departmentName: departments.name,
      employeeCount: sql<number>`(select count(*)::int from ${employees} where ${employees.positionId} = ${positions.id} and ${employees.archivedAt} is null)`,
    })
    .from(positions)
    .leftJoin(departments, eq(departments.id, positions.departmentId))
    .orderBy(asc(positions.name));
}

export async function saveDepartment(actor: Actor, id: string | null, input: DepartmentInput, ip: string | null) {
  try {
    return await db.transaction(async (tx) => {
      if (id) {
        const [row] = await tx.update(departments).set(input).where(eq(departments.id, id)).returning({ id: departments.id });
        if (!row) throw new DomainError("Department not found.");
        await audit({ actor, action: "department.updated", entityType: "department", entityId: id, summary: input.name, ip }, tx);
        return row;
      }
      const [row] = await tx.insert(departments).values(input).returning({ id: departments.id });
      await audit({ actor, action: "department.created", entityType: "department", entityId: row.id, summary: input.name, ip }, tx);
      return row;
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new DomainError("A department with this name already exists.", "name");
    throw err;
  }
}

export async function deleteDepartment(actor: Actor, id: string, ip: string | null) {
  await db.transaction(async (tx) => {
    const [{ n }] = await tx.select({ n: count() }).from(employees).where(eq(employees.departmentId, id));
    if (n > 0) throw new DomainError("This department is assigned to employees. Deactivate it instead of deleting.");
    const [row] = await tx.delete(departments).where(eq(departments.id, id)).returning({ name: departments.name });
    if (!row) throw new DomainError("Department not found.");
    await audit({ actor, action: "department.deleted", entityType: "department", entityId: id, summary: row.name, ip }, tx);
  });
}

export async function savePosition(actor: Actor, id: string | null, input: PositionInput, ip: string | null) {
  try {
    return await db.transaction(async (tx) => {
      if (input.departmentId) {
        const [d] = await tx.select({ id: departments.id }).from(departments).where(eq(departments.id, input.departmentId)).limit(1);
        if (!d) throw new DomainError("Selected department does not exist.", "departmentId");
      }
      if (id) {
        const [row] = await tx.update(positions).set(input).where(eq(positions.id, id)).returning({ id: positions.id });
        if (!row) throw new DomainError("Position not found.");
        await audit({ actor, action: "position.updated", entityType: "position", entityId: id, summary: input.name, ip }, tx);
        return row;
      }
      const [row] = await tx.insert(positions).values(input).returning({ id: positions.id });
      await audit({ actor, action: "position.created", entityType: "position", entityId: row.id, summary: input.name, ip }, tx);
      return row;
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new DomainError("A position with this name already exists.", "name");
    throw err;
  }
}

export async function deletePosition(actor: Actor, id: string, ip: string | null) {
  await db.transaction(async (tx) => {
    const [{ n }] = await tx.select({ n: count() }).from(employees).where(eq(employees.positionId, id));
    if (n > 0) throw new DomainError("This position is assigned to employees. Deactivate it instead of deleting.");
    const [row] = await tx.delete(positions).where(eq(positions.id, id)).returning({ name: positions.name });
    if (!row) throw new DomainError("Position not found.");
    await audit({ actor, action: "position.deleted", entityType: "position", entityId: id, summary: row.name, ip }, tx);
  });
}
