import "server-only";
import { AuthorizationError } from "@/lib/auth/session";

export function jsonError(status: number, message: string) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

/** Maps thrown auth errors in route handlers to proper HTTP responses. */
export function handleRouteError(err: unknown) {
  if (err instanceof AuthorizationError) {
    return jsonError(err.message.includes("session") ? 401 : 403, err.message);
  }
  console.error("[route] unexpected error", err);
  return jsonError(500, "Internal error");
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function imageResponse(body: Buffer, contentType: string, cache: string) {
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": cache,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}
