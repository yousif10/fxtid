/**
 * Layout "fxt-portrait-v1" - the original FXT portrait CR80 card
 * (53.98 x 85.6 mm). Geometry is unchanged from the first release so issued
 * portrait cards always reprint identically.
 */
import { LOGO_ASPECT } from "@/lib/brand/logo";
import { formatCardDate } from "@/lib/dates";
import { qrGroup } from "@/lib/qr";
import type { CardLayoutRenderer, RenderCardOptions } from "../render";
import {
  brandStripe as stripe,
  INK,
  LINE,
  logo,
  MUTED,
  n,
  roleLabelPill,
  SOFT,
  speedLines,
  text,
  titleCase,
  WHITE,
} from "../svg";
import { ellipsize, escapeXml, fitText, wrapText, type FontWeight } from "../text";

const W = 53.98;
const H = 85.6;
const M = 3.6; // safe margin from trim edge (mm)
const brandStripe = (c: RenderCardOptions["colors"]) => stripe(c, W);

function renderFront(o: RenderCardOptions, id: (s: string) => string): string {
  const { data, colors: c, template: t } = o;
  const accent = t.accent === "primary" ? c.primary : c.secondary;
  const parts: string[] = [];

  parts.push(`<rect width="${n(W)}" height="${n(H)}" fill="${WHITE}"/>`);
  // Subtle brand motif: faint ring (echoes the logo's location pin) top-right.
  parts.push(
    `<circle cx="${n(W + 2)}" cy="4" r="17" fill="none" stroke="${SOFT}" stroke-width="5"/>`,
    `<circle cx="${n(W + 2)}" cy="4" r="9.5" fill="none" stroke="${SOFT}" stroke-width="1.2"/>`,
  );
  parts.push(brandStripe(c));

  // Header: official logo + card title.
  const logoH = 15.2;
  parts.push(logo(M - 0.2, 4.1, logoH));
  const headRight = W - M;
  const headLeft = M + logoH * LOGO_ASPECT + 2;
  // Title block is vertically centred against the logo (logo spans y 4.1 -> 19.3).
  const titleFit = fitText(t.cardTitle, { weight: 800, maxSize: 1.85, minSize: 1.4, maxWidth: headRight - headLeft, maxLines: 2, letterSpacing: 0.26 });
  const titleLh = 2.5;
  const blockH = (titleFit.lines.length - 1) * titleLh + 3.4 + (t.roleLabel ? 4.6 : 0);
  let ty = 4.1 + logoH / 2 - blockH / 2 + titleFit.size * 0.72;
  titleFit.lines.forEach((line, i) =>
    parts.push(text(line, { x: headRight, y: ty + i * titleLh, size: titleFit.size, weight: 800, fill: c.primary, anchor: "end", letterSpacing: 0.26 })),
  );
  ty += (titleFit.lines.length - 1) * titleLh;
  parts.push(speedLines(headRight - 10.5, ty + 1.5, 10.5, c.secondary));
  if (t.roleLabel) parts.push(roleLabelPill(t.roleLabel, headRight, ty + 5.3, accent));

  // Name is fitted first: a two-line name shrinks the photo slightly so the text
  // block never collides with the identity panel.
  const textW = W - 2 * M;
  const nameFit = fitText(data.fullName.toUpperCase(), { weight: 800, maxSize: 3.55, minSize: 2.45, maxWidth: textW, maxLines: 2, letterSpacing: 0.05 });
  const nameLh = nameFit.size * 1.16;
  const extraText = (nameFit.lines.length - 1) * nameLh;

  // Photograph (3:4) with navy frame.
  const ph = 32.5 - extraText;
  const pw = ph * 0.75;
  const px = (W - pw) / 2;
  const py = 21.6;
  parts.push(
    `<rect x="${n(px - 0.75)}" y="${n(py - 0.75)}" width="${n(pw + 1.5)}" height="${n(ph + 1.5)}" rx="2.1" fill="${c.primary}"/>`,
    `<rect x="${n(px)}" y="${n(py)}" width="${n(pw)}" height="${n(ph)}" rx="1.5" fill="${SOFT}"/>`,
  );
  if (data.photoHref) {
    parts.push(
      `<image x="${n(px)}" y="${n(py)}" width="${n(pw)}" height="${n(ph)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id("photo")})" href="${escapeXml(data.photoHref)}"/>`,
    );
  } else {
    // Neutral silhouette placeholder.
    parts.push(
      `<g clip-path="url(#${id("photo")})" fill="${LINE}">` +
        `<circle cx="${n(W / 2)}" cy="${n(py + ph * 0.38)}" r="${n(pw * 0.22)}"/>` +
        `<ellipse cx="${n(W / 2)}" cy="${n(py + ph * 0.98)}" rx="${n(pw * 0.42)}" ry="${n(ph * 0.3)}"/>` +
        `</g>`,
      text("NO PHOTO", { x: W / 2, y: py + ph - 2, size: 1.4, weight: 700, fill: MUTED, anchor: "middle", letterSpacing: 0.2 }),
    );
  }
  // Red accent tab under the photo.
  parts.push(`<rect x="${n(W / 2 - 4)}" y="${n(py + ph + 0.75)}" width="8" height="0.9" rx="0.45" fill="${c.secondary}"/>`);

  // Name, position, department.
  let y = py + ph + 5.9;
  nameFit.lines.forEach((line, i) =>
    parts.push(text(line, { x: W / 2, y: y + i * nameLh, size: nameFit.size, weight: 800, fill: c.primary, anchor: "middle", letterSpacing: 0.05 })),
  );
  y += (nameFit.lines.length - 1) * nameLh;
  if (data.positionName) {
    y += 3.3;
    parts.push(
      text(ellipsize(data.positionName.toUpperCase(), 700, 1.95, textW, 0.2), { x: W / 2, y, size: 1.95, weight: 700, fill: accent === c.primary ? c.secondary : accent, anchor: "middle", letterSpacing: 0.2 }),
    );
  }
  if (t.showDepartment && data.departmentName) {
    y += 2.8;
    parts.push(text(ellipsize(data.departmentName, 500, 1.85, textW), { x: W / 2, y, size: 1.85, weight: 500, fill: MUTED, anchor: "middle" }));
  }

  // Identity panel with slanted top edge + red rule.
  const top = 68.2;
  const slant = 2.2;
  parts.push(
    `<path d="M0 ${n(top + slant - 0.9)} L${n(W)} ${n(top - 0.9)} L${n(W)} ${n(top - 0.3)} L0 ${n(top + slant - 0.3)} Z" fill="${c.secondary}"/>`,
    `<path d="M0 ${n(top + slant)} L${n(W)} ${n(top)} L${n(W)} ${n(H)} L0 ${n(H)} Z" fill="url(#${id("panel")})"/>`,
  );
  const qrSize = 15.4;
  const qrX = W - M + 0.4 - qrSize;
  const qrY = H - 3.2 - qrSize;
  const leftW = t.showQrOnFront ? qrX - M - 1.6 : W - 2 * M;
  const labelOpts = { size: 1.3, weight: 700 as const, fill: WHITE, opacity: 0.66, letterSpacing: 0.24 };
  parts.push(text("EMPLOYEE NO.", { x: M, y: 74.4, ...labelOpts }));
  const numFit = fitText(data.employeeNumber, { weight: 800, maxSize: 3.0, minSize: 2.0, maxWidth: leftW, maxLines: 1, letterSpacing: 0.08 });
  parts.push(text(numFit.lines[0], { x: M, y: 77.6, size: numFit.size, weight: 800, fill: WHITE, letterSpacing: 0.08 }));
  parts.push(text("VALID UNTIL", { x: M, y: 80.7, ...labelOpts }));
  parts.push(text(formatCardDate(data.expiresAt), { x: M, y: 83.3, size: 2.15, weight: 700, fill: WHITE, letterSpacing: 0.08 }));
  if (t.showQrOnFront) {
    parts.push(`<rect x="${n(qrX - 0.5)}" y="${n(qrY - 0.5)}" width="${n(qrSize + 1)}" height="${n(qrSize + 1)}" rx="1.2" fill="${WHITE}"/>`);
    parts.push(qrGroup(data.verifyUrl, qrX, qrY, qrSize, "#000000"));
  }

  const defs =
    `<clipPath id="${id("photo")}"><rect x="${n(px)}" y="${n(py)}" width="${n(pw)}" height="${n(ph)}" rx="1.5"/></clipPath>` +
    `<linearGradient id="${id("panel")}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.primary}"/><stop offset="1" stop-color="${c.accent}"/></linearGradient>`;
  return `<defs>${defs}</defs>${parts.join("")}`;
}

