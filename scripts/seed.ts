/**
 * Seeds reference data (departments, positions, card templates, default settings).
 * Idempotent - safe to run repeatedly.
 *
 *   pnpm db:seed          reference data only (production: add --confirm-production)
 *   pnpm db:seed:demo     + clearly-marked DEMO employees & cards (development/preview only)
 *
 * Demo data is refused unless FXT_DATA_ENVIRONMENT is "development" or "preview"
 * (or no DATABASE_URL is set, i.e. the local embedded database). It is always
 * refused for production.
 *
 * Optionally creates a development super admin when SEED_ADMIN_EMAIL and
 * SEED_ADMIN_PASSWORD are set (never hard-coded; never for production - use
 * `pnpm admin:create` there).
 */
import { describeTarget, requireProductionConfirmation, targetsProduction } from "./_db";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { and, eq, sql } from "drizzle-orm";

async function main() {
  const demo = process.argv.includes("--demo");
  const dataEnv = process.env.FXT_DATA_ENVIRONMENT;
  if (demo) {
    const isLocalEmbedded = !process.env.DATABASE_URL;
    const allowed = !targetsProduction() && process.env.NODE_ENV !== "production" && (isLocalEmbedded || dataEnv === "development" || dataEnv === "preview");
    if (!allowed) {
      console.error(
        "Refusing to seed DEMO data: set FXT_DATA_ENVIRONMENT=development or preview for a non-production database. Demo data is never allowed in production.",
      );
      process.exit(2);
    }
  }
  requireProductionConfirmation("seed reference data");
  console.log(`Seeding ${describeTarget(process.env.DATABASE_URL)} (${dataEnv ?? "development"})${demo ? " with DEMO data" : ""} …`);
  const { db } = await import("../src/lib/db");
  const s = await import("../src/lib/db/schema");
  const { TEMPLATE_PRESETS, cardTemplateConfigSchema, orientationOfLayout } = await import("../src/lib/cards/templates");
  const { DEFAULT_SETTINGS } = await import("../src/lib/validation/settings");

  // Settings (only inserted if missing - never overwrites admin changes).
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db.insert(s.systemSettings).values({ key, value }).onConflictDoNothing();
  }

  const departmentNames = [
    ["Management", "Directors and senior management"],
    ["Administration", "Office and administrative support"],
    ["Operations", "Planning, dispatch and operational control"],
    ["Drivers", "Courier, delivery and transport drivers"],
    ["Customer Service", "Customer enquiries and support"],
    ["Finance", "Accounts, invoicing and payroll"],
    ["IT", "Systems and technology"],
    ["Marketing", "Brand, sales and marketing"],
  ] as const;
  const deptIds: Record<string, string> = {};
  for (const [i, [name, description]] of departmentNames.entries()) {
    await db.insert(s.departments).values({ name, description, sortOrder: (i + 1) * 10 }).onConflictDoNothing();
    const [row] = await db.select().from(s.departments).where(sql`lower(${s.departments.name}) = lower(${name})`);
    deptIds[name] = row.id;
  }

  const positionDefs: Array<[string, string]> = [
    ["Managing Director", "Management"],
    ["Operations Manager", "Operations"],
    ["Transport Planner", "Operations"],
    ["Warehouse Operative", "Operations"],
    ["HGV Driver", "Drivers"],
    ["Van Driver", "Drivers"],
    ["Courier Driver", "Drivers"],
    ["Office Administrator", "Administration"],
    ["Customer Service Advisor", "Customer Service"],
    ["Accounts Assistant", "Finance"],
    ["IT Support", "IT"],
    ["Marketing Executive", "Marketing"],
  ];
  const posIds: Record<string, string> = {};
  for (const [name, dept] of positionDefs) {
    await db.insert(s.positions).values({ name, departmentId: deptIds[dept] }).onConflictDoNothing();
    const [row] = await db.select().from(s.positions).where(sql`lower(${s.positions.name}) = lower(${name})`);
    posIds[name] = row.id;
  }

  for (const t of TEMPLATE_PRESETS) {
    await db
      .insert(s.cardTemplates)
      .values({
        slug: t.slug,
        name: t.name,
        description: t.description,
        layout: t.layout,
        orientation: orientationOfLayout(t.layout),
        config: cardTemplateConfigSchema.parse(t.config),
        isDefault: false,
      })
      .onConflictDoNothing();
  }
  const [hasDefault] = await db.select().from(s.cardTemplates).where(eq(s.cardTemplates.isDefault, true));
  if (!hasDefault) {
    await db.update(s.cardTemplates).set({ isDefault: true }).where(eq(s.cardTemplates.slug, "standard-employee"));
  }
  console.log("Reference data seeded.");

  // Optional development admin from environment variables.
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (email && password && targetsProduction()) {
    console.warn("SEED_ADMIN_* is ignored for production. Use `pnpm admin:create --confirm-production` instead.");
  } else if (email && password) {
    const { hashPassword } = await import("../src/lib/auth/password");
    const [existing] = await db.select().from(s.users).where(sql`lower(${s.users.email}) = ${email}`);
    if (!existing) {
      await db.insert(s.users).values({ email, fullName: "Development Admin", role: "super_admin", passwordHash: await hashPassword(password) });
      console.log(`Created development super admin ${email}.`);
    }
  }

  if (!demo) return;
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed demo data in production.");

  const [admin] = await db.select().from(s.users).where(eq(s.users.role, "super_admin")).limit(1);
  if (!admin) throw new Error("Create an administrator first (pnpm admin:create or SEED_ADMIN_* variables).");
  const actor = { id: admin.id, email: admin.email };

  const { createEmployee, setEmployeePhoto } = await import("../src/lib/services/employees");
  const { issueCard } = await import("../src/lib/services/cards");
  const { addDaysIso, addMonthsIso, todayIso } = await import("../src/lib/dates");
  const { generateVerificationToken } = await import("../src/lib/cards/tokens");

  // Clearly fictional people. Every record is flagged is_demo and watermarked "DEMO".
  const people: Array<{ name: string; pos: string; dept: string; bg: string; card: "active" | "expiring" | "expired" | "none" | "driver" | "landscape" }> = [
    { name: "James Wilson", pos: "Operations Manager", dept: "Operations", bg: "#dfe6ee", card: "active" },
    { name: "Emma Taylor", pos: "Customer Service Advisor", dept: "Customer Service", bg: "#e8e2ee", card: "active" },
    { name: "Daniel Hughes", pos: "HGV Driver", dept: "Drivers", bg: "#e2ece6", card: "driver" },
    { name: "Sophie Clarke", pos: "Office Administrator", dept: "Administration", bg: "#eee6df", card: "expiring" },
    { name: "Oliver Bennett", pos: "Van Driver", dept: "Drivers", bg: "#dfe9ee", card: "expired" },
    { name: "Grace Mitchell", pos: "Accounts Assistant", dept: "Finance", bg: "#eeeadf", card: "none" },
    { name: "Liam Carter", pos: "Transport Planner", dept: "Operations", bg: "#e4e9f2", card: "landscape" },
  ];

  for (const p of people) {
    const [exists] = await db
      .select({ id: s.employees.id })
      .from(s.employees)
      .where(and(eq(s.employees.fullName, p.name), eq(s.employees.isDemo, true)));
    if (exists) continue;
    const emp = await createEmployee(
      actor,
      {
        employeeNumber: null,
        fullName: p.name,
        displayName: null,
        email: `${p.name.toLowerCase().replace(/\s+/g, ".")}@example.invalid`,
        phone: null,
        departmentId: deptIds[p.dept],
        positionId: posIds[p.pos],
        employmentStatus: "active",
        startDate: "2025-06-02",
        endDate: null,
        notes: "DEMO RECORD - fictional person for development and testing only.",
      },
      null,
      { allowManualNumber: false },
    );
    await db.update(s.employees).set({ isDemo: true }).where(eq(s.employees.id, emp.id));

    // Neutral generated silhouette - not a real person.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="660" height="880"><rect width="660" height="880" fill="${p.bg}"/><circle cx="330" cy="350" r="140" fill="#8593a6"/><ellipse cx="330" cy="900" rx="280" ry="300" fill="#4a5a70"/></svg>`;
    const master = await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
    const thumb = await sharp(master).resize(180, 240).webp().toBuffer();
    await setEmployeePhoto(actor, emp.id, { master, thumb }, null);

    const today = todayIso();
    if (p.card === "active" || p.card === "driver" || p.card === "landscape") {
      const slug = p.card === "driver" ? "driver" : p.card === "landscape" ? "standard-employee-landscape" : null;
      const templateId = slug ? ((await db.select().from(s.cardTemplates).where(eq(s.cardTemplates.slug, slug)))[0]?.id ?? null) : null;
      await issueCard(actor, { employeeId: emp.id, reason: "new", templateId, expiresAt: null, validityMonths: null, note: null }, null);
    } else if (p.card === "expiring") {
      await issueCard(actor, { employeeId: emp.id, reason: "new", templateId: null, expiresAt: addDaysIso(today, 18), validityMonths: null, note: null }, null);
    } else if (p.card === "expired") {
      const [e] = await db.select().from(s.employees).where(eq(s.employees.id, emp.id));
      const [tpl] = await db.select().from(s.cardTemplates).where(eq(s.cardTemplates.slug, "driver"));
      await db.insert(s.employeeCards).values({
        id: randomUUID(),
        employeeId: emp.id,
        cardNumber: `CARD-${e.employeeNumber.replace(/^FXT-/, "")}-01`,
        verificationToken: generateVerificationToken(),
        templateId: tpl?.id ?? null,
        version: 1,
        issuedAt: addMonthsIso(today, -24),
        expiresAt: addDaysIso(today, -12),
        status: "active",
        issueReason: "new",
        snapshot: {
          employeeNumber: e.employeeNumber,
          fullName: e.fullName,
          displayName: null,
          positionName: p.pos,
          departmentName: p.dept,
          photoKey: e.photoKey,
        },
        issuedBy: admin.id,
      });
    }
  }
  console.log("Demo employees seeded (flagged DEMO).");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
