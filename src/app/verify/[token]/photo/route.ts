import { imageResponse, jsonError } from "@/lib/http";
import { readPhoto } from "@/lib/photos";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";
import { verifiedPhotoKey } from "@/lib/services/verification";

export const dynamic = "force-dynamic";

/** Public photo for the verification page - released only while the card is valid. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const ip = await getClientIp();
  if (!(await rateLimit(rateLimitKey("verify-photo", ip), 60, 60_000)).ok) return jsonError(429, "Too many requests");
  const { token } = await params;
  const key = await verifiedPhotoKey(token.slice(0, 64));
  if (!key) return jsonError(404, "Not found");
  const buf = await readPhoto(key, "full");
  if (!buf) return jsonError(404, "Not found");
  return imageResponse(buf, "image/jpeg", "no-store");
}
