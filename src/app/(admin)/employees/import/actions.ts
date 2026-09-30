"use server";

import { revalidatePath } from "next/cache";
import { runAction, type ActionState } from "@/lib/actions";
import { assertPermission } from "@/lib/auth/session";
import { getClientIp } from "@/lib/request";
import { DomainError } from "@/lib/services/cards";
import { commitImport, previewImport, type ImportPreview } from "@/lib/services/import";

const MAX_CSV_BYTES = 2 * 1024 * 1024;

function readCsv(fd: FormData) {
  const csv = fd.get("csv");
  if (typeof csv !== "string" || !csv.trim()) throw new DomainError("Choose a CSV file first.");
  if (csv.length > MAX_CSV_BYTES) throw new DomainError("CSV file is too large (max 2 MB).");
  return { csv, createMissing: fd.get("createMissing") === "on" };
}

export async function previewImportAction(_prev: ActionState<ImportPreview>, fd: FormData): Promise<ActionState<ImportPreview>> {
  return runAction(async () => {
    await assertPermission("employees:import");
    const { csv, createMissing } = readCsv(fd);
    const preview = await previewImport(csv, { createMissing });
    return { ok: true, data: preview };
  });
}

export async function commitImportAction(_prev: ActionState<{ created: number }>, fd: FormData): Promise<ActionState<{ created: number }>> {
  return runAction(async () => {
    const user = await assertPermission("employees:import");
    const { csv, createMissing } = readCsv(fd);
    const res = await commitImport({ id: user.id, email: user.email }, csv, { createMissing }, await getClientIp());
    revalidatePath("/employees");
    return { ok: true, message: `Imported ${res.created} employees.`, data: res };
  });
}
