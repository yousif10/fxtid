/**
 * Landscape CR80 layout: geometry, raster/vector exports, QR decoding, text
 * fitting, and portrait regression.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import jsQR from "jsqr";
import { cardPixelSize, renderCardPdf, renderCardPng, svgDimensions } from "@/lib/cards/export";
import { renderCardSvg, type RenderCardOptions } from "@/lib/cards/render";
import { CARD_DIMENSIONS, orientationOfLayout, parseTemplateConfig, resolveLayout, TEMPLATE_PRESETS } from "@/lib/cards/templates";
import { measureText, type FontWeight } from "@/lib/cards/text";
import { generateVerificationToken, verificationUrl } from "@/lib/cards/tokens";
import { DEFAULT_SETTINGS } from "@/lib/validation/settings";
import { renderPortraitVariants } from "./fixtures/portrait-variants";

const verifyUrl = verificationUrl("https://id.example.co.uk", generateVerificationToken());

const options = (side: "front" | "back", layout: string, extra: Partial<RenderCardOptions["data"]> = {}, config: object = {}): RenderCardOptions => ({
  side,
  layout,
  data: {
    fullName: "James Wilson",
    positionName: "Operations Manager",
    departmentName: "Operations",
    employeeNumber: "FXT-00001",
    cardNumber: "CARD-00001-01",
    issuedAt: "2026-01-01",
    expiresAt: "2028-01-01",
    verifyUrl,
    photoHref: null,
    ...extra,
  },
  company: { ...DEFAULT_SETTINGS.company, website: "www.example.co.uk", phone: "0100 000 0000", supportEmail: "hr@example.invalid" },
  colors: { primary: "#02214F", secondary: "#D11E25", accent: "#0B3A7E" },
  template: parseTemplateConfig(config),
});

const L = "fxt-landscape-v1";
const P = "fxt-portrait-v1";

async function decode(png: Buffer) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data ?? null;
}

describe("template registry", () => {
  it("maps layouts to orientations and falls back to portrait for legacy values", () => {
    expect(orientationOfLayout(L)).toBe("landscape");
    expect(orientationOfLayout(P)).toBe("portrait");
    expect(resolveLayout(null)).toBe(P);
    expect(resolveLayout("something-old")).toBe(P);
  });
  it("seeds every design family in both orientations", () => {
    const names = new Set(TEMPLATE_PRESETS.map((t) => t.name));
    for (const name of names) {
      const layouts = TEMPLATE_PRESETS.filter((t) => t.name === name).map((t) => t.layout).sort();
      expect(layouts).toEqual([L, P].sort());
    }
    expect(TEMPLATE_PRESETS.filter((t) => t.isDefault)).toHaveLength(1);
  });
});

describe("landscape SVG geometry", () => {
  it.each(["front", "back"] as const)("%s uses the exact landscape CR80 size in mm", (side) => {
    const svg = renderCardSvg(options(side, L));
    expect(svg).toContain('viewBox="0 0 85.6 53.98"');
    expect(svg).toContain('width="85.6mm" height="53.98mm"');
    const d = svgDimensions(svg);
    expect(d.widthMm).toBeGreaterThan(d.heightMm);
    expect(d.widthMm / d.heightMm).toBeCloseTo(85.6 / 53.98, 6);
  });
  it("keeps portrait dimensions for portrait (and default) layouts", () => {
    for (const layout of [P, undefined]) {
      const svg = renderCardSvg(options("front", layout as string));
      expect(svg).toContain('viewBox="0 0 53.98 85.6"');
    }
  });
});

describe("landscape PNG export", () => {
  it.each([
    [300, 1011, 638],
    [600, 2022, 1275],
  ])("renders at %i DPI to ~%ix%i px without distortion", async (dpi, w, h) => {
    const png = renderCardPng(renderCardSvg(options("front", L)), dpi);
    const meta = await sharp(png).metadata();
    expect(meta.width).toBe(w);
    expect(Math.abs(meta.height! - h)).toBeLessThanOrEqual(1);
    expect(meta.width! / meta.height!).toBeCloseTo(85.6 / 53.98, 2);
    expect(cardPixelSize(dpi, CARD_DIMENSIONS.landscape).width).toBe(w);
  });

  it.each([
    ["front", 300],
    ["front", 600],
    ["back", 300],
    ["back", 600],
  ] as const)("QR on the %s decodes at %i DPI", async (side, dpi) => {
    expect(await decode(renderCardPng(renderCardSvg(options(side, L)), dpi))).toBe(verifyUrl);
  });

  it("QR still decodes with the longest realistic name, role and a role label", async () => {
    const svg = renderCardSvg(
      options("front", L, { fullName: "Christopher Alexander Montgomery", positionName: "Senior International Logistics Operations Manager" }, { roleLabel: "Management", accent: "primary" }),
    );
    expect(await decode(renderCardPng(svg, 300))).toBe(verifyUrl);
  });
});

describe("landscape PDF export", () => {
  const pageSizes = (pdf: Buffer) =>
    [...pdf.toString("latin1").matchAll(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/g)].map((m) => [Number(m[1]), Number(m[2])]);
  const mmToPt = (mm: number) => (mm * 72) / 25.4;

  it.each([
    ["front only", ["front"]],
    ["back only", ["back"]],
    ["front + back", ["front", "back"]],
  ] as const)("%s produces landscape CR80 pages", async (_label, sides) => {
    const pdf = await renderCardPdf(sides.map((s) => renderCardSvg(options(s, L))), { title: "t", author: "a" });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    const pages = pageSizes(pdf);
    expect(pages).toHaveLength(sides.length);
    for (const [w, h] of pages) {
      expect(w).toBeCloseTo(mmToPt(85.6), 1);
      expect(h).toBeCloseTo(mmToPt(53.98), 1);
    }
  });

  it("portrait PDFs keep portrait pages", async () => {
    const pdf = await renderCardPdf([renderCardSvg(options("front", P))], { title: "t", author: "a" });
    const [[w, h]] = pageSizes(pdf);
    expect(w).toBeCloseTo(mmToPt(53.98), 1);
    expect(h).toBeCloseTo(mmToPt(85.6), 1);
  });
});

describe("landscape text fitting", () => {
  // Text x positions/sizes are emitted as attributes; ensure nothing enters the QR column or the photo.
  const textRuns = (svg: string) =>
    [...svg.matchAll(/<text x="([\d.]+)" y="([\d.]+)"[^>]*font-size="([\d.]+)"[^>]*>([^<]*)<\/text>/g)].map((m) => ({
      x: Number(m[1]),
      y: Number(m[2]),
      size: Number(m[3]),
      text: m[4],
      anchor: /text-anchor="(\w+)"/.exec(m[0])?.[1] ?? "start",
      weight: Number(/font-weight="(\d+)"/.exec(m[0])?.[1] ?? 400),
      letterSpacing: Number(/letter-spacing="([\d.]+)"/.exec(m[0])?.[1] ?? 0),
    }));

  it("wraps long names/roles within the identity column", () => {
    const svg = renderCardSvg(
      options("front", L, { fullName: "Christopher Alexander Montgomery", positionName: "Senior International Logistics Operations Manager" }),
    );
    const runs = textRuns(svg).filter((r) => r.anchor === "start" && r.x > 20 && r.x < 40 && r.y > 14 && r.y < 44);
    const name = runs.filter((r) => r.text.includes("CHRISTOPHER") || r.text.includes("MONTGOMERY"));
    expect(name.length).toBe(2); // wrapped onto two lines, not truncated
    expect(runs.some((r) => r.text.includes("SENIOR"))).toBe(true);
    expect(svg).not.toContain("…"); // nothing had to be truncated
    const qrFrameLeft = 85.6 - 3.2 - 19.0 - 0.3 - 0.9;
    for (const r of runs) {
      expect(r.x).toBeGreaterThan(3.2 + 21); // right of the photo
      const width = measureText(r.text, r.weight as FontWeight, r.size, r.letterSpacing);
      expect(r.x + width, r.text).toBeLessThan(qrFrameLeft - 2); // >= 2 mm clear of the QR frame
    }
  });
});

describe("portrait regression", () => {
  it("portrait artwork is byte-identical to the original (pre-landscape) renderer", () => {
    const baseline = JSON.parse(fs.readFileSync(path.join(process.cwd(), "tests", "fixtures", "portrait-baseline.json"), "utf8")) as Record<string, string>;
    const current = renderPortraitVariants();
    expect(Object.keys(baseline)).toHaveLength(6);
    for (const key of Object.keys(baseline)) expect(current[key], key).toBe(baseline[key]);
  });
});
