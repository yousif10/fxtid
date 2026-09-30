import "server-only";
import { z } from "zod";
import { AuthorizationError } from "@/lib/auth/session";
import { DomainError } from "@/lib/services/cards";
import { PhotoValidationError } from "@/lib/photos";

export type ActionState<T = unknown> = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  data?: T;
  /** Changes on every submission so client effects (toasts) can react. */
  at?: number;
} | null;

export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    out[key] ??= issue.message;
  }
  return out;
}

/**
 * Runs a server action body and converts expected failures into a typed,
 * user-safe result. Unexpected errors are logged server-side and never leak
 * internals (SQL, stack traces) to the browser.
 */
export async function runAction<T>(fn: () => Promise<ActionState<T>>): Promise<ActionState<T>> {
  try {
    return { ...(await fn()), at: Date.now() } as ActionState<T>;
  } catch (err) {
    // Let Next.js navigation (redirect / notFound) propagate.
    if (err && typeof err === "object" && "digest" in err && typeof (err as { digest: unknown }).digest === "string") {
      const digest = (err as { digest: string }).digest;
      if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR") || digest === "NEXT_NOT_FOUND") throw err;
    }
    if (err instanceof z.ZodError) {
      return { ok: false, message: "Please correct the highlighted fields.", fieldErrors: fieldErrorsFrom(err), at: Date.now() };
    }
    if (err instanceof DomainError) {
      return { ok: false, message: err.message, fieldErrors: err.field ? { [err.field]: err.message } : undefined, at: Date.now() };
    }
    if (err instanceof AuthorizationError || err instanceof PhotoValidationError) {
      return { ok: false, message: err.message, at: Date.now() };
    }
    console.error("[action] unexpected error", err);
    return { ok: false, message: "Something went wrong. Please try again.", at: Date.now() };
  }
}

export function safeRedirectPath(value: unknown, fallback = "/dashboard"): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}
