import { assertValidKey, StorageError, type ObjectStorage } from "./types";

/**
 * Supabase Storage driver (private bucket) using the Storage REST API directly.
 *
 * - Authenticates with the project's secret key (sb_secret_…) or legacy
 *   service_role key, which bypasses Storage RLS. It is read from server-only
 *   environment variables and never sent to the browser.
 * - The bucket must be PRIVATE with no policies for anon/authenticated users, so
 *   objects are unreachable except through this server code. No public or
 *   long-lived signed URLs are ever created.
 * - Error messages never include the key or response bodies that could echo it.
 */
export type SupabaseStorageOptions = {
  url: string; // https://<project>.supabase.co
  secretKey: string;
  bucket: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
};

const encodeKey = (key: string) => key.split("/").map(encodeURIComponent).join("/");

export function createSupabaseStorage(opts: SupabaseStorageOptions): ObjectStorage {
  const base = `${opts.url.replace(/\/+$/, "")}/storage/v1`;
  const doFetch = opts.fetch ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const bucket = encodeURIComponent(opts.bucket);
  const headers = (extra: Record<string, string> = {}) => ({
    apikey: opts.secretKey,
    Authorization: `Bearer ${opts.secretKey}`,
    ...extra,
  });

  const request = async (path: string, init: RequestInit) => {
    try {
      return await doFetch(`${base}${path}`, { ...init, cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
    } catch (err) {
      throw new StorageError(`Storage request failed (${(err as Error).name})`);
    }
  };

  const isNotFound = async (res: Response) => {
    if (res.status === 404) return true;
    if (res.status !== 400) return false;
    // Older Storage versions report missing objects as 400 { error: "not_found" }.
    const body = await res.text().catch(() => "");
    return /not[_ ]?found/i.test(body);
  };

  return {
    driver: "supabase",
    async put(key, data, contentType) {
      assertValidKey(key);
      const res = await request(`/object/${bucket}/${encodeKey(key)}`, {
        method: "POST",
        headers: headers({ "Content-Type": contentType, "x-upsert": "false", "cache-control": "no-store" }),
        body: new Uint8Array(data),
      });
      if (!res.ok) throw new StorageError(`Photo upload failed (HTTP ${res.status})`);
    },
    async get(key) {
      assertValidKey(key);
      const res = await request(`/object/authenticated/${bucket}/${encodeKey(key)}`, { method: "GET", headers: headers() });
      if (res.ok) return Buffer.from(await res.arrayBuffer());
      if (await isNotFound(res)) return null;
      throw new StorageError(`Photo download failed (HTTP ${res.status})`);
    },
    async delete(keys) {
      if (!keys.length) return;
      keys.forEach(assertValidKey);
      const res = await request(`/object/${bucket}`, {
        method: "DELETE",
        headers: headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({ prefixes: keys }),
      });
      if (!res.ok && !(await isNotFound(res))) throw new StorageError(`Photo delete failed (HTTP ${res.status})`);
    },
  };
}
