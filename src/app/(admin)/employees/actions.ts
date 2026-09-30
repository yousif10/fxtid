"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { runAction, type ActionState } from "@/lib/actions";
import { assertPermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { processPhoto, PhotoValidationError, type CropArea } from "@/lib/photos";
import { getClientIp } from "@/lib/request";
import { changeCardStatus, issueCard, reactivateCard } from "@/lib/services/cards";
import { createEmployee, deleteEmployee, setArchived, setEmployeePhoto, updateEmployee } from "@/lib/services/employees";
import { cardIssueSchema, cardReactivateSchema, cardStatusChangeSchema } from "@/lib/validation/card";
import { formDataToObject, uuidSchema } from "@/lib/validation/common";
import { employeeSchema } from "@/lib/validation/employee";

const actorOf = (u: { id: string; email: string }) => ({ id: u.id, email: u.email });

export async function createEmployeeAction(_prev: ActionState<{ id: string }>, fd: FormData): Promise<ActionState<{ id: string }>> {
  let createdId: string | null = null;
  const result = await runAction<{ id: string }>(async () => {
    const user = await assertPermission("employees:write");
    const input = employeeSchema.parse(formDataToObject(fd));
    const row = await createEmployee(actorOf(user), input, await getClientIp(), { allowManualNumber: can(user.role, "employees:set_number") });
    createdId = row.id;
    return { ok: true, message: `${input.fullName} added as ${row.employeeNumber}.`, data: { id: row.id } };
  });
  if (createdId) {
    revalidatePath("/employees");
    redirect(`/employees/${createdId}?created=1`);
  }
  return result;
}

export async function updateEmployeeAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let savedId: string | null = null;
  const result = await runAction(async () => {
    const user = await assertPermission("employees:write");
    const id = uuidSchema.parse(fd.get("id"));
    const input = employeeSchema.parse(formDataToObject(fd));
    await updateEmployee(actorOf(user), id, input, await getClientIp(), { allowManualNumber: can(user.role, "employees:set_number") });
    savedId = id;
    return { ok: true, message: "Employee updated." };
  });
  if (savedId) {
    revalidatePath(`/employees/${savedId}`);
    redirect(`/employees/${savedId}?saved=1`);
  }
  return result;
}

export async function archiveEmployeeAction(id: string, archived: boolean): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertPermission("employees:write");
    await setArchived(actorOf(user), uuidSchema.parse(id), archived, await getClientIp());
    revalidatePath(`/employees/${id}`);
    return { ok: true, message: archived ? "Employee archived. Any active card has been disabled." : "Employee restored." };
  });
}

export async function deleteEmployeeAction(id: string): Promise<ActionState> {
  const result = await runAction(async () => {
    const user = await assertPermission("employees:delete");
    await deleteEmployee(actorOf(user), uuidSchema.parse(id), await getClientIp());
    return { ok: true, message: "Employee deleted." };
  });
  if (result?.ok) {
    revalidatePath("/employees");
    redirect("/employees?deleted=1");
  }
  return result;
}

const cropSchema = z
  .object({ x: z.number().finite().min(0), y: z.number().finite().min(0), width: z.number().finite().positive(), height: z.number().finite().positive() })
  .nullable();

export async function uploadPhotoAction(fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertPermission("employees:write");
    const id = uuidSchema.parse(fd.get("id"));
    const file = fd.get("photo");
    if (!(file instanceof File)) throw new PhotoValidationError("Choose a photo to upload.");
    const rawCrop = fd.get("crop");
    const crop: CropArea | null = typeof rawCrop === "string" && rawCrop ? cropSchema.parse(JSON.parse(rawCrop)) : null;
    const processed = await processPhoto(file, crop);
    await setEmployeePhoto(actorOf(user), id, processed, await getClientIp());
    revalidatePath(`/employees/${id}`);
    return { ok: true, message: "Photo saved. Issue a new card if the printed card should show it." };
  });
}

export async function removePhotoAction(id: string): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertPermission("employees:write");
    await setEmployeePhoto(actorOf(user), uuidSchema.parse(id), null, await getClientIp());
    revalidatePath(`/employees/${id}`);
    return { ok: true, message: "Photo removed." };
  });
}

export async function issueCardAction(_prev: ActionState<{ cardId: string }>, fd: FormData): Promise<ActionState<{ cardId: string }>> {
  return runAction(async () => {
    const user = await assertPermission("cards:issue");
    const input = cardIssueSchema.parse(formDataToObject(fd));
    const res = await issueCard(actorOf(user), input, await getClientIp());
    revalidatePath(`/employees/${input.employeeId}`);
    return { ok: true, message: `Card ${res.cardNumber} issued.`, data: { cardId: res.cardId } };
  });
}

export async function changeCardStatusAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertPermission("cards:manage");
    const input = cardStatusChangeSchema.parse(formDataToObject(fd));
    const employeeId = await changeCardStatus(actorOf(user), input.cardId, input.status, input.reason, await getClientIp());
    revalidatePath(`/employees/${employeeId}`);
    revalidatePath(`/cards/${input.cardId}`);
    return { ok: true, message: `Card marked as ${input.status}. Its QR code no longer verifies as valid.` };
  });
}

export async function reactivateCardAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertPermission("cards:manage");
    const input = cardReactivateSchema.parse(formDataToObject(fd));
    const employeeId = await reactivateCard(actorOf(user), input.cardId, input.reason, await getClientIp());
    revalidatePath(`/employees/${employeeId}`);
    revalidatePath(`/cards/${input.cardId}`);
    return { ok: true, message: "Card reactivated." };
  });
}
