/**
 * Layout "fxt-landscape-v1" - landscape CR80 card (85.6 x 53.98 mm).
 *
 * FRONT                                             BACK
 * ┌────────────────────────────────────────────┐    ┌────────────────────────────────────────────┐
 * │▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀│    │▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀│
 * │ LOGO │ STAFF IDENTITY CARD        [DRIVER]  │    │ LOGO │ FAST EXPRESS TRANSPORT LIMITED      │
 * │      │ Company legal name                   │    │      │ Staff Identity Card                 │
 * │ ┌───────┐                        ┌────────┐ │    │ ┌─ card no / employee no ──┐ ┌┐      ┌┐ │
 * │ │       │  JAMES WILSON          │   QR   │ │    │ └─ issued / expires ───────┘   QR     │
 * │ │ PHOTO │  ━━                    │        │ │    │ If found, please return…     └┘      └┘ │
 * │ │  3:4  │  OPERATIONS MANAGER    └────────┘ │    │ website • phone • email    SCAN TO VERIFY│
 * │ │       │  Operations          SCAN TO VERIFY│    │ This card remains the property…         │
 * │ └───────┘  EMPLOYEE ID           VALID UNTIL │    │ ─────────── signature                   │
 * │            FXT-00001             29 SEP 2028 │    │                                          │
 * │▐FXT▌ CARD NO. …            TAGLINE ▓▓▓▓▓▓▓▓▓▓│    │▐FXT▌                       TAGLINE ▓▓▓▓▓▓│
 * └────────────────────────────────────────────┘    └────────────────────────────────────────────┘
 *
 * Designed natively for the horizontal format (not a rotated portrait card).
 * Every text block is measured and fitted so nothing can overlap the photo,
 * the QR code, the logo or the trim edge.
 */
import { LOGO_ASPECT } from "@/lib/brand/logo";
import { formatCardDate } from "@/lib/dates";
import { qrGroup } from "@/lib/qr";
import type { CardLayoutRenderer, RenderCardOptions } from "../render";
import { brandStripe, INK, LINE, logo, MUTED, n, roleLabelPill, SOFT, speedLines, text, titleCase, WHITE, type CardColors } from "../svg";
import { ellipsize, escapeXml, fitText, measureText, wrapText, type FontWeight } from "../text";

const W = 85.6;
const H = 53.98;
const M = 3.2; // safe margin from the trim edge (mm)
const STRIPE = 1.2;
const HAIRLINE = "#E3E8F0";
const BAND_TOP = 47.4; // footer band
const BODY_TOP = 15.0;
const RED_BLOCK = 15.2; // width of the red block at the left of the footer band

/* ------------------------------------------------------------------ */
/* Shared pieces (front + back belong to one family)                   */
/* ------------------------------------------------------------------ */

function header(o: RenderCardOptions, opts: { logoH: number; title: string; subtitle: string; titleSize: number; rightReserve: number }) {
  const { colors: c } = o;
  const parts: string[] = [];
  const logoY = STRIPE + 2.0;
  parts.push(logo(M - 0.2, logoY, opts.logoH));
  const dividerX = M - 0.2 + opts.logoH * LOGO_ASPECT + 2.0;
  parts.push(`<rect x="${n(dividerX)}" y="${n(logoY + 1.1)}" width="0.18" height="${n(opts.logoH - 2.2)}" fill="${LINE}"/>`);
  const tx = dividerX + 1.7;
  const maxW = W - M - opts.rightReserve - tx;
  const mid = logoY + opts.logoH / 2;
  const title = fitText(opts.title, { weight: 800, maxSize: opts.titleSize, minSize: 1.3, maxWidth: maxW, maxLines: 1, letterSpacing: 0.26 });
  parts.push(text(title.lines[0], { x: tx, y: mid - 0.35, size: title.size, weight: 800, fill: c.primary, letterSpacing: 0.26 }));
  parts.push(text(ellipsize(opts.subtitle, 600, 1.35, maxW), { x: tx, y: mid + 2.05, size: 1.35, weight: 600, fill: MUTED }));
  return parts.join("");
}

