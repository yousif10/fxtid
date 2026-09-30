/**
 * Creates (or promotes) an administrator account.
 *
 *   pnpm admin:create --email you@company.co.uk --name "Your Name" [--role super_admin] [--confirm-production]
 *
 * The password is read from ADMIN_PASSWORD or prompted interactively (hidden).
 * Nothing is hard-coded; no default credentials exist.
 */
import { describeTarget, requireProductionConfirmation } from "./_db";
import readline from "node:readline";
import { sql } from "drizzle-orm";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
    let muted = false;
    out._writeToOutput = (s: string) => {
      if (!muted || s.includes("\n")) out.output.write(muted ? "\n" : s);
    };
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
    muted = true;
  });
}

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  const name = arg("name")?.trim();
  const role = (arg("role") ?? "super_admin") as "super_admin" | "admin" | "hr" | "viewer";
  if (!email || !name) {
    console.error('Usage: pnpm admin:create --email you@company.co.uk --name "Your Name" [--role super_admin|admin|hr|viewer]');
    process.exit(1);
  }
  const { passwordSchema } = await import("../src/lib/validation/user");
  const { ADMIN_ROLES } = await import("../src/lib/permissions");
  if (!(ADMIN_ROLES as readonly string[]).includes(role)) throw new Error(`Invalid role ${role}`);

  const password = process.env.ADMIN_PASSWORD ?? (await promptHidden("Password (min 12 chars, letters + numbers): "));
  const check = passwordSchema.safeParse(password);
  if (!check.success) {
    console.error(check.error.issues.map((i) => i.message).join("\n"));
    process.exit(1);
  }

  requireProductionConfirmation("create/update an administrator");
  console.log(`Target database: ${describeTarget(process.env.DATABASE_URL)}`);
  const { db } = await import("../src/lib/db");
  const { users, auditLogs } = await import("../src/lib/db/schema");
  const { hashPassword } = await import("../src/lib/auth/password");
  const [existing] = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`);
  if (existing) {
    await db
      .update(users)
      .set({ role, fullName: name, passwordHash: await hashPassword(password), active: true, failedLoginCount: 0, lockedUntil: null, passwordChangedAt: new Date() })
      .where(sql`${users.id} = ${existing.id}`);
    await db.insert(auditLogs).values({ action: "user.updated", entityType: "user", entityId: existing.id, summary: `${email} updated via CLI`, metadata: { role, via: "cli" } });
    console.log(`Updated existing administrator ${email} (${role}).`);
  } else {
    const [row] = await db.insert(users).values({ email, fullName: name, role, passwordHash: await hashPassword(password) }).returning({ id: users.id });
    await db.insert(auditLogs).values({ action: "user.created", entityType: "user", entityId: row.id, summary: `${email} created via CLI`, metadata: { role, via: "cli" } });
    console.log(`Created administrator ${email} (${role}).`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
