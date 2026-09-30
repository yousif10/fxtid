import { INTER_ADVANCES } from "./font-metrics";

export type FontWeight = 400 | 500 | 600 | 700 | 800;

const FALLBACK_ADVANCE = 0.6;

/** Width of `text` in user units at `size` (font size in the same units). */
export function measureText(text: string, weight: FontWeight, size: number, letterSpacing = 0): number {
  const table = INTER_ADVANCES[weight];
  let em = 0;
  for (const ch of text) em += table[ch.codePointAt(0)!] ?? FALLBACK_ADVANCE;
  const chars = [...text].length;
  return em * size + Math.max(0, chars - 1) * letterSpacing;
}

/** Greedy word wrap. Words longer than a line are hard-broken. */
export function wrapText(
  text: string,
  weight: FontWeight,
  size: number,
  maxWidth: number,
  letterSpacing = 0,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  const fits = (s: string) => measureText(s, weight, size, letterSpacing) <= maxWidth;
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (fits(candidate)) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    if (fits(word)) {
      current = word;
    } else {
      // Hard-break very long tokens.
      let chunk = "";
      for (const ch of word) {
        if (fits(chunk + ch)) chunk += ch;
        else {
          lines.push(chunk);
          chunk = ch;
        }
      }
      current = chunk;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Truncates with an ellipsis so the text fits `maxWidth`. */
export function ellipsize(text: string, weight: FontWeight, size: number, maxWidth: number, letterSpacing = 0): string {
  if (measureText(text, weight, size, letterSpacing) <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && measureText(out + "…", weight, size, letterSpacing) > maxWidth) out = out.slice(0, -1);
  return out.trimEnd() + "…";
}

export type FittedText = { lines: string[]; size: number };

/**
 * Fits text into at most `maxLines` lines: first shrinks the font from `maxSize`
 * down to `minSize`, then wraps, and finally ellipsizes the last line.
 */
export function fitText(
  text: string,
  opts: { weight: FontWeight; maxSize: number; minSize: number; maxWidth: number; maxLines: number; letterSpacing?: number },
): FittedText {
  const { weight, maxSize, minSize, maxWidth, maxLines, letterSpacing = 0 } = opts;
  const step = (maxSize - minSize) / 8 || 1;
  for (let size = maxSize; size >= minSize - 1e-9; size -= step) {
    if (measureText(text, weight, size, letterSpacing) <= maxWidth) return { lines: [text], size };
  }
  // Wrap at a size between min and max that yields <= maxLines.
  for (let size = maxSize; size >= minSize - 1e-9; size -= step) {
    const lines = wrapText(text, weight, size, maxWidth, letterSpacing);
    if (lines.length <= maxLines) return { lines, size };
  }
  const lines = wrapText(text, weight, minSize, maxWidth, letterSpacing).slice(0, maxLines);
  lines[maxLines - 1] = ellipsize(lines[maxLines - 1] + " …", weight, minSize, maxWidth, letterSpacing);
  return { lines, size: minSize };
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    // Strip characters that are invalid in XML 1.0.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}
