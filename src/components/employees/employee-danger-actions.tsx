"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { archiveEmployeeAction, deleteEmployeeAction } from "@/app/(admin)/employees/actions";

export function EmployeeDangerActions({
  employeeId,
  name,
  archived,
  canArchive,
  canDelete,
  hasCards,
}: {
  employeeId: string;
  name: string;
  archived: boolean;
  canArchive: boolean;
  canDelete: boolean;
  hasCards: boolean;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"archive" | "delete" | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; message?: string } | null>) =>
    startTransition(async () => {
      const res = await fn();
      if (res?.ok) {
        toast.success(res.message);
        setDialog(null);
        router.refresh();
      } else if (res) toast.error(res.message);
    });

  return (
    <>
      {canArchive ? (
        archived ? (
          <Button variant="outline" onClick={() => run(() => archiveEmployeeAction(employeeId, false))} disabled={pending}>
            <ArchiveRestore /> Restore
          </Button>
        ) : (
          <Button variant="outline" onClick={() => setDialog("archive")}>
            <Archive /> Archive
          </Button>
        )
      ) : null}
      {canDelete && !hasCards ? (
        <Button variant="danger-outline" onClick={() => setDialog("delete")} aria-label="Delete employee">
          <Trash2 /> Delete
        </Button>
      ) : null}

      <Dialog open={dialog === "archive"} onClose={() => setDialog(null)} title={`Archive ${name}?`} description="Archived employees are hidden from lists and any active ID card is disabled immediately. Card history is kept. You can restore them later." size="sm">
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDialog(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => run(() => archiveEmployeeAction(employeeId, true))} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Archive />} Archive employee
          </Button>
        </div>
      </Dialog>

      <Dialog open={dialog === "delete"} onClose={() => setDialog(null)} title={`Permanently delete ${name}?`} description="This removes the record and photo. It cannot be undone. Only employees who were never issued a card can be deleted." size="sm">
        <label htmlFor="confirm-delete" className="text-sm">
          Type <span className="font-semibold">DELETE</span> to confirm
        </label>
        <input
          id="confirm-delete"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          className="mt-2 h-10 w-full rounded-lg border border-input bg-card px-3 text-sm"
          autoComplete="off"
        />
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDialog(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => run(() => deleteEmployeeAction(employeeId))} disabled={pending || confirmText !== "DELETE"}>
            {pending ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete permanently
          </Button>
        </div>
      </Dialog>
    </>
  );
}
