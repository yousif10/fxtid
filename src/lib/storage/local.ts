import fs from "node:fs/promises";
import path from "node:path";
import { assertValidKey, type ObjectStorage } from "./types";

/**
 * Local-disk driver for development and self-hosted (Docker volume) deployments.
 * Never used on Vercel, whose filesystem is not persistent.
 */
export function createLocalStorage(rootDir: string): ObjectStorage {
  const root = path.resolve(/*turbopackIgnore: true*/ process.cwd(), rootDir);

  const resolveKey = (key: string) => {
    assertValidKey(key);
    const full = path.resolve(/*turbopackIgnore: true*/ root, key);
    if (!full.startsWith(root + path.sep)) throw new Error("Invalid storage key");
    return full;
  };

  return {
    driver: "local",
    async put(key, data) {
      const full = resolveKey(key);
      await fs.mkdir(path.dirname(full), { recursive: true });
      // Write-then-rename so readers never see a partial file.
      const tmp = `${full}.${process.pid}.${Date.now()}.tmp`;
      await fs.writeFile(tmp, data, { mode: 0o640 });
      await fs.rename(tmp, full);
    },
    async get(key) {
      try {
        return await fs.readFile(resolveKey(key));
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw err;
      }
    },
    async delete(keys) {
      for (const key of keys) {
        try {
          await fs.unlink(resolveKey(key));
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
        }
      }
    },
  };
}
