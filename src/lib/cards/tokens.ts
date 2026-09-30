import { randomBytes } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * 128-bit cryptographically random verification token, RFC 4648 base32
 * (26 upper-case chars). Upper-case lets the whole QR URL use the compact QR
 * alphanumeric mode, producing a smaller, more robust code on the printed card.
 */
export function generateVerificationToken(): string {
  const bytes = randomBytes(16);
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export const TOKEN_RE = /^[A-Z2-7]{26}$/;

export function normaliseToken(raw: string): string | null {
  const t = raw.trim().toUpperCase();
  return TOKEN_RE.test(t) ? t : null;
}

/** Builds the public verification URL printed in the QR code. */
export function verificationUrl(appUrl: string, token: string): string {
  const u = new URL(appUrl);
  if (u.pathname === "/" || u.pathname === "") {
    // Origin is case-insensitive; /VERIFY is rewritten to /verify by next.config.
    return `${u.origin.toUpperCase()}/VERIFY/${token}`;
  }
  return `${appUrl.replace(/\/+$/, "")}/verify/${token}`;
}

/** Human-friendly version for display (lower-case path). */
export function verificationUrlDisplay(appUrl: string, token: string): string {
  return `${appUrl.replace(/\/+$/, "")}/verify/${token}`;
}

export function formatCardNumber(prefix: string, employeeNumber: string, employeePrefix: string, version: number): string {
  let core = employeeNumber.toUpperCase();
  if (core.startsWith(`${employeePrefix}-`)) core = core.slice(employeePrefix.length + 1);
  core = core.replace(/[^A-Z0-9]/g, "") || "X";
  return `${prefix}-${core}-${String(version).padStart(2, "0")}`;
}
