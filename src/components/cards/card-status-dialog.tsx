"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Select, Textarea } from "@/components/ui/form";
import { useFormAction } from "@/components/ui/use-form-action";
import { changeCardStatusAction, reactivateCardAction } from "@/app/(admin)/employees/actions";

export function CardStatusDialog({ cardId, cardNumber, size = "md" }: { cardId: string; cardNumber: string; size?: "sm" | "md" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { pending, onSubmit, errorFor } = useFormAction(changeCardStatusAction, {
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });
  return (
    <>
      <Button variant="danger-outline" size={size} onClick={() => setOpen(true)}>
        <Ban /> Disable / report lost
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Deactivate ${cardNumber}`} description="The QR code will immediately show this card as NOT valid. This is recorded in the audit log." size="sm">
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <input type="hidden" name="cardId" value={cardId} />
          <Field label="New status" htmlFor={`status-${cardId}`}>
            <Select id={`status-${cardId}`} name="status" defaultValue="disabled">
              <option value="disabled">Disabled (can be reactivated)</option>
              <option value="lost">Lost or stolen (permanent)</option>
              <option value="revoked">Revoked (permanent)</option>
            </Select>
          </Field>
          <Field label="Reason" htmlFor={`reason-${cardId}`} required error={errorFor("reason")}>
            <Textarea id={`reason-${cardId}`} name="reason" rows={3} required maxLength={300} placeholder="e.g. Reported lost by employee on 12/05" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Ban />} Deactivate card
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function ReactivateCardDialog({ cardId, cardNumber }: { cardId: string; cardNumber: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { pending, onSubmit, errorFor } = useFormAction(reactivateCardAction, {
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <RotateCcw /> Reactivate
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Reactivate ${cardNumber}?`} description="The card's QR code will verify as valid again until its expiry date." size="sm">
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <input type="hidden" name="cardId" value={cardId} />
          <Field label="Reason" htmlFor={`re-reason-${cardId}`} required error={errorFor("reason")}>
            <Textarea id={`re-reason-${cardId}`} name="reason" rows={2} required maxLength={300} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <RotateCcw />} Reactivate
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
