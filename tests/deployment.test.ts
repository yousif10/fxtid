/**
 * Deployment hardening: storage adapters, photo rollback, serverless-safe rate
 * limiting and the Vercel/preview configuration interlock.
 */
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { preparedSize } from "@/lib/client/prepare-photo";
import { getDb } from "@/lib/db";
import { employees, users } from "@/lib/db/schema";
import { checkDeploymentConfig, env } from "@/lib/env";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { setStorageForTesting } from "@/lib/storage";
import { createLocalStorage } from "@/lib/storage/local";
import { createSupabaseStorage } from "@/lib/storage/supabase";
import { isValidStorageKey, StorageError, type ObjectStorage } from "@/lib/storage/types";
import { readPhoto, storePhoto } from "@/lib/photos";
import { hashPassword } from "@/lib/auth/password";
import { createEmployee, setEmployeePhoto } from "@/lib/services/employees";

const SECRET = "sb_secret_test_value_that_must_never_leak_0123456789";
const KEY = `photos/${randomUUID()}.jpg`;

/** In-memory storage with optional failure injection. */
function memoryStorage(opts: { failPutOn?: (key: string) => boolean } = {}) {
  const objects = new Map<string, Buffer>();
  const storage: ObjectStorage = {
    driver: "local",
    async put(key, data) {
      if (opts.failPutOn?.(key)) throw new StorageError("injected failure");
      objects.set(key, Buffer.from(data));
    },
    async get(key) {
      return objects.get(key) ?? null;
    },
    async delete(keys) {
      keys.forEach((k) => objects.delete(k));
    },
  };
  return { storage, objects };
}

describe("storage keys", () => {
  it("accepts only server-generated photo keys", () => {
    expect(isValidStorageKey(KEY)).toBe(true);
    expect(isValidStorageKey(KEY.replace(".jpg", "-thumb.webp"))).toBe(true);
    for (const bad of ["../etc/passwd", "photos/../../x.jpg", "photos/evil.jpg", "photos/x.png", `other/${randomUUID()}.jpg`, `photos/${randomUUID()}.jpg?x=1`]) {
      expect(isValidStorageKey(bad), bad).toBe(false);
    }
  });
});

