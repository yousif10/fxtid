/**
 * FXT ID card artwork renderer.
 *
 * Produces a self-contained SVG in millimetre user units (viewBox = physical
 * CR80 size in the layout's orientation). The same SVG is used for:
 *  - on-screen preview (inline SVG, scaled by CSS only),
 *  - browser printing (width/height in mm => exact physical size),
 *  - PNG export (resvg, 300/600 DPI),
 *  - vector PDF export (pdfkit).
 *
 * Layouts are looked up in a registry, so new designs/orientations are added by
 * registering a renderer - nothing else in the pipeline changes.
 * All colours are explicit so dashboard dark mode can never alter the artwork.
 */
import { landscapeV1 } from "./layouts/landscape-v1";
import { portraitV1 } from "./layouts/portrait-v1";
import { watermarkLayer, type CardArtworkData, type CardColors, type CardCompanyInfo, type CardSide } from "./svg";
import { dimensionsOfLayout, resolveLayout, type CardLayoutKey, type CardTemplateConfig } from "./templates";
import { escapeXml } from "./text";

export type { CardArtworkData, CardColors, CardCompanyInfo, CardSide };

export type RenderCardOptions = {
  side: CardSide;
  /** Physical design; defaults to the original portrait layout. */
  layout?: CardLayoutKey | string | null;
  data: CardArtworkData;
  company: CardCompanyInfo;
  colors: CardColors;
  template: CardTemplateConfig;
  /** Diagonal overlay for non-issuable artwork, e.g. "SPECIMEN" or "VOID - REPLACED". */
  watermark?: string | null;
  /** Unique prefix for SVG ids when several cards share one HTML document. */
  idPrefix?: string;
  /** Emit physical width/height attributes (mm). Default true. */
  physicalSize?: boolean;
};

export type CardLayoutRenderer = {
  front: (o: RenderCardOptions, id: (s: string) => string) => string;
  back: (o: RenderCardOptions, id: (s: string) => string) => string;
};

const RENDERERS: Record<CardLayoutKey, CardLayoutRenderer> = {
  "fxt-portrait-v1": portraitV1,
  "fxt-landscape-v1": landscapeV1,
};

export function renderCardSvg(o: RenderCardOptions): string {
  const layout = resolveLayout(o.layout);
  const { widthMm: W, heightMm: H } = dimensionsOfLayout(layout);
  const prefix = (o.idPrefix ?? "fxt").replace(/[^a-zA-Z0-9_-]/g, "");
  const id = (s: string) => `${prefix}-${o.side}-${s}`;
  const body = RENDERERS[layout][o.side](o, id);
  const overlay = o.watermark ? watermarkLayer(o.watermark.toUpperCase(), o.colors.secondary, W, H) : "";
  const size = o.physicalSize === false ? "" : ` width="${W}mm" height="${H}mm"`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}"${size} role="img" aria-label="${o.side === "front" ? "Front" : "Back"} of ID card for ${escapeXml(o.data.fullName)}">` +
    body +
    overlay +
    `</svg>`
  );
}