function footerBand(o: RenderCardOptions, id: (s: string) => string, leftText: string | null) {
  const { colors: c, company } = o;
  const parts: string[] = [];
  const bh = H - BAND_TOP;
  parts.push(`<rect x="0" y="${n(BAND_TOP)}" width="${n(W)}" height="${n(bh)}" fill="url(#${id("band")})"/>`);
  // Red block with a forward-slanted edge (motion, as in the logo's speed lines).
  parts.push(`<path d="M0 ${n(BAND_TOP)} L${n(RED_BLOCK + 1.6)} ${n(BAND_TOP)} L${n(RED_BLOCK)} ${n(H)} L0 ${n(H)} Z" fill="${c.secondary}"/>`);
  const cy = BAND_TOP + bh / 2;
  parts.push(text(company.shortName, { x: (RED_BLOCK + 0.8) / 2, y: cy + 0.68, size: 1.9, weight: 800, fill: WHITE, anchor: "middle", letterSpacing: 0.12 }));
  const x0 = RED_BLOCK + 3.0;
  const x1 = W - M;
  let leftW = 0;
  if (leftText) {
    const f = fitText(leftText, { weight: 700, maxSize: 1.15, minSize: 1.0, maxWidth: (x1 - x0) * 0.45, maxLines: 1, letterSpacing: 0.1 });
    parts.push(text(f.lines[0], { x: x0, y: cy + f.size * 0.36, size: f.size, weight: 700, fill: WHITE, opacity: 0.78, letterSpacing: 0.1 }));
    leftW = measureText(f.lines[0], 700, f.size, 0.1) + 3;
  }
  const tag = (company.tagline ?? company.legalName).toUpperCase();
  const tf = fitText(tag, { weight: 700, maxSize: 1.15, minSize: 0.95, maxWidth: x1 - x0 - leftW, maxLines: 1, letterSpacing: 0.12 });
  parts.push(text(tf.lines[0], { x: leftText ? x1 : (x0 + x1) / 2, y: cy + tf.size * 0.36, size: tf.size, weight: 700, fill: WHITE, anchor: leftText ? "end" : "middle", letterSpacing: 0.12 }));
  return parts.join("");
}

const bandGradient = (c: CardColors, id: (s: string) => string) =>
  `<linearGradient id="${id("band")}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${c.primary}"/><stop offset="1" stop-color="${c.accent}"/></linearGradient>`;

/** Label + value pair (small caps label above a bold value). */
function datum(label: string, value: string, o: { x: number; y: number; anchor?: "start" | "middle" | "end"; maxWidth: number; valueSize: number; fill: string }) {
  const f = fitText(value, { weight: 800, maxSize: o.valueSize, minSize: Math.min(o.valueSize, 1.6), maxWidth: o.maxWidth, maxLines: 1, letterSpacing: 0.06 });
  return (
    text(label, { x: o.x, y: o.y - f.size - 0.7, size: 1.2, weight: 700, fill: MUTED, anchor: o.anchor, letterSpacing: 0.22 }) +
    text(f.lines[0], { x: o.x, y: o.y, size: f.size, weight: 800, fill: o.fill, anchor: o.anchor, letterSpacing: 0.06 })
  );
}

/* ------------------------------------------------------------------ */
/* FRONT                                                               */
/* ------------------------------------------------------------------ */