describe("Supabase Storage driver", () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fakeFetch = (responder: (url: string, init: RequestInit) => Response) =>
    (async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return responder(String(url), init ?? {});
    }) as typeof fetch;
  afterEach(() => void (calls.length = 0));

  it("uploads to the private bucket with server-side credentials and no upsert", async () => {
    const s = createSupabaseStorage({ url: "https://proj.supabase.co/", secretKey: SECRET, bucket: "employee-photos", fetch: fakeFetch(() => new Response("{}", { status: 200 })) });
    await s.put(KEY, Buffer.from("jpeg"), "image/jpeg");
    expect(calls[0].url).toBe(`https://proj.supabase.co/storage/v1/object/employee-photos/${KEY}`);
    const h = calls[0].init.headers as Record<string, string>;
    expect(h.apikey).toBe(SECRET);
    expect(h.Authorization).toBe(`Bearer ${SECRET}`);
    expect(h["x-upsert"]).toBe("false");
    expect(h["Content-Type"]).toBe("image/jpeg");
    expect(calls[0].init.method).toBe("POST");
  });

  it("downloads through the authenticated endpoint and maps not-found to null", async () => {
    const missingKey = `photos/${randomUUID()}.jpg`;
    const s = createSupabaseStorage({
      url: "https://proj.supabase.co",
      secretKey: SECRET,
      bucket: "employee-photos",
      fetch: fakeFetch((url) =>
        url.endsWith(missingKey)
          ? new Response('{"error":"not_found","message":"Object not found"}', { status: 400 }) // older Storage API style
          : new Response(new Uint8Array([1, 2, 3]), { status: 200 }),
      ),
    });
    expect([...(await s.get(KEY))!]).toEqual([1, 2, 3]);
    expect(calls[0].url).toContain("/storage/v1/object/authenticated/employee-photos/");
    expect(await s.get(missingKey)).toBeNull();
    const s404 = createSupabaseStorage({ url: "https://p.supabase.co", secretKey: SECRET, bucket: "b-1", fetch: fakeFetch(() => new Response("", { status: 404 })) });
    expect(await s404.get(KEY)).toBeNull();
    const s500 = createSupabaseStorage({ url: "https://p.supabase.co", secretKey: SECRET, bucket: "b-1", fetch: fakeFetch(() => new Response("", { status: 500 })) });
    await expect(s500.get(KEY)).rejects.toThrow(StorageError);
  });

  it("never leaks the secret key in errors and rejects invalid keys before any request", async () => {
    const s = createSupabaseStorage({ url: "https://proj.supabase.co", secretKey: SECRET, bucket: "employee-photos", fetch: fakeFetch(() => new Response(`denied ${SECRET}`, { status: 500 })) });
    const err = await s.put(KEY, Buffer.from("x"), "image/jpeg").catch((e: Error) => e);
    expect(err).toBeInstanceOf(StorageError);
    expect((err as Error).message).not.toContain(SECRET);
    expect((err as Error).message).toContain("HTTP 500");
    const n = calls.length;
    await expect(s.get("../../secrets.txt")).rejects.toThrow(/Invalid storage key/);
    expect(calls.length).toBe(n);
  });

  it("deletes objects in one request and tolerates missing ones", async () => {
    const s = createSupabaseStorage({ url: "https://proj.supabase.co", secretKey: SECRET, bucket: "employee-photos", fetch: fakeFetch(() => new Response("[]", { status: 200 })) });
    await s.delete([KEY, KEY.replace(".jpg", "-thumb.webp")]);
    expect(calls[0].init.method).toBe("DELETE");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ prefixes: [KEY, KEY.replace(".jpg", "-thumb.webp")] });
  });
});

