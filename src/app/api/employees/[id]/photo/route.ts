import { eq } from "drizzle-orm";
import { assertPermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { employees } from "@/lib/db/schema";
import { handleRouteError, imageResponse, jsonError, UUID_RE } from "@/lib/http";
import { readPhoto } from "@/lib/photos";

export const dynamic = "force-dynamic";

/** Current employee photo - authenticated administrators only. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await assertPermission("employees:read");
    const { id } = await params;
    if (!UUID_RE.test(id)) return jsonError(404, "Not found");
    const [emp] = await db.select({ photoKey: employees.photoKey }).from(employees).where(eq(employees.id, id)).limit(1);
    if (!emp?.photoKey) return jsonError(404, "Not found");
    const variant = new URL(req.url).searchParams.get("variant") === "full" ? "full" : "thumb";
    const buf = await readPhoto(emp.photoKey, variant);
    if (!buf) return jsonError(404, "Not found");
    return imageResponse(buf, variant === "full" ? "image/jpeg" : "image/webp", "private, no-store");
  } catch (err) {
    return handleRouteError(err);
  }
}
