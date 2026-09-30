"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, ne, sql } from "drizzle-orm";
import { runAction, type ActionState } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { assertPermission, destroyAllSessionsForUser, getCurrentUser, AuthorizationError } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/db/errors";
import { sessions, systemSettings, users } from "@/lib/db/schema";
import { getClientIp } from "@/lib/request";
import { DomainError } from "@/lib/services/cards";
import { formDataToObject } from "@/lib/validation/common";
import { settingsSchemas, type SettingsKey } from "@/lib/validation/settings";
import { changePasswordSchema, createUserSchema, resetPasswordSchema, updateUserSchema } from "@/lib/validation/user";

export async function saveSettingsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertPermission("settings:manage");
    const key = fd.get("_key") as SettingsKey;
    if (!(key in settingsSchemas)) throw new DomainError("Unknown settings group.");
    const raw = formDataToObject(fd);
    if (key === "cards") raw.requirePhotoForIssue = raw.requirePhotoForIssue === "on" ? "true" : "";
    const value = settingsSchemas[key].parse(raw);
    await db.transaction(async (tx) => {
      await tx
        .insert(systemSettings)
        .values({ key, value, updatedBy: user.id })
        .onConflictDoUpdate({ target: systemSettings.key, set: { value, updatedBy: user.id, updatedAt: new Date() } });
      await audit({ actor: user, action: "settings.updated", entityType: "settings", entityId: key, summary: `${key} settings updated`, metadata: { fields: Object.keys(value) }, ip: await getClientIp() }, tx);
    });
    revalidatePath("/", "layout");
    return { ok: true, message: "Settings saved." };
  });
}

async function activeSuperAdminsExcluding(userId: string) {
  const [{ n }] = await db
    .select({ n: count() })
    .from(users)
    .where(and(eq(users.role, "super_admin"), eq(users.active, true), ne(users.id, userId)));
  return n;
}

export async function createUserAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await assertPermission("users:manage");
    const input = createUserSchema.parse(formDataToObject(fd));
    try {
      const [row] = await db
        .insert(users)
        .values({ email: input.email, fullName: input.fullName, role: input.role, passwordHash: await hashPassword(input.password), passwordChangedAt: new Date() })
        .returning({ id: users.id });
      await audit({ actor, action: "user.created", entityType: "user", entityId: row.id, summary: `${input.email} (${input.role})`, ip: await getClientIp() });
    } catch (err) {
      if (isUniqueViolation(err)) throw new DomainError("An administrator with this email already exists.", "email");
      throw err;
    }
    revalidatePath("/settings/users");
    return { ok: true, message: `Administrator ${input.email} created. Share the password with them securely.` };
  });
}

export async function updateUserAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await assertPermission("users:manage");
    const input = updateUserSchema.parse(formDataToObject(fd));
    const [target] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
    if (!target) throw new DomainError("Administrator not found.");
    const losingSuper = target.role === "super_admin" && target.active && (input.role !== "super_admin" || !input.active);
    if (losingSuper && (await activeSuperAdminsExcluding(target.id)) === 0) {
      throw new DomainError("At least one active Super Admin must remain.");
    }
    await db.update(users).set({ fullName: input.fullName, role: input.role, active: input.active }).where(eq(users.id, target.id));
    // Role or access changes take effect immediately: revoke existing sessions.
    if (!input.active || input.role !== target.role) await destroyAllSessionsForUser(target.id);
    await audit({
      actor,
      action: "user.updated",
      entityType: "user",
      entityId: target.id,
      summary: target.email,
      metadata: { role: { from: target.role, to: input.role }, active: { from: target.active, to: input.active } },
      ip: await getClientIp(),
    });
    revalidatePath("/settings/users");
    return { ok: true, message: "Administrator updated." };
  });
}

export async function resetUserPasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await assertPermission("users:manage");
    const input = resetPasswordSchema.parse(formDataToObject(fd));
    const [target] = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.id, input.userId)).limit(1);
    if (!target) throw new DomainError("Administrator not found.");
    await db
      .update(users)
      .set({ passwordHash: await hashPassword(input.password), passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null })
      .where(eq(users.id, target.id));
    await destroyAllSessionsForUser(target.id);
    await audit({ actor, action: "user.password_reset", entityType: "user", entityId: target.id, summary: target.email, ip: await getClientIp() });
    return { ok: true, message: "Password reset. The administrator has been signed out everywhere." };
  });
}

export async function changeOwnPasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const me = await getCurrentUser();
    if (!me) throw new AuthorizationError("Your session has expired. Please sign in again.");
    const input = changePasswordSchema.parse(formDataToObject(fd));
    const [row] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, me.id)).limit(1);
    if (!row || !(await verifyPassword(input.currentPassword, row.hash))) {
      throw new DomainError("Current password is incorrect.", "currentPassword");
    }
    await db.update(users).set({ passwordHash: await hashPassword(input.newPassword), passwordChangedAt: new Date() }).where(eq(users.id, me.id));
    // Sign out other sessions, keep this one.
    await db.delete(sessions).where(and(eq(sessions.userId, me.id), sql`${sessions.id} <> ${me.sessionId}`));
    await audit({ actor: me, action: "auth.password_changed", entityType: "auth", entityId: me.id, ip: await getClientIp() });
    return { ok: true, message: "Password changed. Other sessions have been signed out." };
  });
}