function renderBack(o: RenderCardOptions, id: (s: string) => string): string {
  const { data, colors: c, template: t, company } = o;
  const parts: string[] = [];
  const textW = W - 2 * M;

  parts.push(`<rect width="${n(W)}" height="${n(H)}" fill="${WHITE}"/>`);
  parts.push(brandStripe(c));

  // Header
  const logoH = 10.2;
  parts.push(logo(M - 0.2, 4.0, logoH));
  const hx = M + logoH * LOGO_ASPECT + 1.8;
  const hw = W - M - hx;
  const legal = fitText(company.legalName.toUpperCase(), { weight: 800, maxSize: 1.75, minSize: 1.35, maxWidth: hw, maxLines: 2, letterSpacing: 0.12 });
  legal.lines.forEach((line, i) =>
    parts.push(text(line, { x: hx, y: 8.2 + i * (legal.size * 1.25), size: legal.size, weight: 800, fill: c.primary, letterSpacing: 0.12 })),
  );
  const subY = 8.2 + (legal.lines.length - 1) * legal.size * 1.25 + 2.5;
  parts.push(text(ellipsize(titleCase(t.cardTitle), 500, 1.5, hw), { x: hx, y: subY, size: 1.5, weight: 500, fill: MUTED }));
  parts.push(`<rect x="${n(M)}" y="16.4" width="${n(textW)}" height="0.2" fill="${LINE}"/>`);

  // QR verification block with scanner-corner brackets.
  const qs = 22;
  const qx = (W - qs) / 2;
  const qy = 19.8;
  parts.push(qrGroup(data.verifyUrl, qx, qy, qs, "#000000"));
  const g = 1.1; // gap around QR
  const bl = 3.2; // bracket length
  const bw = 0.5;
  const x0 = qx - g;
  const y0 = qy - g;
  const x1 = qx + qs + g;
  const y1 = qy + qs + g;
  const corner = (x: number, y: number, dx: number, dy: number) =>
    `<path d="M${n(x)} ${n(y + dy * bl)} L${n(x)} ${n(y)} L${n(x + dx * bl)} ${n(y)}" fill="none" stroke="${c.secondary}" stroke-width="${bw}" stroke-linecap="round" stroke-linejoin="round"/>`;
  parts.push(corner(x0, y0, 1, 1), corner(x1, y0, -1, 1), corner(x0, y1, 1, -1), corner(x1, y1, -1, -1));
  parts.push(text("SCAN TO VERIFY", { x: W / 2, y: 46.4, size: 2.0, weight: 800, fill: c.primary, anchor: "middle", letterSpacing: 0.42 }));
  parts.push(
    text(ellipsize(`Confirms the live status of this card with ${company.shortName}`, 500, 1.4, textW), { x: W / 2, y: 49.0, size: 1.4, weight: 500, fill: MUTED, anchor: "middle" }),
  );

  // Card details grid.
  const colW = textW / 2;
  const cell = (label: string, value: string, x: number, y: number) =>
    text(label, { x, y, size: 1.25, weight: 700, fill: MUTED, letterSpacing: 0.22 }) +
    text(ellipsize(value, 700, 1.95, colW - 1.2, 0.04), { x, y: y + 2.75, size: 1.95, weight: 700, fill: INK, letterSpacing: 0.04 });
  parts.push(`<rect x="${n(M)}" y="51.3" width="${n(textW)}" height="12.2" rx="1.2" fill="${SOFT}"/>`);
  const gx = M + 1.6;
  const gx2 = M + colW + 0.8;
  parts.push(cell("CARD NO.", data.cardNumber, gx, 54.2), cell("EMPLOYEE NO.", data.employeeNumber, gx2, 54.2));
  parts.push(cell("ISSUED", formatCardDate(data.issuedAt), gx, 59.6), cell("EXPIRES", formatCardDate(data.expiresAt), gx2, 59.6));

  // Return / contact / property text, stacked to fit the remaining space.
  const bandTop = 81.0;
  let y = 66.4;
  const para = (content: string, size: number, weight: FontWeight, fill: string, maxLines: number, lh = 1.32) => {
    const lines = wrapText(content, weight, size, textW);
    const shown = lines.slice(0, maxLines);
    if (lines.length > maxLines) shown[maxLines - 1] = ellipsize(shown[maxLines - 1] + " …", weight, size, textW);
    for (const line of shown) {
      if (y > bandTop - 1.2) break;
      parts.push(text(line, { x: W / 2, y, size, weight, fill, anchor: "middle" }));
      y += size * lh;
    }
  };
  para(company.returnText, 1.5, 600, INK, 2);
  const contacts = [company.website, company.phone, company.supportEmail].filter((v): v is string => !!v);
  if (contacts.length) {
    y += 0.25;
    para(contacts.join("  •  "), 1.45, 700, c.primary, 2);
  }
  if (company.address) para(company.address, 1.35, 500, MUTED, 1);
  y += 0.35;
  para(`This card remains the property of ${company.legalName} and must be returned on request.`, 1.25, 500, MUTED, 2);

  if (t.showSignatureLine && y <= bandTop - 4.4) {
    const sy = bandTop - 2.7;
    parts.push(`<rect x="${n(M + 6)}" y="${n(sy)}" width="${n(textW - 12)}" height="0.18" fill="${MUTED}"/>`);
    parts.push(text("CARDHOLDER SIGNATURE", { x: W / 2, y: sy + 1.65, size: 1.05, weight: 700, fill: MUTED, anchor: "middle", letterSpacing: 0.2 }));
  }

  // Footer band.
  parts.push(`<rect x="0" y="${n(bandTop)}" width="${n(W)}" height="${n(H - bandTop)}" fill="url(#${id("band")})"/>`);
  parts.push(`<rect x="0" y="${n(bandTop)}" width="${n(W * 0.18)}" height="${n(H - bandTop)}" fill="${c.secondary}"/>`);
  const footer = company.tagline ?? company.legalName;
  const footFit = fitText(footer.toUpperCase(), { weight: 700, maxSize: 1.2, minSize: 0.95, maxWidth: W - W * 0.18 - 2 * 1.6, maxLines: 1, letterSpacing: 0.1 });
  parts.push(
    text(footFit.lines[0], {
      x: W * 0.18 + (W - W * 0.18) / 2,
      y: bandTop + (H - bandTop) / 2 + footFit.size * 0.36,
      size: footFit.size,
      weight: 700,
      fill: WHITE,
      anchor: "middle",
      letterSpacing: 0.1,
    }),
  );
  parts.push(
    text(company.shortName, { x: (W * 0.18) / 2, y: bandTop + (H - bandTop) / 2 + 0.6, size: 1.65, weight: 800, fill: WHITE, anchor: "middle", letterSpacing: 0.1 }),
  );

  const defs = `<linearGradient id="${id("band")}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${c.primary}"/><stop offset="1" stop-color="${c.accent}"/></linearGradient>`;
  return `<defs>${defs}</defs>${parts.join("")}`;
}

export const portraitV1: CardLayoutRenderer = { front: renderFront, back: renderBack };
