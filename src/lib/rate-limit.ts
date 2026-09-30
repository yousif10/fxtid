import "server-only";
import { createHash } from "node:crypto";
import { lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { rowsOf } from "@/lib/db/errors";
import { rateLimitBuckets } from "@/lib/db/schema";

// Fixed-window rate limiter stored in Postgres so limits hold across every
// serverless instance (an in-memory counter would reset per instance on Vercel).
// A single atomic INSERT … ON CONFLICT per check; keys are hashed so no raw IP
// addresses or email addresses are persisted. Account lockout for logins is
// additionally enforced on the users table.

export type RateLimitResult = { ok: boolean; retryAfterSec: number; count: number };

export function rateLimitKey(scope: string, subject: string): string {
  return createHash("sha256").update(`${scope}:${subject}`).digest("hex");
}

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const hashed = /^[a-f0-9]{64}$/.test(key) ? key : rateLimitKey("rl", key);
  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
  const [row] = rowsOf<{ count: number | string; reset_at: string | Date }>(
    await db.execute(sql`
      insert into rate_limit_buckets as b (key, count, reset_at)
      values (${hashed}, 1, now() + make_interval(secs => ${windowSec}))
      on conflict (key) do update set
        count = case when b.reset_at <= now() then 1 else b.count + 1 end,
        reset_at = case when b.reset_at <= now() then excluded.reset_at else b.reset_at end
      returning count, reset_at`),
  );
  const count = Number(row.count);
  const resetAt = new Date(row.reset_at).getTime();
  // Opportunistic cleanup of expired buckets (~1% of calls).
  if (Math.random() < 0.01) {
    await db.delete(rateLimitBuckets).where(lt(rateLimitBuckets.resetAt, new Date())).catch(() => undefined);
  }
  return count > limit
    ? { ok: false, retryAfterSec: Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)), count }
    : { ok: true, retryAfterSec: 0, count };
}
