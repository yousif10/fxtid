"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-form-action";
import { CARD_DIMENSIONS, CARD_LAYOUTS, LAYOUT_KEYS, ORIENTATION_LABELS, resolveLayout, type CardOrientation, type CardTemplateConfig } from "@/lib/cards/templates";
import { saveTemplateAction } from "@/app/(admin)/templates/actions";

export type TemplateRow = {
  id: string;
  name: string;
  description: string | null;
  config: CardTemplateConfig;
  layout: string;
  orientation: CardOrientation;
  isDefault: boolean;
  active: boolean;
};

export function TemplateEditor({ template }: { template?: TemplateRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { pending, onSubmit, errorFor } = useFormAction(saveTemplateAction, {
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });
  const c = template?.config;
  return (
    <>
      {template ? (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Pencil /> Edit
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus /> New template
        </Button>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title={template ? `Edit ${template.name}` : "New card template"} description="Templates are variants of the FXT card design. Changes apply to cards shown or exported after saving." size="lg">
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
          {template ? <input type="hidden" name="id" value={template.id} /> : null}
          <Field label="Template name" htmlFor="t-name" required error={errorFor("name")}>
            <Input id="t-name" name="name" defaultValue={template?.name ?? ""} maxLength={60} />
          </Field>
          <Field
            label="Layout / orientation"
            htmlFor="t-layout"
            error={errorFor("layout")}
            hint={template ? "Changing this affects only cards issued afterwards." : undefined}
          >
            <Select id="t-layout" name="layout" defaultValue={resolveLayout(template?.layout)}>
              {LAYOUT_KEYS.map((k) => {
                const o = CARD_LAYOUTS[k].orientation;
                return (
                  <option key={k} value={k}>
                    {ORIENTATION_LABELS[o]} ({CARD_DIMENSIONS[o].widthMm} × {CARD_DIMENSIONS[o].heightMm} mm) · {CARD_LAYOUTS[k].name}
                  </option>
                );
              })}
            </Select>
          </Field>
          <Field label="Card title" htmlFor="t-title" required error={errorFor("cardTitle")} hint="Printed in the card header.">
            <Input id="t-title" name="cardTitle" defaultValue={c?.cardTitle ?? "STAFF IDENTITY CARD"} maxLength={28} className="uppercase" />
          </Field>
          <Field label="Role label" htmlFor="t-label" error={errorFor("roleLabel")} hint="e.g. DRIVER. Leave blank for none.">
            <Input id="t-label" name="roleLabel" defaultValue={c?.roleLabel ?? ""} maxLength={18} className="uppercase" />
          </Field>
          <Field label="Label colour" htmlFor="t-accent">
            <Select id="t-accent" name="accent" defaultValue={c?.accent ?? "secondary"}>
              <option value="secondary">FXT red</option>
              <option value="primary">FXT navy</option>
            </Select>
          </Field>
          <Field label="Description" htmlFor="t-desc" className="sm:col-span-2" error={errorFor("description")}>
            <Textarea id="t-desc" name="description" rows={2} defaultValue={template?.description ?? ""} maxLength={200} />
          </Field>
          <fieldset className="grid gap-2 text-sm sm:col-span-2 sm:grid-cols-2">
            <legend className="mb-2 text-[13px] font-medium">Options</legend>
            <label className="flex items-center gap-2">
              <Checkbox name="showDepartment" defaultChecked={c?.showDepartment ?? true} /> Show department on front
            </label>
            <label className="flex items-center gap-2">
              <Checkbox name="showQrOnFront" defaultChecked={c?.showQrOnFront ?? true} /> QR code on front
            </label>
            <label className="flex items-center gap-2">
              <Checkbox name="showSignatureLine" defaultChecked={c?.showSignatureLine ?? true} /> Signature line on back
            </label>
            <label className="flex items-center gap-2">
              <Checkbox name="active" defaultChecked={template?.active ?? true} /> Active
            </label>
            <label className="flex items-center gap-2">
              <Checkbox name="isDefault" defaultChecked={template?.isDefault ?? false} /> Default template for new cards
            </label>
          </fieldset>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null} Save template
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
