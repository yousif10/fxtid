/**
 * Supabase Storage tooling (server-side, uses SUPABASE_URL + SUPABASE_SECRET_KEY).
 *
 *   pnpm storage:setup            Create the PRIVATE photo bucket (idempotent) and verify it is not public.
 *   pnpm storage:migrate-local    Copy photos from STORAGE_DIR (local disk) into the bucket.
 *                                 Copy-only: local files are never deleted; existing objects are skipped.
 *
 * Add --confirm-production when FXT_DATA_ENVIRONMENT=production.
 */
import fs from "node:fs";
import path from "node:path";
import { requireProductionConfirmation } from "./_db";

const MAX_BYTES = 10 * 1024 * 1024;

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.SUPABASE_SECRET_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "employee-photos";
  if (!url || !key) {
    console.error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set (server-side values; never NEXT_PUBLIC_).");
    process.exit(1);
  }
  const headers: Record<string, string> = { apikey: key };
if (!key.startsWith("sb_secret_")) {
  headers.Authorization = `Bearer ${key}`;
}
return { url, key, bucket, headers };
}

async function setup() {
  const c = config();
  requireProductionConfirmation("configure Supabase Storage");
  const get = await fetch(`${c.url}/storage/v1/bucket/${encodeURIComponent(c.bucket)}`, { headers: c.headers });
  if (get.ok) {
    const b = (await get.json()) as { public?: boolean };
    if (b.public) {
      console.error(`Bucket "${c.bucket}" exists but is PUBLIC. Make it private in the Supabase dashboard (Storage → bucket → Edit) before continuing.`);
      process.exit(1);
    }
    console.log(`Bucket "${c.bucket}" already exists and is private.`);
    return;
  }
  const res = await fetch(`${c.url}/storage/v1/bucket`, {
    method: "POST",
    headers: { ...c.headers, "Content-Type": "application/json" },
    body: JSON.stringify({ id: c.bucket, name: c.bucket, public: false, file_size_limit: MAX_BYTES, allowed_mime_types: ["image/jpeg", "image/webp"] }),
  });
  if (!res.ok) {
    console.error(`Could not create bucket (HTTP ${res.status}): ${await res.text()}`);
    process.exit(1);
  }
  console.log(`Created private bucket "${c.bucket}" (jpeg/webp only, max ${MAX_BYTES / 1024 / 1024} MB).`);
}

const KEY_RE = /^photos\/[a-f0-9-]{36}(-thumb)?\.(jpg|webp)$/;

async function migrateLocal() {
  const c = config();
  requireProductionConfirmation("upload local photos to Supabase Storage");
  const root = path.resolve(process.env.STORAGE_DIR ?? "./storage");
  const dir = path.join(root, "photos");
  if (!fs.existsSync(dir)) {
    console.log(`No local photos found in ${dir}.`);
    return;
  }
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  for (const name of fs.readdirSync(dir).sort()) {
    const key = `photos/${name}`;
    if (!KEY_RE.test(key)) continue; // ignore temp/unknown files
    const body = fs.readFileSync(path.join(dir, name));
    const res = await fetch(`${c.url}/storage/v1/object/${encodeURIComponent(c.bucket)}/photos/${encodeURIComponent(name)}`, {
      method: "POST",
      headers: { ...c.headers, "Content-Type": name.endsWith(".webp") ? "image/webp" : "image/jpeg", "x-upsert": "false" },
      body: new Uint8Array(body),
    });
    if (res.ok) uploaded++;
    else if (res.status === 409 || (res.status === 400 && /exist|duplicate/i.test(await res.text()))) skipped++;
    else {
      failed++;
      console.error(`  ${key}: HTTP ${res.status}`);
    }
  }
  console.log(`Uploaded ${uploaded}, already present ${skipped}, failed ${failed}. Local files were NOT deleted.`);
  if (failed) process.exit(1);
}

const cmd = process.argv[2];
(cmd === "setup" ? setup() : cmd === "migrate-local" ? migrateLocal() : Promise.reject(new Error("Usage: storage.ts setup|migrate-local"))).catch(
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
