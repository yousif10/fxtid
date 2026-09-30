"use server";

import { revalidatePath } from "next/cache";
import { runAction, type ActionState } from "@/lib/actions";
import { assertPermission } from "@/lib/auth/session";
import { getClientIp } from "@/lib/request";
import { deleteDepartment, deletePosition, saveDepartment, savePosition } from "@/lib/services/catalog";
import { departmentSchema, positionSchema } from "@/lib/validation/catalog";
import { formDataToObject, uuidSchema } from "@/lib/validation/common";

const idOf = (fd: FormData) => {
  const raw = fd.get("id");
  return typeof raw === "string" && raw ? uuidSchema.parse(raw) : null;
};

export async function saveDepartmentAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertPermission("catalog:manage");
    const id = idOf(fd);
    const input = departmentSchema.parse(formDataToObject(fd));
    await saveDepartment({ id: user.id, email: user.email }, id, input, await getClientIp());
    revalidatePath("/departments");
    return { ok: true, message: id ? "Department updated." : "Department created." };
  });
}

export async function deleteDepartmentAction(id: string): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertPermission("catalog:manage");
    await deleteDepartment({ id: user.id, email: user.email }, uuidSchema.parse(id), await getClientIp());
    revalidatePath("/departments");
    return { ok: true, message: "Department deleted." };
  });
}

export async function savePositionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertPermission("catalog:manage");
    const id = idOf(fd);
    const input = positionSchema.parse(formDataToObject(fd));
    await savePosition({ id: user.id, email: user.email }, id, input, await getClientIp());
    revalidatePath("/positions");
    return { ok: true, message: id ? "Position updated." : "Position created." };
  });
}

export async function deletePositionAction(id: string): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertPermission("catalog:manage");
    await deletePosition({ id: user.id, email: user.email }, uuidSchema.parse(id), await getClientIp());
    revalidatePath("/positions");
    return { ok: true, message: "Position deleted." };
  });
}
