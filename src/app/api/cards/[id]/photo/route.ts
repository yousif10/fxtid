import { assertPermission } from "@/lib/auth/session";
import { handleRouteError, imageResponse, jsonError, UUID_RE } from "@/lib/http";
import { readPhoto } from "@/lib/photos";
import { getCard } from "@/lib/services/cards";

export const dynamic = "force-dynamic";

/** Photo printed on a specific card (issue-time snapshot) - administrators only. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await assertPermission("cards:read");
    const { id } = await params;
    if (!UUID_RE.test(id)) return jsonError(404, "Not found");
    const card = await getCard(id);
    if (!card?.snapshot.photoKey) return jsonError(404, "Not found");
    const buf = await readPhoto(card.snapshot.photoKey, "full");
    if (!buf) return jsonError(404, "Not found");
    return imageResponse(buf, "image/jpeg", "private, no-store");
  } catch (err) {
    return handleRouteError(err);
  }
}
