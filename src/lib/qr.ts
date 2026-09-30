import QRCode from "qrcode";

export type QrMatrix = { size: number; path: string };

/**
 * Builds a QR code as a single SVG path in module units (1 unit = 1 module),
 * WITHOUT quiet zone - callers must reserve a white margin of >= 4 modules.
 * Horizontal runs are merged so the output is compact and crisp at any scale.
 */
export function buildQrPath(text: string, errorCorrectionLevel: "L" | "M" | "Q" | "H" = "M"): QrMatrix {
  const qr = QRCode.create(text, { errorCorrectionLevel });
  const { size, data } = qr.modules;
  let path = "";
  for (let y = 0; y < size; y++) {
    let x = 0;
    while (x < size) {
      if (data[y * size + x]) {
        const start = x;
        while (x < size && data[y * size + x]) x++;
        path += `M${start} ${y}h${x - start}v1h${start - x}z`;
      } else {
        x++;
      }
    }
  }
  return { size, path };
}

/** Standard quiet zone width in modules (ISO/IEC 18004). */
export const QR_QUIET_ZONE = 4;

/** Returns an SVG <g> placing a QR code (with quiet zone) inside a square of `outer` user units. */
export function qrGroup(text: string, x: number, y: number, outer: number, color = "#000000"): string {
  const { size, path } = buildQrPath(text, "M");
  const total = size + QR_QUIET_ZONE * 2;
  const scale = outer / total;
  return (
    `<g transform="translate(${r(x)} ${r(y)})">` +
    `<rect width="${r(outer)}" height="${r(outer)}" fill="#FFFFFF"/>` +
    `<path transform="translate(${r(QR_QUIET_ZONE * scale)} ${r(QR_QUIET_ZONE * scale)}) scale(${r(scale, 5)})" d="${path}" fill="${color}" shape-rendering="crispEdges"/>` +
    `</g>`
  );
}

function r(n: number, dp = 3): string {
  return String(Math.round(n * 10 ** dp) / 10 ** dp);
}
