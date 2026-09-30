// Inputs used to generate portrait-baseline.json with the ORIGINAL (pre-landscape)
// renderer. The regression test re-renders them and requires byte-identical SVG.
import { renderCardSvg } from "../../src/lib/cards/render";
import { parseTemplateConfig } from "../../src/lib/cards/templates";
import { DEFAULT_SETTINGS } from "../../src/lib/validation/settings";

const variants: Array<[string, Record<string, unknown>, string, string | null, boolean]> = [
  ["default", {}, "James Wilson", null, false],
  ["driver", { roleLabel: "Driver" }, "Alexandra Catherine Montgomery-Smythe", "DEMO · NOT VALID", true],
  ["mgmt", { roleLabel: "Management", accent: "primary", showQrOnFront: false, showSignatureLine: false, showDepartment: false }, "Bo", "VOID · LOST", false],
];

export function renderPortraitVariants(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, cfg, name, wm, contacts] of variants)
    for (const side of ["front", "back"] as const) {
      out[`${k}-${side}`] = renderCardSvg({
        side,
        idPrefix: "b",
        data: {
          fullName: name,
          positionName: "Senior International Logistics Operations Manager",
          departmentName: "Operations",
          employeeNumber: "FXT-00001",
          cardNumber: "CARD-00001-01",
          issuedAt: "2026-01-01",
          expiresAt: "2028-01-01",
          verifyUrl: "HTTPS://ID.EXAMPLE.CO.UK/VERIFY/ABCDEFGHIJKLMNOPQRSTUVWXYZ",
          photoHref: k === "default" ? "data:image/jpeg;base64,AAAA" : null,
        },
        company: {
          ...DEFAULT_SETTINGS.company,
          ...(contacts ? { website: "www.example.co.uk", phone: "0100 000 0000", supportEmail: "hr@example.invalid", address: "1 Example Road, Example Town" } : {}),
        },
        colors: { primary: "#02214F", secondary: "#D11E25", accent: "#0B3A7E" },
        template: parseTemplateConfig(cfg),
        watermark: wm,
      });
    }
  return out;
}
