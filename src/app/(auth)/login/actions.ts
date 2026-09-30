"use server";

import { redirect } from "next/navigation";
import { sql, eq } from "drizzle-orm";
import { safeRedirectPath, type ActionState } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { getDummyHash, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getClientIp, getUserAgent } from "@/lib/request";
import { loginSchema } from "@/lib/validation/user";

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
const GENERIC = "Incorrect email or password.";

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ip = await getClientIp();
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { ok: false, message: "Enter your email address and password.", at: Date.now() };
  const { email, password } = parsed.data;

  const byIp = await rateLimit(rateLimitKey("login-ip", ip), 20, 15 * 60_000);
  const byEmail = await rateLimit(rateLimitKey("login-email", email), 8, 15 * 60_000);
  if (!byIp.ok || !byEmail.ok) {
    return { ok: false, message: "Too many sign-in attempts. Please wait a few minutes and try again.", at: Date.now() };
  }

  const [user] = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
  // Always run the KDF so response time does not reveal whether an account exists.
  const valid = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));

  if (!user || !user.active) {
    await audit({ actor: null, action: "auth.login_failed", entityType: "auth", summary: "Unknown or inactive account", metadata: { email }, ip });
    return { ok: false, message: GENERIC, at: Date.now() };
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { ok: false, message: "This account is temporarily locked after repeated failed sign-ins. Try again later.", at: Date.now() };
  }
  if (!valid) {
    // Atomic increment so concurrent attempts on different server instances all count.
    await db
      .update(users)
      .set({
        failedLoginCount: sql`case when ${users.failedLoginCount} + 1 >= ${MAX_FAILED} then 0 else ${users.failedLoginCount} + 1 end`,
        lockedUntil: sql`case when ${users.failedLoginCount} + 1 >= ${MAX_FAILED} then now() + make_interval(mins => ${LOCK_MINUTES}) else ${users.lockedUntil} end`,
      })
      .where(eq(users.id, user.id));
    await audit({ actor: { id: user.id, email: user.email }, action: "auth.login_failed", entityType: "auth", entityId: user.id, summary: "Wrong password", ip });
    return { ok: false, message: GENERIC, at: Date.now() };
  }

  await db.update(users).set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() }).where(eq(users.id, user.id));
  await createSession(user.id, { ip, userAgent: await getUserAgent() });
  await audit({ actor: { id: user.id, email: user.email }, action: "auth.login", entityType: "auth", entityId: user.id, ip });
  redirect(safeRedirectPath(formData.get("next")));
}

export async function logoutAction() {
  const user = await getCurrentUser();
  if (user) await audit({ actor: { id: user.id, email: user.email }, action: "auth.logout", entityType: "auth", entityId: user.id, ip: await getClientIp() });
  await destroySession();
  redirect("/login");
}
