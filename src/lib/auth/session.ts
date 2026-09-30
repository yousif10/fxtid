import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, users } from "@/lib/db/schema";
import { env, isProduction } from "@/lib/env";
import { can, type AdminRole, type Permission } from "@/lib/permissions";

export const SESSION_COOKIE = isProduction ? "__Host-fxt_session" : "fxt_session";

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: AdminRole;
  sessionId: string;
};

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string, meta: { ip: string; userAgent: string | null }) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_HOURS * 3600_000);
  await db.insert(sessions).values({
    id: hashToken(token),
    userId,
    expiresAt,
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  // Opportunistic cleanup of expired sessions.
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  jar.delete(SESSION_COOKIE);
}

export async function destroyAllSessionsForUser(userId: string) {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

/** Resolves the signed-in administrator from the session cookie (once per request). */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const id = hashToken(token);
  const now = new Date();
  const [row] = await db
    .select({
      sessionId: sessions.id,
      lastSeenAt: sessions.lastSeenAt,
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      active: users.active,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, now)))
    .limit(1);
  if (!row || !row.active) return null;

  // Sliding expiry, written at most every 10 minutes.
  if (now.getTime() - row.lastSeenAt.getTime() > 10 * 60_000) {
    await db
      .update(sessions)
      .set({ lastSeenAt: now, expiresAt: new Date(now.getTime() + env.SESSION_TTL_HOURS * 3600_000) })
      .where(eq(sessions.id, id));
  }
  return { id: row.id, email: row.email, fullName: row.fullName, role: row.role, sessionId: row.sessionId };
});

/** For pages/layouts: redirect to login when signed out. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** For pages: redirect to the unauthorised page when the role lacks a permission. */
export async function requirePagePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.role, permission)) redirect("/unauthorized");
  return user;
}

export class AuthorizationError extends Error {
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/** For server actions & route handlers: throws instead of redirecting. */
export async function assertPermission(permission: Permission): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthorizationError("Your session has expired. Please sign in again.");
  if (!can(user.role, permission)) throw new AuthorizationError();
  return user;
}