function renderFront(o: RenderCardOptions, id: (s: string) => string): string {
  const { data, colors: c, template: t, company } = o;
  const accent = t.accent === "primary" ? c.primary : c.secondary;
  const parts: string[] = [];

  parts.push(`<rect width="${n(W)}" height="${n(H)}" fill="${WHITE}"/>`);
  // Faint ring motif (echoes the pin in the logo) - kept clear of the QR code.
  parts.push(
    `<circle cx="${n(W + 3)}" cy="-3" r="13" fill="none" stroke="${SOFT}" stroke-width="4.2"/>`,
    `<circle cx="${n(W + 3)}" cy="-3" r="7.4" fill="none" stroke="${SOFT}" stroke-width="1"/>`,
  );
  parts.push(brandStripe(c, W, STRIPE));

  // Header: logo | card title + company, role label or speed lines on the right.
  let rightReserve = 12.5;
  if (t.roleLabel) {
    const pillW = measureText(t.roleLabel, 800, 1.75, 0.22) + 2.8;
    rightReserve = pillW + 2.5;
    parts.push(roleLabelPill(t.roleLabel, W - M, STRIPE + 2.0 + 9.4 / 2 - 1.65, accent));
  } else {
    parts.push(speedLines(W - M - 10, STRIPE + 2.0 + 9.4 / 2 - 1.3, 10, c.secondary));
  }
  parts.push(header(o, { logoH: 9.4, title: t.cardTitle, subtitle: company.legalName, titleSize: 1.75, rightReserve }));

  // Photograph (3:4, never stretched: preserveAspectRatio slice = centre crop).
  const pw = 21.0;
  const ph = 28.0;
  const px = M;
  const py = BODY_TOP;
  parts.push(
    `<rect x="${n(px - 0.6)}" y="${n(py - 0.6)}" width="${n(pw + 1.2)}" height="${n(ph + 1.2)}" rx="1.9" fill="${c.primary}"/>`,
    `<rect x="${n(px)}" y="${n(py)}" width="${n(pw)}" height="${n(ph)}" rx="1.35" fill="${SOFT}"/>`,
  );
  if (data.photoHref) {
    parts.push(
      `<image x="${n(px)}" y="${n(py)}" width="${n(pw)}" height="${n(ph)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id("photo")})" href="${escapeXml(data.photoHref)}"/>`,
    );
  } else {
    parts.push(
      `<g clip-path="url(#${id("photo")})" fill="${LINE}">` +
        `<circle cx="${n(px + pw / 2)}" cy="${n(py + ph * 0.38)}" r="${n(pw * 0.22)}"/>` +
        `<ellipse cx="${n(px + pw / 2)}" cy="${n(py + ph * 0.98)}" rx="${n(pw * 0.42)}" ry="${n(ph * 0.3)}"/>` +
        `</g>`,
      text("NO PHOTO", { x: px + pw / 2, y: py + ph - 1.8, size: 1.3, weight: 700, fill: MUTED, anchor: "middle", letterSpacing: 0.2 }),
    );
  }
  parts.push(`<rect x="${n(px + pw / 2 - 3.5)}" y="${n(py + ph + 0.95)}" width="7" height="0.8" rx="0.4" fill="${c.secondary}"/>`);

  // Right column: QR verification + expiry.
  const qs = 19.0;
  const qx = W - M - qs - 0.3;
  const qy = BODY_TOP;
  const colCx = qx + qs / 2;
  const bottomBaseline = py + ph; // employee ID and expiry values align with the photo's bottom edge
  if (t.showQrOnFront) {
    parts.push(`<rect x="${n(qx - 0.9)}" y="${n(qy - 0.9)}" width="${n(qs + 1.8)}" height="${n(qs + 1.8)}" rx="1.4" fill="${WHITE}" stroke="${HAIRLINE}" stroke-width="0.25"/>`);
    parts.push(qrGroup(data.verifyUrl, qx, qy, qs, "#000000"));
    parts.push(text("SCAN TO VERIFY", { x: colCx, y: qy + qs + 2.75, size: 1.15, weight: 800, fill: c.primary, anchor: "middle", letterSpacing: 0.28 }));
  }
  parts.push(datum("VALID UNTIL", formatCardDate(data.expiresAt), { x: t.showQrOnFront ? colCx : W - M, y: bottomBaseline, anchor: t.showQrOnFront ? "middle" : "end", maxWidth: qs + 1.8, valueSize: 2.2, fill: c.primary }));

  // Centre column: identity.
  const tx = px + pw + 3.6;
  const tr = t.showQrOnFront ? qx - 0.9 - 2.5 : W - M - 22; // 2.5 mm clear of the QR frame
  const tw = tr - tx;
  const idBlockTop = bottomBaseline - 2.6 - 0.7 - 1.2 - 1.8; // top of the "EMPLOYEE ID" label, with breathing room

  // Fit the name / role / department block, degrading gracefully for long values.
  const layoutBlock = (nameMax: number, posLines: number) => {
    const name = fitText(data.fullName.toUpperCase(), { weight: 800, maxSize: nameMax, minSize: 2.1, maxWidth: tw, maxLines: 2, letterSpacing: 0.04 });
    const pos = data.positionName
      ? fitText(data.positionName.toUpperCase(), { weight: 700, maxSize: 1.75, minSize: 1.4, maxWidth: tw, maxLines: posLines, letterSpacing: 0.14 })
      : null;
    const nameLh = name.size * 1.14;
    const posLh = pos ? pos.size * 1.32 : 0;
    const showDept = t.showDepartment && !!data.departmentName;
    // Heights measured from the top of the name's capitals to the last baseline.
    const h =
      name.size * 0.73 +
      (name.lines.length - 1) * nameLh +
      2.2 /* rule gap */ +
      (pos ? 2.6 + (pos.lines.length - 1) * posLh : 0.6) +
      (showDept ? 2.5 : 0);
    return { name, pos, nameLh, posLh, showDept, h };
  };
  const avail = idBlockTop - BODY_TOP;
  let blk = layoutBlock(3.5, 2);
  if (blk.h > avail) blk = layoutBlock(3.5, 1);
  if (blk.h > avail) blk = layoutBlock(2.6, 1);
  // Optical centring: slightly above the geometric middle of the free space.
  let y = BODY_TOP + Math.max(0, (avail - blk.h) * 0.38) + blk.name.size * 0.73;
  blk.name.lines.forEach((line, i) =>
    parts.push(text(line, { x: tx, y: y + i * blk.nameLh, size: blk.name.size, weight: 800, fill: c.primary, letterSpacing: 0.04 })),
  );
  y += (blk.name.lines.length - 1) * blk.nameLh;
  parts.push(`<rect x="${n(tx)}" y="${n(y + 1.35)}" width="6.5" height="0.55" rx="0.27" fill="${c.secondary}"/>`);
  y += 2.2;
  if (blk.pos) {
    y += 2.6;
    blk.pos.lines.forEach((line, i) =>
      parts.push(text(line, { x: tx, y: y + i * blk.posLh, size: blk.pos!.size, weight: 700, fill: c.secondary, letterSpacing: 0.14 })),
    );
    y += (blk.pos.lines.length - 1) * blk.posLh;
  } else {
    y += 0.6;
  }
  if (blk.showDept) {
    y += 2.5;
    parts.push(text(ellipsize(data.departmentName!, 500, 1.6, tw), { x: tx, y, size: 1.6, weight: 500, fill: MUTED }));
  }
  parts.push(datum("EMPLOYEE ID", data.employeeNumber, { x: tx, y: bottomBaseline, maxWidth: tw, valueSize: 2.6, fill: INK }));

  parts.push(footerBand(o, id, `CARD NO.  ${data.cardNumber}`));

  const defs =
    `<clipPath id="${id("photo")}"><rect x="${n(px)}" y="${n(py)}" width="${n(pw)}" height="${n(ph)}" rx="1.35"/></clipPath>` + bandGradient(c, id);
  return `<defs>${defs}</defs>${parts.join("")}`;
}

