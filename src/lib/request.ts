import "server-only";
import { headers } from "next/headers";
import { env } from "@/lib/env";

/** Best-effort client IP. Only trusts X-Forwarded-For when TRUST_PROXY=true. */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  if (env.TRUST_PROXY === "true") {
    const fwd = h.get("x-forwarded-for");
    if (fwd) return fwd.split(",")[0]!.trim();
    const real = h.get("x-real-ip");
    if (real) return real.trim();
  }
  return h.get("x-real-ip") ?? "local";
}

export async function getUserAgent(): Promise<string | null> {
  const h = await headers();
  return h.get("user-agent")?.slice(0, 300) ?? null;
}
