/**
 * Shared SVG building blocks for ID card layouts. All coordinates are in
 * millimetres (the SVG viewBox equals the physical card size). Every dynamic
 * string passes through escapeXml().
 */
import { LOGO_ASPECT, LOGO_INNER, LOGO_VIEWBOX } from "@/lib/brand/logo";
import { escapeXml, measureText, type FontWeight } from "./text";

export type CardSide = "front" | "back";

export type CardArtworkData = {
  fullName: string;
  positionName: string | null;
  departmentName: string | null;
  employeeNumber: string;
  cardNumber: string;
  issuedAt: string; // YYYY-MM-DD
  expiresAt: string; // YYYY-MM-DD
  verifyUrl: string;
  /** Data URI (exports) or same-origin URL (preview). Null renders a neutral placeholder. */
  photoHref: string | null;
};

export type CardCompanyInfo = {
  legalName: string;
  shortName: string;
  tagline: string | null;
  website: string | null;
  phone: string | null;
  supportEmail: string | null;
  address: string | null;
  returnText: string;
};

export type CardColors = { primary: string; secondary: string; accent: string };

export const INK = "#0F1B2D";
export const MUTED = "#5B6778";
export const LINE = "#C3CCDA";
export const SOFT = "#F3F5F9";
export const WHITE = "#FFFFFF";
const FONT = "Inter, 'Segoe UI', Arial, sans-serif";

export const n = (v: number) => String(Math.round(v * 1000) / 1000);

export type TextOpts = {
  x: number;
  y: number;
  size: number;
  weight: FontWeight;
  fill: string;
  anchor?: "start" | "middle" | "end";
  letterSpacing?: number;
  opacity?: number;
};

export function text(content: string, o: TextOpts): string {
  const attrs = [
    `x="${n(o.x)}"`,
    `y="${n(o.y)}"`,
    `font-family="${FONT}"`,
    `font-size="${n(o.size)}"`,
    `font-weight="${o.weight}"`,
    `fill="${o.fill}"`,
  ];
  if (o.anchor && o.anchor !== "start") attrs.push(`text-anchor="${o.anchor}"`);
  if (o.letterSpacing) attrs.push(`letter-spacing="${n(o.letterSpacing)}"`);
  if (o.opacity !== undefined) attrs.push(`fill-opacity="${n(o.opacity)}"`);
  return `<text ${attrs.join(" ")}>${escapeXml(content)}</text>`;
}

export function logo(x: number, y: number, height: number): string {
  const width = height * LOGO_ASPECT;
  return `<svg x="${n(x)}" y="${n(y)}" width="${n(width)}" height="${n(height)}" viewBox="${LOGO_VIEWBOX}" preserveAspectRatio="xMidYMid meet">${LOGO_INNER}</svg>`;
}

export function brandStripe(c: CardColors, W: number, height = 1.6): string {
  const split = W * 0.82;
  return (
    `<rect x="0" y="0" width="${n(split)}" height="${n(height)}" fill="${c.primary}"/>` +
    `<rect x="${n(split)}" y="0" width="${n(W - split)}" height="${n(height)}" fill="${c.secondary}"/>`
  );
}

/** Three tapered "speed lines" taken from the FXT logo's visual language. */
export function speedLines(x: number, y: number, length: number, color: string, opacity = 1): string {
  const lines = [
    { dy: 0, len: length },
    { dy: 1.05, len: length * 0.86 },
    { dy: 2.1, len: length * 0.66 },
  ];
  return lines
    .map(
      (l) =>
        `<path d="M${n(x + length - l.len)} ${n(y + l.dy + 0.18)} L${n(x + length)} ${n(y + l.dy)} L${n(x + length - 0.12)} ${n(y + l.dy + 0.5)} Z" fill="${color}" fill-opacity="${n(opacity)}"/>`,
    )
    .join("");
}

export function watermarkLayer(label: string, color: string, W: number, H: number): string {
  // Runs along the card's long axis: steep on portrait, shallow on landscape.
  const portrait = H > W;
  const long = Math.max(W, H);
  const angle = portrait ? -58 : -24;
  const size = Math.min(6.2, (long * 0.9) / Math.max(4, label.length) / 0.7);
  const ls = size * 0.08;
  const halo = text(label, { x: 0, y: size * 0.36, size, weight: 800, fill: WHITE, anchor: "middle", letterSpacing: ls }).replace(
    "<text ",
    `<text stroke="${WHITE}" stroke-width="${n(size * 0.16)}" stroke-linejoin="round" `,
  );
  return (
    `<g transform="translate(${n(W / 2)} ${n(H / 2)}) rotate(${angle})" pointer-events="none" opacity="0.8">` +
    halo +
    text(label, { x: 0, y: size * 0.36, size, weight: 800, fill: color, anchor: "middle", letterSpacing: ls }) +
    `</g>`
  );
}

export function roleLabelPill(label: string, rightX: number, y: number, fill: string): string {
  const size = 1.75;
  const ls = 0.22;
  const w = measureText(label, 800, size, ls) + 2.8;
  const h = 3.3;
  return (
    `<rect x="${n(rightX - w)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${n(h / 2)}" fill="${fill}"/>` +
    text(label, { x: rightX - w / 2, y: y + h / 2 + size * 0.36, size, weight: 800, fill: WHITE, anchor: "middle", letterSpacing: ls })
  );
}

export function titleCase(v: string): string {
  return v.toLowerCase().replace(/\b\p{L}/gu, (ch) => ch.toUpperCase());
}

