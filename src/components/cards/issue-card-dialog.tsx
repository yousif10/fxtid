"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { IdCard, Loader2, RectangleHorizontal, RectangleVertical, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-form-action";
import { renderCardSvg, type CardColors, type CardCompanyInfo } from "@/lib/cards/render";
import { ISSUE_REASON_LABELS, ISSUE_REASONS, type CardIssueReason } from "@/lib/cards/status";
import { CARD_DIMENSIONS, ORIENTATION_LABELS, templateDisplayName, type CardOrientation, type CardTemplateConfig } from "@/lib/cards/templates";
import { addMonthsIso } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { issueCardAction } from "@/app/(admin)/employees/actions";
import { CardArtwork } from "./card-artwork";

export type IssueTemplateOption = {
  id: string;
  name: string;
  isDefault: boolean;
  layout: string;
  orientation: CardOrientation;
  config: CardTemplateConfig;
};

export type IssuePreviewData = {
  fullName: string;
  positionName: string | null;
  departmentName: string | null;
  employeeNumber: string;
  photoUrl: string | null;
  company: CardCompanyInfo;
  colors: CardColors;
  today: string;
};

export function IssueCardDialog({
  employeeId,
  hasActiveCard,
  hasAnyCard,
  templates,
  defaultTemplateId,
  defaultValidityMonths,
  disabledReason,
  preview,
}: {
  employeeId: string;
  hasActiveCard: boolean;
  hasAnyCard: boolean;
  templates: IssueTemplateOption[];
  defaultTemplateId: string | null;
  defaultValidityMonths: number;
  disabledReason?: string | null;
  preview: IssuePreviewData;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [expiryMode, setExpiryMode] = useState<"months" | "date">("months");
  const initial = templates.find((t) => t.id === defaultTemplateId) ?? templates.find((t) => t.isDefault) ?? templates[0];
  const [orientation, setOrientation] = useState<CardOrientation>(initial?.orientation ?? "portrait");
  const [design, setDesign] = useState<string>(initial?.name ?? "");
  const [months, setMonths] = useState(defaultValidityMonths);
  const [side, setSide] = useState<"front" | "back">("front");
  const { pending, onSubmit, errorFor } = useFormAction(issueCardAction, {
    onSuccess: (s) => {
      setOpen(false);
      if (s.data?.cardId) router.push(`/cards/${s.data.cardId}?issued=1`);
      else router.refresh();
    },
  });

  const designs = useMemo(() => [...new Set(templates.map((t) => t.name))], [templates]);
  const available = (o: CardOrientation) => templates.some((t) => t.orientation === o);
  const selected =
    templates.find((t) => t.name === design && t.orientation === orientation) ??
    templates.find((t) => t.orientation === orientation && t.isDefault) ??
    templates.find((t) => t.orientation === orientation) ??
    null;

  const previewSvg = useMemo(() => {
    if (!selected) return null;
    return renderCardSvg({
      side,
      layout: selected.layout,
      idPrefix: "issue",
      data: {
        fullName: preview.fullName,
        positionName: preview.positionName,
        departmentName: preview.departmentName,
        employeeNumber: preview.employeeNumber,
        cardNumber: "CARD-·····-··",
        issuedAt: preview.today,
        expiresAt: addMonthsIso(preview.today, months),
        verifyUrl: `PREVIEW-${employeeId}`,
        photoHref: preview.photoUrl,
      },
      company: preview.company,
      colors: preview.colors,
      template: selected.config,
      watermark: "PREVIEW",
    });
  }, [selected, side, preview, months, employeeId]);

  const reasons = ISSUE_REASONS.filter((r) => (hasActiveCard ? r !== "new" : true));
  const defaultReason: CardIssueReason = hasActiveCard || hasAnyCard ? "renewal" : "new";
  const label = hasActiveCard ? "Reissue card" : hasAnyCard ? "Issue new card" : "Generate ID card";

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={!!disabledReason} title={disabledReason ?? undefined} variant={hasActiveCard ? "outline" : "primary"}>
        {hasActiveCard ? <RefreshCw /> : <IdCard />} {label}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title={label}
        description={
          hasActiveCard
            ? "A new card and QR code will be created. The current card will stop verifying as valid immediately."
            : "Creates a new card with a unique card number and a secure QR verification code."
        }
      >
        <form onSubmit={onSubmit} className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,15rem)]" noValidate>
          <input type="hidden" name="employeeId" value={employeeId} />
          <input type="hidden" name="templateId" value={selected?.id ?? ""} />
          <div className="min-w-0 space-y-4">
            <fieldset>
              <legend className="text-[13px] font-medium">Orientation</legend>
              <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Card orientation">
                {(["portrait", "landscape"] as const).map((o) => {
                  const Icon = o === "portrait" ? RectangleVertical : RectangleHorizontal;
                  const dims = CARD_DIMENSIONS[o];
                  return (
                    <button
                      key={o}
                      type="button"
                      role="radio"
                      aria-checked={orientation === o}
                      disabled={!available(o)}
                      onClick={() => setOrientation(o)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-left transition-colors hover:bg-muted disabled:opacity-40",
                        orientation === o && "border-ring bg-info-soft ring-1 ring-ring",
                      )}
                    >
                      <Icon className="size-6 shrink-0 text-primary dark:text-ring" aria-hidden />
                      <span>
                        <span className="block text-sm font-semibold">{ORIENTATION_LABELS[o]}</span>
                        <span className="block text-xs text-muted-foreground">
                          {dims.widthMm} × {dims.heightMm} mm
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <Field label="Design" htmlFor="design" error={errorFor("templateId")} hint={selected ? `Will issue: ${templateDisplayName(selected.name, selected.orientation)}` : "No template available in this orientation"}>
              <Select id="design" value={design} onChange={(e) => setDesign(e.target.value)}>
                {designs.map((d) => (
                  <option key={d} value={d} disabled={!templates.some((t) => t.name === d && t.orientation === orientation)}>
                    {d}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Reason" htmlFor="reason" error={errorFor("reason")}>
              <Select id="reason" name="reason" defaultValue={defaultReason}>
                {reasons.map((r) => (
                  <option key={r} value={r}>
                    {ISSUE_REASON_LABELS[r]}
                  </option>
                ))}
              </Select>
            </Field>
            <fieldset>
              <legend className="text-[13px] font-medium">Validity</legend>
              <div className="mt-2 flex flex-wrap gap-2 text-sm">
                {(["months", "date"] as const).map((m) => (
                  <label key={m} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-1.5 has-[:checked]:border-ring has-[:checked]:bg-info-soft">
                    <input type="radio" name="_expiryMode" value={m} checked={expiryMode === m} onChange={() => setExpiryMode(m)} className="accent-[var(--primary)]" />
                    {m === "months" ? "Duration" : "Specific expiry date"}
                  </label>
                ))}
              </div>
              <div className="mt-3">
                {expiryMode === "months" ? (
                  <Field label="Valid for" htmlFor="validityMonths" error={errorFor("validityMonths")}>
                    <Select id="validityMonths" name="validityMonths" value={String(months)} onChange={(e) => setMonths(Number(e.target.value))}>
                      {[...new Set([3, 6, 12, 24, 36, defaultValidityMonths])]
                        .sort((a, b) => a - b)
                        .map((m) => (
                          <option key={m} value={m}>
                            {m} months{m === defaultValidityMonths ? " (default)" : ""}
                          </option>
                        ))}
                    </Select>
                  </Field>
                ) : (
                  <Field label="Expiry date" htmlFor="expiresAt" error={errorFor("expiresAt")}>
                    <Input id="expiresAt" name="expiresAt" type="date" required />
                  </Field>
                )}
              </div>
            </fieldset>
            <Field label="Note" htmlFor="note" hint="Optional, recorded in the card history." error={errorFor("note")}>
              <Textarea id="note" name="note" rows={2} maxLength={300} />
            </Field>
          </div>

          <div className="min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium">Preview</span>
              <div className="flex rounded-md border border-border p-0.5 text-[11px] font-semibold" role="radiogroup" aria-label="Preview side">
                {(["front", "back"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={side === s}
                    onClick={() => setSide(s)}
                    className={cn("rounded px-2 py-0.5 capitalize text-muted-foreground", side === s && "bg-muted text-foreground")}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className={cn("mx-auto mt-3", orientation === "landscape" ? "max-w-[15rem]" : "max-w-[10rem]")}>
              {previewSvg && selected ? <CardArtwork svg={previewSvg} orientation={selected.orientation} label="Card preview" /> : null}
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {selected ? templateDisplayName(selected.name, selected.orientation) : "—"}
              <br />
              Card number and QR are generated on issue.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 md:col-span-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !selected}>
              {pending ? <Loader2 className="animate-spin" /> : <IdCard />} Issue {selected ? ORIENTATION_LABELS[selected.orientation].toLowerCase() : ""} card
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
