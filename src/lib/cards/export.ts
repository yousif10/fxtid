/**
 * Server-side card exports.
 *
 * PNG: the card SVG is rasterised by resvg with the bundled Inter fonts at a
 *      true print resolution (default 600 DPI, i.e. 1275 x 2022 px).
 * PDF: resvg first converts all text to vector outlines (so typography is exact
 *      and no font embedding is needed), then the vector SVG is drawn into a PDF
 *      page that is exactly CR80 size in the card's own orientation
 *      (portrait 53.98 x 85.6 mm, landscape 85.6 x 53.98 mm). Only the photograph
 *      is raster; everything else (logo, text, QR) stays vector and razor sharp.
 *
 * Physical size is read from each SVG's mm viewBox, so every layout/orientation
 * shares this one pipeline.
 */
import fs from "node:fs";
import path from "node:path";
import { Resvg, type ResvgRenderOptions } from "@resvg/resvg-js";
import PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";
import type { CardDimensions } from "./templates";

const MM_TO_PT = 72 / 25.4;

let fontFilesCache: string[] | null = null;
function fontFiles(): string[] {
  if (!fontFilesCache) {
    const dir = path.join(process.cwd(), "public", "fonts");
    fontFilesCache = fs
      .readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith(".ttf"))
      .map((f) => path.join(dir, f));
  }
  return fontFilesCache;
}

function resvgOptions(extra: Partial<ResvgRenderOptions> = {}): ResvgRenderOptions {
  return {
    font: { fontFiles: fontFiles(), loadSystemFonts: false, defaultFontFamily: "Inter" },
    shapeRendering: 2,
    textRendering: 2,
    imageRendering: 0,
    ...extra,
  };
}

/** Physical size (mm) of a card SVG produced by renderCardSvg (viewBox is in mm). */
export function svgDimensions(svg: string): CardDimensions {
  const m = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
  if (!m) throw new Error("Card SVG has no viewBox");
  return { widthMm: Number(m[1]), heightMm: Number(m[2]) };
}

export function cardPixelSize(dpi: number, dims: CardDimensions) {
  return {
    width: Math.round((dims.widthMm / 25.4) * dpi),
    height: Math.round((dims.heightMm / 25.4) * dpi),
  };
}

export function renderCardPng(svg: string, dpi = 600): Buffer {
  // Scale by width; resvg derives the height from the exact CR80 aspect ratio (no distortion).
  const { width } = cardPixelSize(dpi, svgDimensions(svg));
  const resvg = new Resvg(svg, resvgOptions({ fitTo: { mode: "width", value: width }, background: "#FFFFFF" }));
  return resvg.render().asPng();
}

/** Converts <text> to vector paths using the bundled fonts. */
function outlineSvg(svg: string): string {
  return new Resvg(svg, resvgOptions()).toString();
}

export async function renderCardPdf(
  pages: string[],
  meta: { title: string; author: string; subject?: string },
): Promise<Buffer> {
  const doc = new PDFDocument({
    margin: 0,
    autoFirstPage: false,
    info: { Title: meta.title, Author: meta.author, Subject: meta.subject ?? "Employee ID card", Creator: "FXT ID Card System" },
    pdfVersion: "1.7",
  });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  for (const svg of pages) {
    const dims = svgDimensions(svg);
    const width = dims.widthMm * MM_TO_PT;
    const height = dims.heightMm * MM_TO_PT;
    // Page = card, in the card's own orientation (a landscape card gets a landscape page).
    doc.addPage({ size: [width, height], margin: 0 });
    SVGtoPDF(doc, outlineSvg(svg), 0, 0, { width, height, preserveAspectRatio: "xMidYMid meet", assumePt: false });
  }
  doc.end();
  return done;
}
