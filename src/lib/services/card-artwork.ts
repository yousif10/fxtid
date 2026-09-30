import "server-only";
import { renderCardSvg, type CardSide } from "@/lib/cards/render";
import { photoDataUri } from "@/lib/photos";
import { getSettings } from "@/lib/settings";
import { artworkWatermark, cardVerifyUrl, type CardRecord } from "./cards";

/**
 * Builds the card artwork SVG for a stored card. Printed details always come
 * from the card's issue-time snapshot, so reprints match the physical card.
 *
 * mode "preview": photo referenced by an authenticated same-origin URL.
 * mode "export":  photo embedded as a data URI (PNG/PDF/print).
 */
export async function buildCardSvg(card: CardRecord, side: CardSide, mode: "preview" | "export", idPrefix?: string) {
  const settings = await getSettings();
  const s = card.snapshot;
  const photoHref =
    mode === "export"
      ? await photoDataUri(s.photoKey)
      : s.photoKey
        ? `/api/cards/${card.id}/photo`
        : null;
  return renderCardSvg({
    side,
    layout: card.layout, // issue-time snapshot, never the template's current layout
    data: {
      fullName: s.fullName,
      positionName: s.positionName,
      departmentName: s.departmentName,
      employeeNumber: s.employeeNumber,
      cardNumber: card.cardNumber,
      issuedAt: card.issuedAt,
      expiresAt: card.expiresAt,
      verifyUrl: cardVerifyUrl(card.verificationToken),
      photoHref,
    },
    company: settings.company,
    colors: {
      primary: settings.branding.primaryColor,
      secondary: settings.branding.secondaryColor,
      accent: settings.branding.accentColor,
    },
    template: card.templateConfig,
    watermark: artworkWatermark(card, card.employeeIsDemo),
    idPrefix: idPrefix ?? `c${card.id.slice(0, 8)}`,
  });
}