describe("local storage driver", () => {
  it("round-trips objects inside its root and refuses traversal", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fxt-store-"));
    const s = createLocalStorage(dir);
    await s.put(KEY, Buffer.from("hello"), "image/jpeg");
    expect((await s.get(KEY))!.toString()).toBe("hello");
    await s.delete([KEY]);
    expect(await s.get(KEY)).toBeNull();
    await expect(s.put("../outside.jpg", Buffer.from("x"), "image/jpeg")).rejects.toThrow(/Invalid storage key/);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe("photo storage failure handling", () => {
  let actor: { id: string; email: string };
  beforeAll(async () => {
    await migrate(getDb() as unknown as PgliteDatabase, { migrationsFolder: "./db/migrations" });
    const [u] = await getDb()
      .insert(users)
      .values({ email: "deploy-test@example.invalid", fullName: "Deploy Test", role: "super_admin", passwordHash: await hashPassword("deploy-test-pass-1") })
      .returning();
    actor = { id: u.id, email: u.email };
  });
  afterEach(() => setStorageForTesting(undefined));

  const photo = { master: Buffer.from("master-bytes"), thumb: Buffer.from("thumb-bytes") };

  it("removes the master if the thumbnail upload fails", async () => {
    const mem = memoryStorage({ failPutOn: (k) => k.endsWith("-thumb.webp") });
    setStorageForTesting(mem.storage);
    await expect(storePhoto(photo)).rejects.toThrow(StorageError);
    expect(mem.objects.size).toBe(0);
  });

  it("keeps the existing photo when a replacement upload fails", async () => {
    const mem = memoryStorage();
    setStorageForTesting(mem.storage);
    const emp = await createEmployee(actor, { employeeNumber: null, fullName: "Photo Keeper", displayName: null, email: null, phone: null, departmentId: null, positionId: null, employmentStatus: "active", startDate: null, endDate: null, notes: null }, null, { allowManualNumber: false });
    await setEmployeePhoto(actor, emp.id, photo, null);
    const [before] = await getDb().select().from(employees).where(eq(employees.id, emp.id));
    expect(before.photoKey).toBeTruthy();

    const failing = memoryStorage({ failPutOn: () => true });
    for (const [k, v] of mem.objects) failing.objects.set(k, v);
    setStorageForTesting(failing.storage);
    await expect(setEmployeePhoto(actor, emp.id, { master: Buffer.from("new"), thumb: Buffer.from("new-t") }, null)).rejects.toThrow();
    const [after] = await getDb().select().from(employees).where(eq(employees.id, emp.id));
    expect(after.photoKey).toBe(before.photoKey);
    expect((await readPhoto(after.photoKey!, "full"))!.toString()).toBe("master-bytes");
  });

  it("cleans up the new upload if the database update fails, keeping the old photo", async () => {
    const mem = memoryStorage();
    setStorageForTesting(mem.storage);
    const emp = await createEmployee(actor, { employeeNumber: null, fullName: "Rollback Case", displayName: null, email: null, phone: null, departmentId: null, positionId: null, employmentStatus: "active", startDate: null, endDate: null, notes: null }, null, { allowManualNumber: false });
    await setEmployeePhoto(actor, emp.id, photo, null);
    const [before] = await getDb().select().from(employees).where(eq(employees.id, emp.id));
    const objectsBefore = new Set(mem.objects.keys());

    // Force the DB transaction to fail after the upload by making the audit insert violate a constraint.
    await getDb().execute(sql`alter table audit_logs add constraint tmp_block_photo check (action <> 'employee.photo_updated') not valid`);
    try {
      await expect(setEmployeePhoto(actor, emp.id, { master: Buffer.from("n"), thumb: Buffer.from("nt") }, null)).rejects.toThrow();
    } finally {
      await getDb().execute(sql`alter table audit_logs drop constraint tmp_block_photo`);
    }
    const [after] = await getDb().select().from(employees).where(eq(employees.id, emp.id));
    expect(after.photoKey).toBe(before.photoKey);
    expect(new Set(mem.objects.keys())).toEqual(objectsBefore); // orphaned new objects removed, old kept
  });
});

describe("serverless-safe rate limiting (Postgres-backed)", () => {
  it("counts across calls, blocks over the limit and hashes keys", async () => {
    const key = rateLimitKey("test-login", `203.0.113.${Math.floor(Math.random() * 250)}`);
    expect(key).toMatch(/^[a-f0-9]{64}$/);
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await rateLimit(key, 3, 60_000));
    expect(results.map((r) => r.ok)).toEqual([true, true, true, false]);
    expect(results[3].retryAfterSec).toBeGreaterThan(0);
    const rows = (await getDb().execute(sql`select key from rate_limit_buckets where key like '%203.0.113%'`)) as unknown as { rows: unknown[] };
    expect(rows.rows).toHaveLength(0); // raw IPs are never stored
  });

  it("resets after the window expires", async () => {
    const key = rateLimitKey("test-window", randomUUID());
    await rateLimit(key, 1, 60_000);
    expect((await rateLimit(key, 1, 60_000)).ok).toBe(false);
    await getDb().execute(sql`update rate_limit_buckets set reset_at = now() - interval '1 second' where key = ${key}`);
    expect((await rateLimit(key, 1, 60_000)).ok).toBe(true);
  });

  it("is concurrency-safe (atomic upsert)", async () => {
    const key = rateLimitKey("test-concurrent", randomUUID());
    const results = await Promise.all(Array.from({ length: 10 }, () => rateLimit(key, 5, 60_000)));
    expect(results.filter((r) => r.ok)).toHaveLength(5);
  });
});

describe("deployment configuration interlock", () => {
  const base = {
    ...env,
    NODE_ENV: "production" as const,
    VERCEL: "1",
    DATABASE_URL: "postgres://user:pw@db.example:6543/postgres",
    STORAGE_DRIVER: "supabase" as const,
    SUPABASE_URL: "https://proj.supabase.co",
    SUPABASE_SECRET_KEY: SECRET,
  };

  it("accepts a correctly configured production deployment", () => {
    expect(checkDeploymentConfig({ ...base, VERCEL_ENV: "production", FXT_DATA_ENVIRONMENT: "production", APP_URL: "https://id.fxt-ltd.co.uk" })).toEqual([]);
  });

  it("refuses preview deployments wired to production data or the production domain", () => {
    const p = checkDeploymentConfig({ ...base, VERCEL_ENV: "preview", FXT_DATA_ENVIRONMENT: "production", APP_URL: "https://id.fxt-ltd.co.uk" }).join(" ");
    expect(p).toMatch(/production data/);
    expect(p).toMatch(/id\.fxt-ltd\.co\.uk/);
    expect(checkDeploymentConfig({ ...base, VERCEL_ENV: "preview", FXT_DATA_ENVIRONMENT: "preview", APP_URL: "https://fxt-id-git-x.vercel.app" })).toEqual([]);
  });

  it("refuses PGlite, local disk or a missing data-environment marker on Vercel", () => {
    const p = checkDeploymentConfig({ ...base, VERCEL_ENV: "production", DATABASE_URL: undefined, STORAGE_DRIVER: "local", FXT_DATA_ENVIRONMENT: undefined, APP_URL: "https://id.fxt-ltd.co.uk" }).join(" ");
    expect(p).toMatch(/DATABASE_URL is required/);
    expect(p).toMatch(/STORAGE_DRIVER must be 'supabase'/);
    expect(p).toMatch(/FXT_DATA_ENVIRONMENT must be set/);
  });

  it("requires production to declare itself and use https", () => {
    expect(checkDeploymentConfig({ ...base, VERCEL_ENV: "production", FXT_DATA_ENVIRONMENT: "preview", APP_URL: "https://id.fxt-ltd.co.uk" }).join(" ")).toMatch(/must set FXT_DATA_ENVIRONMENT=production/);
    expect(checkDeploymentConfig({ ...base, VERCEL: undefined, VERCEL_ENV: undefined, FXT_DATA_ENVIRONMENT: "production", APP_URL: "http://id.fxt-ltd.co.uk" }).join(" ")).toMatch(/https/);
  });

  it("requires Supabase credentials when the Supabase driver is selected", () => {
    expect(checkDeploymentConfig({ ...base, VERCEL_ENV: "production", FXT_DATA_ENVIRONMENT: "production", APP_URL: "https://id.fxt-ltd.co.uk", SUPABASE_SECRET_KEY: undefined }).join(" ")).toMatch(/SUPABASE_SECRET_KEY/);
  });
});

describe("browser upload preparation", () => {
  it("caps large crops and upscales tiny ones while keeping 3:4", () => {
    expect(preparedSize({ x: 0, y: 0, width: 3000, height: 4000 })).toEqual({ width: 1320, height: 1760 });
    expect(preparedSize({ x: 0, y: 0, width: 120, height: 160 })).toEqual({ width: 240, height: 320 });
    expect(preparedSize({ x: 0, y: 0, width: 600, height: 800 })).toEqual({ width: 600, height: 800 });
  });
});

describe("no secrets reach client bundles", () => {
  it("server-only modules guard env, storage and database access", () => {
    for (const f of ["src/lib/env.ts", "src/lib/storage/index.ts", "src/lib/db/index.ts", "src/lib/rate-limit.ts", "src/lib/photos.ts"]) {
      expect(fs.readFileSync(f, "utf8"), f).toMatch(/^import "server-only";/m);
    }
    const all = execFind("src");
    const publicVars = all.flatMap((f) => [...fs.readFileSync(f, "utf8").matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)].map((m) => m[0]));
    expect(publicVars).toEqual([]);
  });
});

function execFind(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? execFind(p) : /\.(ts|tsx)$/.test(d.name) ? [p] : [];
  });
}

