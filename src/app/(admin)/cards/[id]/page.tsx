import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ExternalLink, FileText, ImageDown, Printer } from "lucide-react";
import { CardPreviewStage } from "@/components/cards/card-preview-stage";
import { CardStatusBadge, DemoBadge, OrientationBadge } from "@/components/cards/card-status-badge";
import { CardStatusDialog, ReactivateCardDialog } from "@/components/cards/card-status-dialog";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DescriptionList } from "@/components/ui/misc";
import { requirePagePermission } from "@/lib/auth/session";
import { effectiveCardStatus, ISSUE_REASON_LABELS } from "@/lib/cards/status";
import { CARD_DIMENSIONS, ORIENTATION_LABELS, templateDisplayName } from "@/lib/cards/templates";
import { verificationUrlDisplay } from "@/lib/cards/tokens";
import { formatDateTime, formatUkDate, todayIso } from "@/lib/dates";
import { env } from "@/lib/env";
import { UUID_RE } from "@/lib/http";
import { can } from "@/lib/permissions";
import { buildCardSvg } from "@/lib/services/card-artwork";
import { getCard } from "@/lib/services/cards";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "ID card preview" };

const dl = "inline-flex h-9 items-center gap-2 rounded-lg border border-input bg-card px-3 text-sm font-semibold hover:bg-muted [&_svg]:size-4";

export default async function CardPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission("cards:read");
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const card = await getCard(id);
  if (!card) notFound();
  const settings = await getSettings();
  const [front, back] = await Promise.all([buildCardSvg(card, "front", "preview", "pv"), buildCardSvg(card, "back", "preview", "pv")]);
  const today = todayIso();
  const status = effectiveCardStatus(card, today);
  const verifyHref = `/verify/${card.verificationToken}`;
  const dims = CARD_DIMENSIONS[card.orientation];

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <nav aria-label="Breadcrumb" className="mb-2 text-sm text-muted-foreground">
            <Link href="/cards" className="hover:text-foreground">
              ID Cards
            </Link>{" "}
            /{" "}
            <Link href={`/employees/${card.employeeId}`} className="hover:text-foreground">
              {card.snapshot.fullName}
            </Link>
          </nav>
          <h1 className="flex flex-wrap items-center gap-3 font-mono text-2xl font-bold tracking-tight sm:text-[28px]">
            {card.cardNumber}
            <CardStatusBadge card={card} expiringSoonDays={settings.cards.expiringSoonDays} today={today} />
            <OrientationBadge orientation={card.orientation} />
            {card.employeeIsDemo ? <DemoBadge /> : null}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {card.snapshot.fullName} · {card.snapshot.employeeNumber} · {templateDisplayName(card.templateName, card.orientation)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href={`/employees/${card.employeeId}`} variant="outline">
            Employee record
          </LinkButton>
          {can(user.role, "cards:manage") && status === "active" ? <CardStatusDialog cardId={card.id} cardNumber={card.cardNumber} /> : null}
          {can(user.role, "cards:manage") && card.status === "disabled" ? <ReactivateCardDialog cardId={card.id} cardNumber={card.cardNumber} /> : null}
        </div>
      </div>

      {status !== "active" ? (
        <div role="status" className="mb-6 flex items-start gap-3 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold">This card is not valid ({status}).</p>
            <p>Its QR code shows an invalid result and all exports carry a VOID watermark. {can(user.role, "cards:issue") ? "Issue a new card from the employee record." : ""}</p>
          </div>
        </div>
      ) : null}
      {card.employeeIsDemo ? (
        <div role="status" className="mb-6 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
          Demo record — artwork is watermarked and must never be printed as a real ID.
        </div>
      ) : null}

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader
            title="Card preview"
            description={`CR80 / ID-1 · ${ORIENTATION_LABELS[card.orientation]} ${dims.widthMm} × ${dims.heightMm} mm · print-ready artwork`}
            actions={
              <div className="flex flex-wrap gap-2">
                <LinkButton href={`/print/cards/${card.id}?side=both`} target="_blank" size="sm">
                  <Printer /> Print both sides
                </LinkButton>
                <LinkButton href={`/print/cards/${card.id}?side=front`} target="_blank" size="sm" variant="outline">
                  Front
                </LinkButton>
                <LinkButton href={`/print/cards/${card.id}?side=back`} target="_blank" size="sm" variant="outline">
                  Back
                </LinkButton>
              </div>
            }
          />
          <CardBody>
            <CardPreviewStage front={front} back={back} orientation={card.orientation} />
          </CardBody>
          <div className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-4">
            <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">PDF</span>
            <a className={dl} href={`/api/cards/${card.id}/export?format=pdf&side=both`}>
              <FileText /> Front + back
            </a>
            <a className={dl} href={`/api/cards/${card.id}/export?format=pdf&side=front`}>
              Front
            </a>
            <a className={dl} href={`/api/cards/${card.id}/export?format=pdf&side=back`}>
              Back
            </a>
            <span className="ml-3 mr-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">PNG 600 DPI</span>
            <a className={dl} href={`/api/cards/${card.id}/export?format=png&side=front`}>
              <ImageDown /> Front
            </a>
            <a className={dl} href={`/api/cards/${card.id}/export?format=png&side=back`}>
              Back
            </a>
            <a className={`${dl} ml-auto`} href={verifyHref} target="_blank" rel="noopener">
              <ExternalLink /> Verification page
            </a>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Card record" />
            <CardBody>
              <DescriptionList
                items={[
                  { label: "Card number", value: <span className="font-mono">{card.cardNumber}</span> },
                  { label: "Version", value: `#${card.version}` },
                  { label: "Design", value: templateDisplayName(card.templateName, card.orientation) },
                  { label: "Size", value: `${dims.widthMm} × ${dims.heightMm} mm (${ORIENTATION_LABELS[card.orientation].toLowerCase()})` },
                  { label: "Issued", value: formatUkDate(card.issuedAt) },
                  { label: "Expires", value: formatUkDate(card.expiresAt) },
                  { label: "Reason", value: <Badge>{ISSUE_REASON_LABELS[card.issueReason]}</Badge> },
                  { label: "Issued by", value: card.issuedByName ?? "—" },
                  { label: "Stored status", value: card.status },
                  { label: "Status changed", value: card.statusChangedAt ? formatDateTime(card.statusChangedAt) : "—" },
                ]}
              />
              {card.statusReason ? <p className="mt-4 rounded-lg bg-muted p-3 text-sm">{card.statusReason}</p> : null}
              {card.issueNote ? <p className="mt-4 rounded-lg bg-muted p-3 text-sm">Note: {card.issueNote}</p> : null}
              {card.replacedCardId ? (
                <p className="mt-4 text-sm">
                  Supersedes{" "}
                  <Link href={`/cards/${card.replacedCardId}`} className="font-semibold text-primary hover:underline dark:text-ring">
                    previous card
                  </Link>
                </p>
              ) : null}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="QR verification" description="Encoded in the QR code on both sides." />
            <CardBody>
              <p className="break-all rounded-lg bg-muted p-3 font-mono text-xs">{verificationUrlDisplay(env.APP_URL, card.verificationToken)}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                The token is a 128-bit random value with no personal data. Printed cards point to <span className="font-semibold">{env.APP_URL}</span> — set
                APP_URL to your production domain before printing.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
