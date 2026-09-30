"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction, type ActionState } from "@/lib/actions";
import { assertPermission } from "@/lib/auth/session";
import { LAYOUT_KEYS, type CardLayoutKey } from "@/lib/cards/templates";
import { getClientIp } from "@/lib/request";
import { saveTemplate } from "@/lib/services/templates";
import { checkbox, optionalString, uuidSchema } from "@/lib/validation/common";

const formSchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(60),
  layout: z.enum(LAYOUT_KEYS as [CardLayoutKey, ...CardLayoutKey[]], { message: "Choose a layout" }),
  description: optionalString(200),
  roleLabel: optionalString(18),
  accent: z.enum(["primary", "secondary"]),
  cardTitle: z.string().trim().min(2, "Enter a card title").max(28),
  showDepartment: checkbox,
  showQrOnFront: checkbox,
  showSignatureLine: checkbox,
  active: checkbox,
  isDefault: checkbox,
});

export async function saveTemplateAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await assertPermission("templates:manage");
    const rawId = fd.get("id");
    const id = typeof rawId === "string" && rawId ? uuidSchema.parse(rawId) : null;
    const v = formSchema.parse(Object.fromEntries([...fd.entries()].filter(([, val]) => typeof val === "string")));
    await saveTemplate(
      { id: user.id, email: user.email },
      id,
      {
        name: v.name,
        description: v.description,
        layout: v.layout,
        active: v.active,
        isDefault: v.isDefault,
        config: {
          roleLabel: v.roleLabel,
          accent: v.accent,
          cardTitle: v.cardTitle.toUpperCase(),
          showDepartment: v.showDepartment,
          showQrOnFront: v.showQrOnFront,
          showSignatureLine: v.showSignatureLine,
        },
      },
      await getClientIp(),
    );
    revalidatePath("/templates");
    return { ok: true, message: id ? "Template updated. New cards will use it; cards already issued keep the design they were printed with." : "Template created." };
  });
}
