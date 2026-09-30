// Dev utility: renders a SPECIMEN card (front + back) to PNG for design review.
// Usage: [LAYOUT=fxt-landscape-v1] [NAME=..] [POSITION=..] [WATERMARK=..] [CONTACTS=1] pnpm tsx scripts/render-sample.ts <outDir> [photo.jpg] [templateConfigJson]
import fs from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { renderCardSvg, type CardSide } from "../src/lib/cards/render";
import { parseTemplateConfig } from "../src/lib/cards/templates";
import { DEFAULT_SETTINGS } from "../src/lib/validation/settings";

const out = process.argv[2] ?? ".";
const fontDir = path.join(process.cwd(), "public", "fonts");
const fontFiles = fs.readdirSync(fontDir).filter((f) => f.endsWith(".ttf")).map((f) => path.join(fontDir, f));
const photo = process.argv[3] ? `data:image/jpeg;base64,${fs.readFileSync(process.argv[3]).toString("base64")}` : null;
const template = parseTemplateConfig(JSON.parse(process.argv[4] ?? "{}"));

for (const side of ["front", "back"] as CardSide[]) {
  const svg = renderCardSvg({
    side,
    layout: process.env.LAYOUT ?? "fxt-portrait-v1",
    data: {
      fullName: process.env.NAME ?? "James Wilson",
      positionName: process.env.POSITION ?? "Operations Manager",
      departmentName: "Operations",
      employeeNumber: "FXT-00001",
      cardNumber: "CARD-00001-01",
      issuedAt: "2026-01-01",
      expiresAt: "2028-01-01",
      verifyUrl: "HTTPS://ID.EXAMPLE.CO.UK/VERIFY/ABCDEFGHIJKLMNOPQRSTUVWXYZ",
      photoHref: photo,
    },
    company: process.env.CONTACTS
      ? { ...DEFAULT_SETTINGS.company, website: "www.example.co.uk", phone: "0100 000 0000", supportEmail: "hr@example.invalid" }
      : DEFAULT_SETTINGS.company,
    colors: { primary: "#02214F", secondary: "#D11E25", accent: "#0B3A7E" },
    template,
    watermark: process.env.WATERMARK ?? null,
  });
  fs.writeFileSync(path.join(out, `sample-${side}.svg`), svg);
  const png = new Resvg(svg, {
    fitTo: { mode: "zoom", value: 600 / 96 }, // 600 DPI (resvg resolves mm at 96 DPI)
    font: { fontFiles, loadSystemFonts: false, defaultFontFamily: "Inter" },
  }).render().asPng();
  fs.writeFileSync(path.join(out, `sample-${side}.png`), png);
}
console.log("written to", out);