/* ------------------------------------------------------------------ */
/* BACK                                                                */
/* ------------------------------------------------------------------ */

function renderBack(o: RenderCardOptions, id: (s: string) => string): string {
  const { data, colors: c, template: t, company } = o;
  const parts: string[] = [];

  parts.push(`<rect width="${n(W)}" height="${n(H)}" fill="${WHITE}"/>`);
  parts.push(brandStripe(c, W, STRIPE));
  parts.push(header(o, { logoH: 8.6, title: company.legalName.toUpperCase(), subtitle: titleCase(t.cardTitle), titleSize: 1.6, rightReserve: 0 }));

  // QR verification block (right) with scanner-corner brackets outside the quiet zone.
  const qs = 21.0;
  const g = 1.05;
  const qx = W - M - g - 0.3 - qs;
  const qy = BODY_TOP;
  const cx = qx + qs / 2;
  parts.push(qrGroup(data.verifyUrl, qx, qy, qs, "#000000"));
  const bl = 3.0;
  const x0 = qx - g;
  const y0 = qy - g;
  const x1 = qx + qs + g;
  const y1 = qy + qs + g;
  const corner = (x: number, y: number, dx: number, dy: number) =>
    `<path d="M${n(x)} ${n(y + dy * bl)} L${n(x)} ${n(y)} L${n(x + dx * bl)} ${n(y)}" fill="none" stroke="${c.secondary}" stroke-width="0.45" stroke-linecap="round" stroke-linejoin="round"/>`;
  parts.push(corner(x0, y0, 1, 1), corner(x1, y0, -1, 1), corner(x0, y1, 1, -1), corner(x1, y1, -1, -1));
  parts.push(text("SCAN TO VERIFY", { x: cx, y: y1 + 3.2, size: 1.45, weight: 800, fill: c.primary, anchor: "middle", letterSpacing: 0.32 }));
  parts.push(
    text(ellipsize(`Live card status from ${company.shortName}`, 500, 1.2, qs + 2 * g + 1), { x: cx, y: y1 + 5.2, size: 1.2, weight: 500, fill: MUTED, anchor: "middle" }),
  );

  // Left column: card details, return / contact / property text, signature.
  const lx = M;
  const lw = x0 - 3.2 - lx;
  const panelH = 12.6;
  parts.push(`<rect x="${n(lx)}" y="${n(BODY_TOP - 0.6)}" width="${n(lw)}" height="${n(panelH)}" rx="1.2" fill="${SOFT}"/>`);
  const colW = lw / 2;
  const cell = (label: string, value: string, x: number, y: number) =>
    text(label, { x, y, size: 1.15, weight: 700, fill: MUTED, letterSpacing: 0.22 }) +
    text(ellipsize(value, 700, 1.85, colW - 2.2, 0.04), { x, y: y + 2.55, size: 1.85, weight: 700, fill: INK, letterSpacing: 0.04 });
  const gx = lx + 1.7;
  const gx2 = lx + colW + 0.6;
  parts.push(cell("CARD NO.", data.cardNumber, gx, BODY_TOP + 2.2), cell("EMPLOYEE NO.", data.employeeNumber, gx2, BODY_TOP + 2.2));
  parts.push(cell("ISSUED", formatCardDate(data.issuedAt), gx, BODY_TOP + 7.7), cell("EXPIRES", formatCardDate(data.expiresAt), gx2, BODY_TOP + 7.7));

  const limit = BAND_TOP - 1.4;
  let y = BODY_TOP - 0.6 + panelH + 3.3;
  const para = (content: string, size: number, weight: FontWeight, fill: string, maxLines: number, lh = 1.3) => {
    const lines = wrapText(content, weight, size, lw);
    const shown = lines.slice(0, maxLines);
    if (lines.length > maxLines) shown[maxLines - 1] = ellipsize(shown[maxLines - 1] + " …", weight, size, lw);
    for (const line of shown) {
      if (y > limit) break;
      parts.push(text(line, { x: lx, y, size, weight, fill }));
      y += size * lh;
    }
  };
  para(company.returnText, 1.45, 600, INK, 2);
  // Only configured contact details are printed; blank settings are omitted entirely.
  const contacts = [company.website, company.phone, company.supportEmail].filter((v): v is string => !!v);
  if (contacts.length) {
    y += 0.3;
    para(contacts.join("  •  "), 1.35, 700, c.primary, 2);
  }
  if (company.address) para(company.address, 1.25, 500, MUTED, 1);
  y += 0.3;
  para(`This card remains the property of ${company.legalName} and must be returned on request.`, 1.2, 500, MUTED, 2);

  if (t.showSignatureLine && y <= limit - 3.4) {
    const sy = limit - 1.5;
    parts.push(`<rect x="${n(lx)}" y="${n(sy)}" width="${n(Math.min(30, lw))}" height="0.18" fill="${MUTED}"/>`);
    parts.push(text("CARDHOLDER SIGNATURE", { x: lx, y: sy + 1.55, size: 1.05, weight: 700, fill: MUTED, letterSpacing: 0.2 }));
  }

  parts.push(footerBand(o, id, null));
  return `<defs>${bandGradient(c, id)}</defs>${parts.join("")}`;
}

export const landscapeV1: CardLayoutRenderer = { front: renderFront, back: renderBack };
