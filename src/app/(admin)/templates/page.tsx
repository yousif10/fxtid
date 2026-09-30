import type { Metadata } from "next";
import { CardArtwork } from "@/components/cards/card-artwork";
import { OrientationBadge } from "@/components/cards/card-status-badge";
import { TemplateEditor } from "@/components/admin/template-editor";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { requirePagePermission } from "@/lib/auth/session";
import { renderCardSvg } from "@/lib/cards/render";
import { CARD_LAYOUTS, isCardLayout, templateDisplayName } from "@/lib/cards/templates";
import { cn } from "@/lib/utils";
import { verificationUrl } from "@/lib/cards/tokens";
import { addMonthsIso, todayIso } from "@/lib/dates";
import { env } from "@/lib/env";
import { can } from "@/lib/permissions";
import { listTemplates } from "@/lib/services/templates";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Card templates" };

export default async function TemplatesPage() {
  const user = await requirePagePermission("cards:read");
  const [templates, settings] = await Promise.all([listTemplates(), getSettings()]);
  const today = todayIso();
  const canManage = can(user.role, "templates:manage");
  const specimen = (config: (typeof templates)[number]["config"], layout: string, side: "front" | "back", key: string) =>
    renderCardSvg({
      side,
      layout,
      idPrefix: `tpl-${key}`,
      data: {
        fullName: "Sample Employee",
        positionName: "Job Title",
        departmentName: "Department",
        employeeNumber: `${settings.cards.employeeNumberPrefix}-${"0".repeat(settings.cards.employeeNumberDigits - 1)}0`,
        cardNumber: `${settings.cards.cardNumberPrefix}-00000-01`,
        issuedAt: today,
        expiresAt: addMonthsIso(today, settings.cards.defaultValidityMonths),
        verifyUrl: verificationUrl(env.APP_URL, "SPECIMENSPECIMENSPECIMEN22"),
        photoHref: null,
      },
      company: settings.company,
      colors: { primary: settings.branding.primaryColor, secondary: settings.branding.secondaryColor, accent: settings.branding.accentColor },
      template: config,
      watermark: "SPECIMEN",
    });

  return (
    <>
      <PageHeader
        eyebrow="Design"
        title="Card templates"
        description="Variants of the FXT CR80 card design for different staff groups. Each issued card remembers its template."
        actions={canManage ? <TemplateEditor /> : null}
      />
      <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
        {templates.map((t) => (
          <Card key={t.id} className="flex flex-col">
            <div
              className={cn(
                "grid flex-1 content-center gap-4 rounded-t-2xl bg-[radial-gradient(circle_at_30%_20%,#e9eef6,#d3dbe7)] p-6 dark:bg-[radial-gradient(circle_at_30%_20%,#1a2640,#0c1426)]",
                t.orientation === "landscape" ? "grid-cols-1 justify-items-center" : "grid-cols-2",
              )}
            >
              {(["front", "back"] as const).map((side) => (
                <CardArtwork
                  key={side}
                  svg={specimen(t.config, t.layout, side, t.id.slice(0, 6))}
                  orientation={t.orientation}
                  className={t.orientation === "landscape" ? "w-full max-w-[17rem]" : undefined}
                  label={`${t.name} ${side}`}
                />
              ))}
            </div>
            <div className="flex flex-col p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold">{templateDisplayName(t.name, t.orientation)}</h2>
                <OrientationBadge orientation={t.orientation} />
                {t.isDefault ? <Badge tone="navy">Default</Badge> : null}
                {!t.active ? <Badge>Inactive</Badge> : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {isCardLayout(t.layout) ? CARD_LAYOUTS[t.layout].name : t.layout} · {t.cardCount} card{t.cardCount === 1 ? "" : "s"}
                </span>
                {canManage ? <TemplateEditor template={t} /> : null}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
