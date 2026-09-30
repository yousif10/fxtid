import "server-only";
import { asc, count, desc, eq, ne } from "drizzle-orm";
import { audit } from "@/lib/audit";
import { cardTemplateConfigSchema, isCardLayout, orientationOfLayout, parseTemplateConfig } from "@/lib/cards/templates";
import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/db/errors";
import { cardTemplates, employeeCards } from "@/lib/db/schema";
import { DomainError } from "./cards";

type Actor = { id: string; email: string };

export async function listTemplates() {
  const rows = await db
    .select({
      id: cardTemplates.id,
      name: cardTemplates.name,
      slug: cardTemplates.slug,
      description: cardTemplates.description,
      layout: cardTemplates.layout,
      orientation: cardTemplates.orientation,
      config: cardTemplates.config,
      isDefault: cardTemplates.isDefault,
      active: cardTemplates.active,
      updatedAt: cardTemplates.updatedAt,
    })
    .from(cardTemplates)
    .orderBy(desc(cardTemplates.isDefault), asc(cardTemplates.name), asc(cardTemplates.orientation));
  const usage = await db
    .select({ templateId: employeeCards.templateId, n: count() })
    .from(employeeCards)
    .groupBy(employeeCards.templateId);
  const byId = new Map(usage.map((u) => [u.templateId, u.n]));
  return rows.map((r) => ({ ...r, config: parseTemplateConfig(r.config), cardCount: byId.get(r.id) ?? 0 }));
}

export type TemplateInput = {
  name: string;
  description: string | null;
  layout: string;
  config: unknown;
  active: boolean;
  isDefault: boolean;
};

export async function saveTemplate(actor: Actor, id: string | null, input: TemplateInput, ip: string | null) {
  if (!isCardLayout(input.layout)) throw new DomainError("Unknown card layout.", "layout");
  const orientation = orientationOfLayout(input.layout);
  const config = cardTemplateConfigSchema.parse(input.config);
  if (input.isDefault && !input.active) throw new DomainError("The default template must be active.", "active");
  const slug = `${input.name}-${orientation}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  try {
    return await db.transaction(async (tx) => {
      if (input.isDefault) {
        await tx.update(cardTemplates).set({ isDefault: false }).where(id ? ne(cardTemplates.id, id) : eq(cardTemplates.isDefault, true));
      }
      if (id) {
        const [existing] = await tx.select().from(cardTemplates).where(eq(cardTemplates.id, id)).limit(1);
        if (!existing) throw new DomainError("Template not found.");
        if (existing.isDefault && !input.isDefault) throw new DomainError("Choose another default template first.", "isDefault");
        await tx
          .update(cardTemplates)
          .set({ name: input.name, description: input.description, layout: input.layout, orientation, config, active: input.active, isDefault: input.isDefault })
          .where(eq(cardTemplates.id, id));
        await audit({ actor, action: "template.updated", entityType: "template", entityId: id, summary: input.name, metadata: { config }, ip }, tx);
        return { id };
      }
      const [row] = await tx
        .insert(cardTemplates)
        .values({ name: input.name, slug, description: input.description, layout: input.layout, orientation, config, active: input.active, isDefault: input.isDefault })
        .returning({ id: cardTemplates.id });
      await audit({ actor, action: "template.created", entityType: "template", entityId: row.id, summary: input.name, metadata: { config }, ip }, tx);
      return row;
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new DomainError("A template with a similar name already exists.", "name");
    throw err;
  }
}
