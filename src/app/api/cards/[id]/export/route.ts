import { assertPermission } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { renderCardPdf, renderCardPng } from "@/lib/cards/export";
import type { CardSide } from "@/lib/cards/render";
import { handleRouteError, jsonError, UUID_RE } from "@/lib/http";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";
import { buildCardSvg } from "@/lib/services/card-artwork";
import { getCard } from "@/lib/services/cards";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// PNG/PDF rendering (resvg, pdfkit, sharp) needs the Node.js runtime and a little time at 600 DPI.
export const maxDuration = 30;

/**
 * GET /api/cards/:id/export?format=pdf|png&side=front|back|both[&dpi=300|600]
 * PNG supports a single side; PDF supports front, back or both (2 pages, duplex).
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await assertPermission("cards:read");
    const { id } = await params;
    if (!UUID_RE.test(id)) return jsonError(404, "Not found");
    if (!(await rateLimit(rateLimitKey("export", user.id), 60, 60_000)).ok) return jsonError(429, "Too many export requests");

    const url = new URL(req.url);
    const format = url.searchParams.get("format");
    const side = url.searchParams.get("side") ?? "both";
    const dpi = url.searchParams.get("dpi") === "300" ? 300 : 600;
    if (format !== "pdf" && format !== "png") return jsonError(400, "format must be pdf or png");
    if (!["front", "back", "both"].includes(side)) return jsonError(400, "side must be front, back or both");
    if (format === "png" && side === "both") return jsonError(400, "PNG export supports one side at a time");

    const card = await getCard(id);
    if (!card) return jsonError(404, "Not found");
    const sides: CardSide[] = side === "both" ? ["front", "back"] : [side as CardSide];
    const svgs = await Promise.all(sides.map((s) => buildCardSvg(card, s, "export")));
    const base = `${card.cardNumber}-${card.orientation}-${side}`;

    let body: Buffer;
    let type: string;
    let filename: string;
    if (format === "png") {
      body = renderCardPng(svgs[0], dpi);
      type = "image/png";
      filename = `${base}-${dpi}dpi.png`;
    } else {
      const settings = await getSettings();
      body = await renderCardPdf(svgs, {
        title: `${card.snapshot.fullName} - ${card.cardNumber}`,
        author: settings.company.legalName,
      });
      type = "application/pdf";
      filename = `${base}.pdf`;
    }

    await audit({
      actor: { id: user.id, email: user.email },
      action: "card.exported",
      entityType: "card",
      entityId: card.id,
      summary: `${card.cardNumber} exported as ${format.toUpperCase()} (${side})`,
      metadata: { format, side, dpi: format === "png" ? dpi : undefined },
      ip: await getClientIp(),
    });

    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": type,
        "Content-Disposition": `attachment; filename="${filename.replace(/[^A-Za-z0-9._-]/g, "_")}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
