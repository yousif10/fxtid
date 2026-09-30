"use client";

import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-form-action";
import type { AppSettings } from "@/lib/validation/settings";
import { saveSettingsAction } from "@/app/(admin)/settings/actions";

function SettingsCard({
  groupKey,
  title,
  description,
  canEdit,
  children,
}: {
  groupKey: keyof AppSettings;
  title: string;
  description: string;
  canEdit: boolean;
  children: (err: (n: string) => string | undefined) => React.ReactNode;
}) {
  const router = useRouter();
  const { pending, onSubmit, errorFor } = useFormAction(saveSettingsAction, { onSuccess: () => router.refresh() });
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <form onSubmit={onSubmit} noValidate>
        <input type="hidden" name="_key" value={groupKey} />
        <fieldset disabled={!canEdit} className="contents">
          <CardBody className="grid gap-5 sm:grid-cols-2">{children(errorFor)}</CardBody>
          {canEdit ? (
            <div className="flex justify-end border-t border-border px-5 py-3">
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : <Save />} Save
              </Button>
            </div>
          ) : null}
        </fieldset>
      </form>
    </Card>
  );
}

export function SettingsForms({ settings, canEdit }: { settings: AppSettings; canEdit: boolean }) {
  const c = settings.company;
  const k = settings.cards;
  const b = settings.branding;
  return (
    <div className="space-y-6">
      <SettingsCard groupKey="company" title="Company" description="Printed on the back of cards and on the verification page. Leave contact fields empty until confirmed." canEdit={canEdit}>
        {(err) => (
          <>
            <Field label="Legal name" htmlFor="legalName" required error={err("legalName")}>
              <Input id="legalName" name="legalName" defaultValue={c.legalName} />
            </Field>
            <Field label="Display name" htmlFor="displayName" required error={err("displayName")}>
              <Input id="displayName" name="displayName" defaultValue={c.displayName} />
            </Field>
            <Field label="Short name" htmlFor="shortName" required error={err("shortName")} hint="e.g. FXT">
              <Input id="shortName" name="shortName" defaultValue={c.shortName} maxLength={12} />
            </Field>
            <Field label="Tagline" htmlFor="tagline" error={err("tagline")}>
              <Input id="tagline" name="tagline" defaultValue={c.tagline ?? ""} />
            </Field>
            <Field label="Website" htmlFor="website" error={err("website")} hint="Not set - will not be printed until added.">
              <Input id="website" name="website" defaultValue={c.website ?? ""} placeholder="www.example.co.uk" />
            </Field>
            <Field label="Phone" htmlFor="phone" error={err("phone")}>
              <Input id="phone" name="phone" defaultValue={c.phone ?? ""} />
            </Field>
            <Field label="Support email" htmlFor="supportEmail" error={err("supportEmail")}>
              <Input id="supportEmail" name="supportEmail" type="email" defaultValue={c.supportEmail ?? ""} />
            </Field>
            <Field label="Address" htmlFor="address" error={err("address")}>
              <Input id="address" name="address" defaultValue={c.address ?? ""} />
            </Field>
            <Field label="Return-card text" htmlFor="returnText" required error={err("returnText")} className="sm:col-span-2">
              <Textarea id="returnText" name="returnText" rows={2} defaultValue={c.returnText} maxLength={200} />
            </Field>
          </>
        )}
      </SettingsCard>

      <SettingsCard groupKey="cards" title="ID cards" description="Defaults for numbering and validity. Existing employee numbers and cards are never renumbered." canEdit={canEdit}>
        {(err) => (
          <>
            <Field label="Default validity" htmlFor="defaultValidityMonths" error={err("defaultValidityMonths")}>
              <Select id="defaultValidityMonths" name="defaultValidityMonths" defaultValue={String(k.defaultValidityMonths)}>
                {[6, 12, 18, 24, 36, 48, 60].map((m) => (
                  <option key={m} value={m}>
                    {m} months
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="'Expiring soon' window" htmlFor="expiringSoonDays" error={err("expiringSoonDays")}>
              <Select id="expiringSoonDays" name="expiringSoonDays" defaultValue={String(k.expiringSoonDays)}>
                {[14, 30, 45, 60, 90].map((d) => (
                  <option key={d} value={d}>
                    {d} days
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Employee number prefix" htmlFor="employeeNumberPrefix" error={err("employeeNumberPrefix")} hint={`Next numbers look like ${k.employeeNumberPrefix}-${"0".repeat(k.employeeNumberDigits - 1)}1`}>
              <Input id="employeeNumberPrefix" name="employeeNumberPrefix" defaultValue={k.employeeNumberPrefix} className="font-mono uppercase" maxLength={8} />
            </Field>
            <Field label="Employee number digits" htmlFor="employeeNumberDigits" error={err("employeeNumberDigits")}>
              <Input id="employeeNumberDigits" name="employeeNumberDigits" type="number" min={3} max={8} defaultValue={k.employeeNumberDigits} />
            </Field>
            <Field label="Card number prefix" htmlFor="cardNumberPrefix" error={err("cardNumberPrefix")} hint="Card numbers: PREFIX-00001-01 (employee digits + card version).">
              <Input id="cardNumberPrefix" name="cardNumberPrefix" defaultValue={k.cardNumberPrefix} className="font-mono uppercase" maxLength={8} />
            </Field>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <Checkbox name="requirePhotoForIssue" defaultChecked={k.requirePhotoForIssue} /> Require a photo before issuing a card
            </label>
          </>
        )}
      </SettingsCard>

      <SettingsCard groupKey="branding" title="Branding" description="Card colours. Defaults are the official FXT logo colours. The logo itself is the unmodified brand asset." canEdit={canEdit}>
        {(err) => (
          <>
            {(
              [
                ["primaryColor", "Primary (navy)", b.primaryColor],
                ["secondaryColor", "Secondary (red)", b.secondaryColor],
                ["accentColor", "Accent (gradient)", b.accentColor],
              ] as const
            ).map(([name, label, value]) => (
              <Field key={name} label={label} htmlFor={name} error={err(name)}>
                <div className="flex gap-2">
                  <span className="size-10 shrink-0 rounded-lg ring-1 ring-border" style={{ background: value }} aria-hidden />
                  <Input id={name} name={name} defaultValue={value} className="font-mono uppercase" maxLength={7} />
                </div>
              </Field>
            ))}
            <div className="flex items-center gap-4 rounded-xl border border-border p-3 sm:col-span-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/logo.svg" alt="FXT logo" className="h-16 w-auto rounded-lg bg-white p-1" />
              <p className="text-sm text-muted-foreground">
                Official logo from <code className="rounded bg-muted px-1">public/brand/logo.svg</code>. To change it, replace that file (and run <code className="rounded bg-muted px-1">pnpm brand:build</code>) so card artwork stays vector-sharp.
              </p>
            </div>
          </>
        )}
      </SettingsCard>
    </div>
  );
}
