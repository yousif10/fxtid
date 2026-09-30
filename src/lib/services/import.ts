import "server-only";
import Papa from "papaparse";
import { sql } from "drizzle-orm";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { departments, employees, positions } from "@/lib/db/schema";
import { getSettings } from "@/lib/settings";
import { employeeImportRowSchema, type EmployeeImportRow } from "@/lib/validation/employee";
import { DomainError } from "./cards";
import { generateEmployeeNumber } from "./employees";

export const IMPORT_COLUMNS = ["employee_number", "full_name", "display_name", "department", "position", "email", "phone", "start_date", "employment_status"] as const;
export const IMPORT_MAX_ROWS = 2000;

export type ImportRowResult = {
  line: number;
  data: Partial<EmployeeImportRow> & { full_name?: string };
  errors: string[];
  warnings: string[];
};

export type ImportPreview = {
  rows: ImportRowResult[];
  validCount: number;
  errorCount: number;
  newDepartments: string[];
  newPositions: string[];
  headerErrors: string[];
};

function parseCsv(text: string) {
  const res = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
  });
  return res;
}

/** Validates every row. Nothing is written. */
export async function previewImport(csv: string, opts: { createMissing: boolean }): Promise<ImportPreview> {
  const parsed = parseCsv(csv);
  const headerErrors: string[] = [];
  const fields = parsed.meta.fields ?? [];
  if (!fields.includes("full_name")) headerErrors.push('Missing required column "full_name".');
  const unknown = fields.filter((f) => !(IMPORT_COLUMNS as readonly string[]).includes(f));
  if (unknown.length) headerErrors.push(`Unknown column(s) ignored: ${unknown.join(", ")}.`);
  if (parsed.data.length > IMPORT_MAX_ROWS) headerErrors.push(`Too many rows (max ${IMPORT_MAX_ROWS}).`);
  if (parsed.data.length === 0) headerErrors.push("The file contains no data rows.");

  const [deps, poss, existingNumbers] = await Promise.all([
    db.select({ id: departments.id, name: departments.name }).from(departments),
    db.select({ id: positions.id, name: positions.name }).from(positions),
    db.select({ n: sql<string>`upper(${employees.employeeNumber})` }).from(employees),
  ]);
  const depByName = new Map(deps.map((d) => [d.name.toLowerCase(), d.id]));
  const posByName = new Map(poss.map((p) => [p.name.toLowerCase(), p.id]));
  const taken = new Set(existingNumbers.map((r) => r.n));
  const seenInFile = new Set<string>();
  // Keyed by lower-case name so "Ops" and "ops" create one record.
  const newDepartments = new Map<string, string>();
  const newPositions = new Map<string, string>();

  const rows: ImportRowResult[] = parsed.data.slice(0, IMPORT_MAX_ROWS).map((raw, i) => {
    const line = i + 2; // header is line 1
    const result = employeeImportRowSchema.safeParse(raw);
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!result.success) {
      for (const issue of result.error.issues) errors.push(`${issue.path.join(".") || "row"}: ${issue.message}`);
      return { line, data: { full_name: raw.full_name }, errors, warnings };
    }
    const r = result.data;
    if (r.employee_number) {
      if (taken.has(r.employee_number)) errors.push(`employee_number ${r.employee_number} already exists`);
      if (seenInFile.has(r.employee_number)) errors.push(`employee_number ${r.employee_number} is duplicated in this file`);
      seenInFile.add(r.employee_number);
    }
    if (r.department && !depByName.has(r.department.toLowerCase())) {
      if (opts.createMissing) {
        if (!newDepartments.has(r.department.toLowerCase())) newDepartments.set(r.department.toLowerCase(), r.department);
        warnings.push(`New department "${r.department}" will be created`);
      } else errors.push(`Unknown department "${r.department}"`);
    }
    if (r.position && !posByName.has(r.position.toLowerCase())) {
      if (opts.createMissing) {
        if (!newPositions.has(r.position.toLowerCase())) newPositions.set(r.position.toLowerCase(), r.position);
        warnings.push(`New position "${r.position}" will be created`);
      } else errors.push(`Unknown position "${r.position}"`);
    }
    return { line, data: r, errors, warnings };
  });

  const errorCount = rows.filter((r) => r.errors.length).length;
  return {
    rows,
    validCount: rows.length - errorCount,
    errorCount,
    newDepartments: [...newDepartments.values()],
    newPositions: [...newPositions.values()],
    headerErrors,
  };
}

/** All-or-nothing import: re-validates, then inserts everything in one transaction. */
export async function commitImport(actor: { id: string; email: string }, csv: string, opts: { createMissing: boolean }, ip: string | null) {
  const preview = await previewImport(csv, opts);
  const blocking = preview.headerErrors.filter((e) => !e.startsWith("Unknown column"));
  if (blocking.length || preview.errorCount > 0) {
    throw new DomainError("The file still has errors. Nothing was imported.");
  }
  const settings = await getSettings();
  return db.transaction(async (tx) => {
    const depIds = new Map((await tx.select({ id: departments.id, name: departments.name }).from(departments)).map((d) => [d.name.toLowerCase(), d.id]));
    const posIds = new Map((await tx.select({ id: positions.id, name: positions.name }).from(positions)).map((p) => [p.name.toLowerCase(), p.id]));
    for (const name of preview.newDepartments) {
      const [row] = await tx.insert(departments).values({ name, sortOrder: 500 }).returning({ id: departments.id });
      depIds.set(name.toLowerCase(), row.id);
    }
    for (const name of preview.newPositions) {
      const [row] = await tx.insert(positions).values({ name }).returning({ id: positions.id });
      posIds.set(name.toLowerCase(), row.id);
    }
    let created = 0;
    for (const { data } of preview.rows) {
      const r = data as EmployeeImportRow;
      const employeeNumber =
        r.employee_number ?? (await generateEmployeeNumber(tx, settings.cards.employeeNumberPrefix, settings.cards.employeeNumberDigits));
      await tx.insert(employees).values({
        employeeNumber,
        fullName: r.full_name.replace(/\s+/g, " "),
        displayName: r.display_name,
        email: r.email,
        phone: r.phone,
        departmentId: r.department ? depIds.get(r.department.toLowerCase()) ?? null : null,
        positionId: r.position ? posIds.get(r.position.toLowerCase()) ?? null : null,
        employmentStatus: r.employment_status,
        startDate: r.start_date,
        createdBy: actor.id,
        updatedBy: actor.id,
      });
      created++;
    }
    await audit(
      {
        actor,
        action: "employee.imported",
        entityType: "employee",
        summary: `Imported ${created} employees from CSV`,
        metadata: { created, newDepartments: preview.newDepartments, newPositions: preview.newPositions },
        ip,
      },
      tx,
    );
    return { created };
  });
}
