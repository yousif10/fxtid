/**
 * Integration tests: real migrations + services against an in-memory Postgres (PGlite).
 */
import { beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { getDb } from "@/lib/db";
import { cardTemplates, employeeCards, employees, users, departments, positions, verificationEvents, auditLogs } from "@/lib/db/schema";
import { buildCardSvg } from "@/lib/services/card-artwork";
import { getCard, getEmployeeCards } from "@/lib/services/cards";
import { saveTemplate } from "@/lib/services/templates";
import { addDaysIso, todayIso } from "@/lib/dates";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { changeCardStatus, DomainError, issueCard, reactivateCard } from "@/lib/services/cards";
import { createEmployee, deleteEmployee, setArchived, updateEmployee } from "@/lib/services/employees";
import { verifyToken } from "@/lib/services/verification";
import { commitImport, previewImport } from "@/lib/services/import";
import type { EmployeeInput } from "@/lib/validation/employee";

let actor: { id: string; email: string };
const db = () => getDb();

const baseEmployee = (fullName: string, extra: Partial<EmployeeInput> = {}): EmployeeInput => ({
  employeeNumber: null,
  fullName,
  displayName: null,
  email: null,
  phone: null,
  departmentId: null,
  positionId: null,
  employmentStatus: "active",
  startDate: null,
  endDate: null,
  notes: null,
  ...extra,
});

const issue = (employeeId: string, reason: Parameters<typeof issueCard>[1]["reason"] = "new", extra: Partial<Parameters<typeof issueCard>[1]> = {}) =>
  issueCard(actor, { employeeId, reason, templateId: null, expiresAt: null, validityMonths: null, note: null, ...extra }, null);

beforeAll(async () => {
  await migrate(getDb() as unknown as PgliteDatabase, { migrationsFolder: "./db/migrations" });
  const [u] = await db()
    .insert(users)
    .values({ email: "test-admin@example.invalid", fullName: "Test Admin", role: "super_admin", passwordHash: await hashPassword("test-password-123") })
    .returning();
  actor = { id: u.id, email: u.email };
  // Photos not required for these tests.
  await db().execute(sql`insert into system_settings (key, value) values ('cards', '{"requirePhotoForIssue": false, "defaultValidityMonths": 24, "expiringSoonDays": 30, "employeeNumberPrefix": "FXT", "employeeNumberDigits": 5, "cardNumberPrefix": "CARD"}')`);
});

describe("passwords", () => {
  it("hashes with scrypt and verifies", async () => {
    const h = await hashPassword("correct horse 1");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse 1", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
  });
});

describe("employee numbers", () => {
  it("allocates sequential unique numbers that are never reused after deletion", async () => {
    const a = await createEmployee(actor, baseEmployee("Alice Example"), null, { allowManualNumber: false });
    const b = await createEmployee(actor, baseEmployee("Bob Example"), null, { allowManualNumber: false });
    expect(a.employeeNumber).toMatch(/^FXT-\d{5}$/);
    expect(Number(b.employeeNumber.slice(4))).toBe(Number(a.employeeNumber.slice(4)) + 1);
    await deleteEmployee(actor, b.id, null);
    const c = await createEmployee(actor, baseEmployee("Carol Example"), null, { allowManualNumber: false });
    expect(c.employeeNumber).not.toBe(b.employeeNumber);
  });

  it("skips numbers that were taken manually and rejects duplicates", async () => {
    const seq = (await db().execute(sql`select last_value from employee_number_seq`)) as unknown as { rows: Array<{ last_value: string }> };
    const next = Number(seq.rows[0].last_value) + 1;
    const manual = `FXT-${String(next).padStart(5, "0")}`;
    await createEmployee(actor, baseEmployee("Manual Number", { employeeNumber: manual }), null, { allowManualNumber: true });
    const auto = await createEmployee(actor, baseEmployee("Auto Number"), null, { allowManualNumber: false });
    expect(auto.employeeNumber).not.toBe(manual);
    await expect(createEmployee(actor, baseEmployee("Dup", { employeeNumber: manual.toLowerCase() }), null, { allowManualNumber: true })).rejects.toThrow(DomainError);
  });

  it("refuses manual numbers without permission", async () => {
    await expect(createEmployee(actor, baseEmployee("No Perm", { employeeNumber: "FXT-99999" }), null, { allowManualNumber: false })).rejects.toThrow(/not allowed/);
  });
});

describe("card lifecycle", () => {
  it("issues, replaces and verifies cards with full history", async () => {
    const emp = await createEmployee(actor, baseEmployee("Dana Lifecycle"), null, { allowManualNumber: false });
    const first = await issue(emp.id);
    expect(first.cardNumber).toMatch(/^CARD-\d{5}-01$/);
    await expect(issue(emp.id)).rejects.toThrow(/already has an active card/);

    const [c1] = await db().select().from(employeeCards).where(eq(employeeCards.id, first.cardId));
    expect((await verifyToken(c1.verificationToken)).outcome).toBe("valid");

    // Lost -> replacement: old QR must stop validating, new one validates.
    const second = await issue(emp.id, "lost");
    expect(second.cardNumber).toMatch(/-02$/);
    const [old] = await db().select().from(employeeCards).where(eq(employeeCards.id, first.cardId));
    expect(old.status).toBe("lost");
    const oldResult = await verifyToken(c1.verificationToken);
    expect(oldResult.outcome).toBe("invalid");
    const [c2] = await db().select().from(employeeCards).where(eq(employeeCards.id, second.cardId));
    expect(c2.replacedCardId).toBe(first.cardId);
    expect((await verifyToken(c2.verificationToken)).outcome).toBe("valid");

    // Only one active card per employee is enforced by the database itself.
    await expect(db().update(employeeCards).set({ status: "active" }).where(eq(employeeCards.id, first.cardId))).rejects.toThrow();
  });

  it("disables and reactivates cards; verification reflects it immediately", async () => {
    const emp = await createEmployee(actor, baseEmployee("Evan Disable"), null, { allowManualNumber: false });
    const { cardId } = await issue(emp.id);
    const [card] = await db().select().from(employeeCards).where(eq(employeeCards.id, cardId));
    await changeCardStatus(actor, cardId, "disabled", "QA test", null);
    const res = await verifyToken(card.verificationToken);
    expect(res.outcome).toBe("invalid");
    if (res.outcome === "invalid") {
      expect(res.reason).toBe("disabled");
      expect(JSON.stringify(res)).not.toContain("Evan");
    }
    await reactivateCard(actor, cardId, "QA test", null);
    expect((await verifyToken(card.verificationToken)).outcome).toBe("valid");
  });

  it("treats expired cards as expired even though the stored status is active", async () => {
    const emp = await createEmployee(actor, baseEmployee("Faye Expired"), null, { allowManualNumber: false });
    const [e] = await db().select().from(employees).where(eq(employees.id, emp.id));
    const token = "EXPIREDTOKENAAAAAAAAAAAAAA";
    await db().insert(employeeCards).values({
      employeeId: emp.id,
      cardNumber: `CARD-EXP-${e.employeeNumber}`,
      verificationToken: token,
      version: 1,
      issuedAt: addDaysIso(todayIso(), -400),
      expiresAt: addDaysIso(todayIso(), -1),
      status: "active",
      snapshot: { employeeNumber: e.employeeNumber, fullName: e.fullName, displayName: null, positionName: null, departmentName: null, photoKey: null },
    });
    expect((await verifyToken(token)).outcome).toBe("expired");
    // Renewal supersedes the expired card with status "expired".
    const renewed = await issue(emp.id, "renewal");
    const [prev] = await db().select().from(employeeCards).where(eq(employeeCards.verificationToken, token));
    expect(prev.status).toBe("expired");
    expect(renewed.cardNumber).toMatch(/-02$/);
  });

  it("invalidates cards when the employee leaves or is archived", async () => {
    const emp = await createEmployee(actor, baseEmployee("Gus Leaver"), null, { allowManualNumber: false });
    const { cardId } = await issue(emp.id);
    const [card] = await db().select().from(employeeCards).where(eq(employeeCards.id, cardId));
    await updateEmployee(actor, emp.id, baseEmployee("Gus Leaver", { employmentStatus: "left" }), null, { allowManualNumber: false });
    expect((await verifyToken(card.verificationToken)).outcome).toBe("invalid");
    const [after] = await db().select().from(employeeCards).where(eq(employeeCards.id, cardId));
    expect(after.status).toBe("disabled");
    await expect(issue(emp.id, "renewal")).rejects.toThrow(/active employees/);

    const emp2 = await createEmployee(actor, baseEmployee("Hana Archive"), null, { allowManualNumber: false });
    const c2 = await issue(emp2.id);
    await setArchived(actor, emp2.id, true, null);
    const [c2row] = await db().select().from(employeeCards).where(eq(employeeCards.id, c2.cardId));
    expect(c2row.status).toBe("disabled");
  });

  it("protects issued card identity fields and keeps the audit log append-only", async () => {
    const emp = await createEmployee(actor, baseEmployee("Ivy Immutable"), null, { allowManualNumber: false });
    const { cardId } = await issue(emp.id);
    await expect(db().update(employeeCards).set({ verificationToken: "TAMPEREDTOKENAAAAAAAAAAAAA" }).where(eq(employeeCards.id, cardId))).rejects.toThrow();
    await expect(db().update(auditLogs).set({ summary: "tampered" })).rejects.toThrow();
  });

  it("prevents deleting employees with card history", async () => {
    const emp = await createEmployee(actor, baseEmployee("Jon History"), null, { allowManualNumber: false });
    await issue(emp.id);
    await expect(deleteEmployee(actor, emp.id, null)).rejects.toThrow(/card history/);
  });

  it("logs every verification, including unknown tokens", async () => {
    const before = (await db().select().from(verificationEvents)).length;
    const res = await verifyToken("ZZZZZZZZZZZZZZZZZZZZZZZZZZ");
    expect(res.outcome).toBe("not_found");
    expect((await verifyToken("<script>")).outcome).toBe("not_found");
    expect((await db().select().from(verificationEvents)).length).toBe(before + 2);
  });
});

describe("CSV import", () => {
  it("validates everything and imports nothing when any row is invalid", async () => {
    await db().insert(departments).values({ name: "Operations" }).onConflictDoNothing();
    await db().insert(positions).values({ name: "Van Driver" }).onConflictDoNothing();
    const bad = `full_name,department,position,email,start_date\nKim Import,Operations,Van Driver,kim@example.invalid,2026-01-05\nLee Import,Nowhere,Van Driver,not-an-email,2026-13-01\n`;
    const preview = await previewImport(bad, { createMissing: false });
    expect(preview.errorCount).toBe(1);
    expect(preview.rows[1].errors.join(" ")).toMatch(/email|start_date/);
    const countBefore = (await db().select().from(employees)).length;
    await expect(commitImport(actor, bad, { createMissing: false }, null)).rejects.toThrow(/Nothing was imported/);
    expect((await db().select().from(employees)).length).toBe(countBefore);

    const good = `full_name,department,position\nKim Import,Operations,Van Driver\nLee Import,Warehouse,Forklift Operator\n`;
    const res = await commitImport(actor, good, { createMissing: true }, null);
    expect(res.created).toBe(2);
    expect((await db().select().from(employees)).length).toBe(countBefore + 2);
  });
});

describe("landscape cards", () => {
  async function landscapeTemplate() {
    const [t] = await db()
      .insert(cardTemplates)
      .values({ name: "Standard Employee", slug: "std-landscape-test", layout: "fxt-landscape-v1", orientation: "landscape", config: {} })
      .returning();
    return t;
  }

  it("snapshots layout/orientation; reissue, export, print and history stay landscape", async () => {
    const tpl = await landscapeTemplate();
    const emp = await createEmployee(actor, baseEmployee("Lena Landscape"), null, { allowManualNumber: false });
    const first = await issue(emp.id, "new", { templateId: tpl.id });
    const c1 = (await getCard(first.cardId))!;
    expect(c1.layout).toBe("fxt-landscape-v1");
    expect(c1.orientation).toBe("landscape");

    // Reissue without choosing a template keeps the previous card's (landscape) design.
    const second = await issue(emp.id, "damaged");
    const c2 = (await getCard(second.cardId))!;
    expect(c2.orientation).toBe("landscape");
    expect(c2.templateId).toBe(tpl.id);

    // Editing the template later (even switching it to portrait) never changes issued cards.
    await saveTemplate(actor, tpl.id, { name: tpl.name, description: null, layout: "fxt-portrait-v1", config: { roleLabel: "CHANGED" }, active: true, isDefault: false }, null);
    const c2After = (await getCard(second.cardId))!;
    expect(c2After.orientation).toBe("landscape");
    expect(c2After.templateConfig.roleLabel).toBeNull();

    // Download / print both render from buildCardSvg with the snapshotted layout.
    for (const side of ["front", "back"] as const) {
      const svg = await buildCardSvg(c2After, side, "export");
      expect(svg).toContain('viewBox="0 0 85.6 53.98"');
      expect(svg).not.toContain("CHANGED");
    }

    // History reports orientation per card.
    const history = await getEmployeeCards(emp.id);
    expect(history.map((h) => h.orientation)).toEqual(["landscape", "landscape"]);

    // Old QR invalid, replacement valid.
    expect((await verifyToken(c1.verificationToken)).outcome).toBe("invalid");
    expect((await verifyToken(c2.verificationToken)).outcome).toBe("valid");
  });

  it("an explicitly chosen template wins over the previous design", async () => {
    const tpl = await db().insert(cardTemplates).values({ name: "L2", slug: "l2-landscape-test", layout: "fxt-landscape-v1", orientation: "landscape", config: {} }).returning();
    const emp = await createEmployee(actor, baseEmployee("Otto Orientation"), null, { allowManualNumber: false });
    await issue(emp.id, "new", { templateId: tpl[0].id });
    const portraitTpl = await db().insert(cardTemplates).values({ name: "P2", slug: "p2-portrait-test", layout: "fxt-portrait-v1", orientation: "portrait", config: {} }).returning();
    const next = await issue(emp.id, "role_changed", { templateId: portraitTpl[0].id });
    expect((await getCard(next.cardId))!.orientation).toBe("portrait");
  });

  it("existing cards without an orientation default to portrait; the database rejects inconsistent values", async () => {
    const emp = await createEmployee(actor, baseEmployee("Pat Legacy"), null, { allowManualNumber: false });
    const [e] = await db().select().from(employees).where(eq(employees.id, emp.id));
    const snapshot = { employeeNumber: e.employeeNumber, fullName: e.fullName, displayName: null, positionName: null, departmentName: null, photoKey: null };
    // Insert like a pre-migration card: no layout/orientation supplied.
    const [legacy] = await db()
      .insert(employeeCards)
      .values({ employeeId: emp.id, cardNumber: `LEG-${e.employeeNumber}`, verificationToken: "LEGACYTOKENAAAAAAAAAAAAAAA", version: 1, issuedAt: todayIso(), expiresAt: addDaysIso(todayIso(), 100), status: "revoked", snapshot })
      .returning();
    expect(legacy.layout).toBe("fxt-portrait-v1");
    expect(legacy.orientation).toBe("portrait");
    expect((await getCard(legacy.id))!.orientation).toBe("portrait");

    // Orientation must match the layout, and issued layouts are immutable.
    await expect(
      db().insert(cardTemplates).values({ name: "Bad", slug: "bad-mismatch", layout: "fxt-landscape-v1", orientation: "portrait", config: {} }),
    ).rejects.toThrow();
    await expect(db().update(employeeCards).set({ layout: "fxt-landscape-v1", orientation: "landscape" }).where(eq(employeeCards.id, legacy.id))).rejects.toThrow();
  });
});
