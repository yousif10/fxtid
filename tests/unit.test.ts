import { describe, expect, it } from "vitest";
import { Resvg } from "@resvg/resvg-js";
import jsQR from "jsqr";
import { addMonthsIso, daysBetween, formatCardDate, isIsoDate } from "@/lib/dates";
import { cardDisplayState, effectiveCardStatus, supersededStatusFor } from "@/lib/cards/status";
import { formatCardNumber, generateVerificationToken, normaliseToken, TOKEN_RE, verificationUrl } from "@/lib/cards/tokens";
import { escapeXml, fitText, measureText } from "@/lib/cards/text";
import { renderCardSvg } from "@/lib/cards/render";
import { parseTemplateConfig } from "@/lib/cards/templates";
import { can } from "@/lib/permissions";
import { DEFAULT_SETTINGS } from "@/lib/validation/settings";
import { employeeSchema } from "@/lib/validation/employee";
import path from "node:path";
import fs from "node:fs";

describe("dates", () => {
  it("adds months with end-of-month clamping", () => {
    expect(addMonthsIso("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsIso("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonthsIso("2026-01-01", 24)).toBe("2028-01-01");
  });
  it("validates ISO dates", () => {
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-02-28")).toBe(true);
  });
  it("formats unambiguous card dates", () => {
    expect(formatCardDate("2028-01-01")).toBe("01 JAN 2028");
    expect(daysBetween("2026-01-01", "2026-01-31")).toBe(30);
  });
});

describe("card status", () => {
  it("treats an active card past expiry as expired regardless of stored status", () => {
    expect(effectiveCardStatus({ status: "active", expiresAt: "2026-01-01" }, "2026-01-02")).toBe("expired");
    expect(effectiveCardStatus({ status: "active", expiresAt: "2026-01-01" }, "2026-01-01")).toBe("active");
    expect(effectiveCardStatus({ status: "disabled", expiresAt: "2030-01-01" }, "2026-01-01")).toBe("disabled");
  });
  it("flags cards expiring soon", () => {
    expect(cardDisplayState({ status: "active", expiresAt: "2026-01-20" }, 30, "2026-01-01")).toBe("expiring_soon");
    expect(cardDisplayState(null, 30)).toBe("none");
  });
  it("chooses the right superseded status", () => {
    expect(supersededStatusFor("lost", false)).toBe("lost");
    expect(supersededStatusFor("renewal", true)).toBe("expired");
    expect(supersededStatusFor("damaged", false)).toBe("replaced");
  });
});

describe("tokens & numbers", () => {
  it("generates 128-bit base32 tokens that are unique", () => {
    const set = new Set(Array.from({ length: 2000 }, generateVerificationToken));
    expect(set.size).toBe(2000);
    for (const t of set) expect(t).toMatch(TOKEN_RE);
  });
  it("normalises scanned tokens and rejects junk", () => {
    const t = generateVerificationToken();
    expect(normaliseToken(t.toLowerCase())).toBe(t);
    expect(normaliseToken("1234")).toBeNull();
    expect(normaliseToken("' OR 1=1 --")).toBeNull();
  });
  it("builds an upper-case QR URL for root deployments", () => {
    expect(verificationUrl("https://id.example.co.uk", "ABC")).toBe("HTTPS://ID.EXAMPLE.CO.UK/VERIFY/ABC");
    expect(verificationUrl("https://example.co.uk/id", "ABC")).toBe("https://example.co.uk/id/verify/ABC");
  });
  it("keeps card numbers distinct from employee numbers", () => {
    expect(formatCardNumber("CARD", "FXT-00127", "FXT", 1)).toBe("CARD-00127-01");
    expect(formatCardNumber("CARD", "FXT-00127", "FXT", 2)).toBe("CARD-00127-02");
    expect(formatCardNumber("CARD", "DRV-9", "FXT", 1)).toBe("CARD-DRV9-01");
  });
});

describe("text fitting & escaping", () => {
  it("measures and fits long names within the available width", () => {
    const fit = fitText("ALEXANDRA CATHERINE MONTGOMERY-SMYTHE", { weight: 800, maxSize: 3.55, minSize: 2.45, maxWidth: 46.78, maxLines: 2 });
    expect(fit.lines.length).toBeLessThanOrEqual(2);
    for (const l of fit.lines) expect(measureText(l, 800, fit.size)).toBeLessThanOrEqual(46.78 + 1e-6);
  });
  it("escapes markup so card SVGs cannot be used for XSS", () => {
    expect(escapeXml(`<script>alert("x")</script>&'`)).toBe("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;&apos;");
  });
});

describe("card artwork", () => {
  const verifyUrl = verificationUrl("https://id.example.co.uk", generateVerificationToken());
  const svgFor = (side: "front" | "back", name = "James Wilson") =>
    renderCardSvg({
      side,
      data: {
        fullName: name,
        positionName: "Operations Manager",
        departmentName: "Operations",
        employeeNumber: "FXT-00001",
        cardNumber: "CARD-00001-01",
        issuedAt: "2026-01-01",
        expiresAt: "2028-01-01",
        verifyUrl,
        photoHref: null,
      },
      company: DEFAULT_SETTINGS.company,
      colors: { primary: "#02214F", secondary: "#D11E25", accent: "#0B3A7E" },
      template: parseTemplateConfig({}),
    });

  it("uses exact CR80 physical dimensions", () => {
    const svg = svgFor("front");
    expect(svg).toContain('viewBox="0 0 53.98 85.6"');
    expect(svg).toContain('width="53.98mm" height="85.6mm"');
  });

  it("never renders user input as markup", () => {
    const svg = svgFor("front", `<img src=x onerror=alert(1)>`);
    expect(svg).not.toContain("<img");
    expect(svg).toContain("&lt;IMG");
  });

  it.each(["front", "back"] as const)("prints a QR code on the %s that decodes to the verification URL at 300 DPI", (side) => {
    const fontDir = path.join(process.cwd(), "public", "fonts");
    const fontFiles = fs.readdirSync(fontDir).map((f) => path.join(fontDir, f));
    const img = new Resvg(svgFor(side), { fitTo: { mode: "width", value: 638 }, font: { fontFiles, loadSystemFonts: false } }).render();
    const decoded = jsQR(new Uint8ClampedArray(img.pixels), img.width, img.height);
    expect(decoded?.data).toBe(verifyUrl);
  });
});

describe("permissions", () => {
  it("enforces the role matrix", () => {
    expect(can("viewer", "employees:write")).toBe(false);
    expect(can("viewer", "cards:read")).toBe(true);
    expect(can("hr", "cards:issue")).toBe(true);
    expect(can("hr", "cards:manage")).toBe(false);
    expect(can("hr", "employees:delete")).toBe(false);
    expect(can("admin", "users:manage")).toBe(false);
    expect(can("super_admin", "users:manage")).toBe(true);
    expect(can(null, "cards:read")).toBe(false);
  });
});

describe("validation", () => {
  it("normalises and validates employee input", () => {
    const ok = employeeSchema.parse({ fullName: "  Emma   Taylor ", employeeNumber: "fxt-00042", email: "", employmentStatus: "active" });
    expect(ok.fullName).toBe("Emma Taylor");
    expect(ok.employeeNumber).toBe("FXT-00042");
    expect(ok.email).toBeNull();
    expect(employeeSchema.safeParse({ fullName: "<b>x</b>" }).success).toBe(false);
    expect(employeeSchema.safeParse({ fullName: "Seán O'Brien-Nuñez" }).success).toBe(true);
    expect(employeeSchema.safeParse({ fullName: "Ann", startDate: "2026-05-01", endDate: "2026-04-01" }).success).toBe(false);
  });
});
