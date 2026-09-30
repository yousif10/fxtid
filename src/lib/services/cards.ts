import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { audit } from "@/lib/audit";
import { effectiveCardStatus, supersededStatusFor, type CardIssueReason, type StoredCardStatus } from "@/lib/cards/status";
import {
  orientationOfLayout,
  parseTemplateConfig,
  resolveLayout,
  type CardLayoutKey,
  type CardOrientation,
  type CardTemplateConfig,
} from "@/lib/cards/templates";
import { formatCardNumber, generateVerificationToken, verificationUrl } from "@/lib/cards/tokens";
import { addDaysIso, addMonthsIso, todayIso } from "@/lib/dates";
import { db, type Tx } from "@/lib/db";
import { cardTemplates, departments, employeeCards, employees, positions, users, type CardSnapshot } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import type { CardIssueInput, CardStatusAction } from "@/lib/validation/card";

export class DomainError extends Error {
  constructor(
    message: string,
    public field?: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

type Actor = { id: string; email: string };

/**
 * Template for a new card: the explicitly chosen one, otherwise the template of
 * the card being replaced (so a landscape card is reissued as landscape), otherwise
 * the default template.
 */
async function resolveTemplate(tx: Tx, templateId: string | null, previousTemplateId: string | null) {
  if (!templateId && previousTemplateId) {
    const [prev] = await tx
      .select()
      .from(cardTemplates)
      .where(and(eq(cardTemplates.id, previousTemplateId), eq(cardTemplates.active, true)))
      .limit(1);
    if (prev) return prev;
  }
  if (templateId) {
    const [t] = await tx.select().from(cardTemplates).where(and(eq(cardTemplates.id, templateId), eq(cardTemplates.active, true))).limit(1);
    if (!t) throw new DomainError("The selected card template is not available.", "templateId");
    return t;
  }
  const [def] = await tx.select().from(cardTemplates).where(eq(cardTemplates.isDefault, true)).limit(1);
  if (def) return def;
  const [any] = await tx.select().from(cardTemplates).where(eq(cardTemplates.active, true)).limit(1);
  return any ?? null;
}

/**
 * Issues a new card for an employee. If the employee has an active card it is
 * superseded (replaced / lost / expired) atomically, so exactly one card can
 * verify as valid at any time. Full history is preserved.
 */
export async function issueCard(actor: Actor, input: CardIssueInput, ip: string | null) {
  const settings = await getSettings();
  const today = todayIso();

  return db.transaction(async (tx) => {
    // Serialise concurrent issues for the same employee.
    const [emp] = await tx
      .select({
        id: employees.id,
        employeeNumber: employees.employeeNumber,
        fullName: employees.fullName,
        displayName: employees.displayName,
        photoKey: employees.photoKey,
        employmentStatus: employees.employmentStatus,
        archivedAt: employees.archivedAt,
        departmentName: departments.name,
        positionName: positions.name,
      })
      .from(employees)
      .leftJoin(departments, eq(departments.id, employees.departmentId))
      .leftJoin(positions, eq(positions.id, employees.positionId))
      .where(eq(employees.id, input.employeeId))
      .for("update", { of: employees })
      .limit(1);
    if (!emp) throw new DomainError("Employee not found.");
    if (emp.archivedAt) throw new DomainError("This employee is archived. Restore them before issuing a card.");
    if (emp.employmentStatus === "left" || emp.employmentStatus === "suspended") {
      throw new DomainError("Cards can only be issued to active employees or employees on leave.");
    }
    if (settings.cards.requirePhotoForIssue && !emp.photoKey) {
      throw new DomainError("Upload a photograph before issuing a card (required by settings).");
    }

    const history = await tx
      .select({ id: employeeCards.id, status: employeeCards.status, expiresAt: employeeCards.expiresAt, version: employeeCards.version, templateId: employeeCards.templateId })
      .from(employeeCards)
      .where(eq(employeeCards.employeeId, emp.id))
      .orderBy(desc(employeeCards.version));
    const current = history.find((c) => c.status === "active") ?? null;
    if (input.reason === "new" && current) {
      throw new DomainError("This employee already has an active card. Choose a replacement or renewal reason.", "reason");
    }

    const expiresAt =
      input.expiresAt ?? addMonthsIso(today, input.validityMonths ?? settings.cards.defaultValidityMonths);
    if (expiresAt <= today) throw new DomainError("Expiry date must be in the future.", "expiresAt");
    if (expiresAt > addMonthsIso(today, 120)) throw new DomainError("Expiry date cannot be more than 10 years away.", "expiresAt");

    const template = await resolveTemplate(tx, input.templateId, current?.templateId ?? history[0]?.templateId ?? null);
    const layout = resolveLayout(template?.layout);

    if (current) {
      const prevExpired = effectiveCardStatus({ status: current.status, expiresAt: current.expiresAt }, today) === "expired";
      await tx
        .update(employeeCards)
        .set({
          status: supersededStatusFor(input.reason, prevExpired),
          statusChangedAt: new Date(),
          statusChangedBy: actor.id,
          statusReason: `Superseded by new card (${input.reason.replace(/_/g, " ")})`,
        })
        .where(eq(employeeCards.id, current.id));
    }

    const version = (history[0]?.version ?? 0) + 1;
    const snapshot: CardSnapshot = {
      employeeNumber: emp.employeeNumber,
      fullName: emp.fullName,
      displayName: emp.displayName,
      positionName: emp.positionName,
      departmentName: emp.departmentName,
      photoKey: emp.photoKey,
      templateConfig: parseTemplateConfig(template?.config),
    };

    let cardNumber = formatCardNumber(settings.cards.cardNumberPrefix, emp.employeeNumber, settings.cards.employeeNumberPrefix, version);
    for (let attempt = 0; attempt < 5; attempt++) {
      const [clash] = await tx.select({ id: employeeCards.id }).from(employeeCards).where(eq(employeeCards.cardNumber, cardNumber)).limit(1);
      if (!clash) break;
      cardNumber = `${formatCardNumber(settings.cards.cardNumberPrefix, emp.employeeNumber.replace(/-/g, ""), "", version)}${attempt ? `-${attempt}` : ""}`;
    }

    // 128-bit random token: a collision is not a practical concern, and the unique
    // index guarantees integrity regardless (the transaction would simply fail).
    const [inserted] = await tx
      .insert(employeeCards)
      .values({
        employeeId: emp.id,
        cardNumber,
        verificationToken: generateVerificationToken(),
        templateId: template?.id ?? null,
        layout,
        orientation: orientationOfLayout(layout),
        version,
        issuedAt: today,
        expiresAt,
        status: "active",
        issueReason: input.reason,
        issueNote: input.note,
        snapshot,
        issuedBy: actor.id,
        replacedCardId: current?.id ?? history[0]?.id ?? null,
      })
      .returning({ id: employeeCards.id });

    await audit(
      {
        actor,
        action: "card.issued",
        entityType: "card",
        entityId: inserted.id,
        summary: `Issued ${cardNumber} to ${emp.fullName} (${emp.employeeNumber})`,
        metadata: { employeeId: emp.id, cardNumber, version, reason: input.reason, expiresAt, layout, template: template?.name ?? null, supersededCardId: current?.id ?? null },
        ip,
      },
      tx,
    );
    return { cardId: inserted.id, cardNumber };
  });
}

export async function changeCardStatus(actor: Actor, cardId: string, status: CardStatusAction, reason: string, ip: string | null) {
  return db.transaction(async (tx) => {
    const [card] = await tx.select().from(employeeCards).where(eq(employeeCards.id, cardId)).for("update").limit(1);
    if (!card) throw new DomainError("Card not found.");
    if (card.status !== "active" && !(card.status === "disabled" && status !== "disabled")) {
      throw new DomainError(`This card is already ${card.status} and cannot be changed to ${status}.`);
    }
    await tx
      .update(employeeCards)
      .set({ status, statusChangedAt: new Date(), statusChangedBy: actor.id, statusReason: reason })
      .where(eq(employeeCards.id, cardId));
    await audit(
      {
        actor,
        action: "card.status_changed",
        entityType: "card",
        entityId: cardId,
        summary: `${card.cardNumber}: ${card.status} → ${status}`,
        metadata: { from: card.status, to: status, reason, employeeId: card.employeeId },
        ip,
      },
      tx,
    );
    return card.employeeId;
  });
}

export async function reactivateCard(actor: Actor, cardId: string, reason: string, ip: string | null) {
  return db.transaction(async (tx) => {
    const [card] = await tx.select().from(employeeCards).where(eq(employeeCards.id, cardId)).for("update").limit(1);
    if (!card) throw new DomainError("Card not found.");
    if (card.status !== "disabled") throw new DomainError("Only disabled cards can be reactivated.");
    if (card.expiresAt < todayIso()) throw new DomainError("This card has expired. Issue a renewal instead.");
    const [other] = await tx
      .select({ id: employeeCards.id })
      .from(employeeCards)
      .where(and(eq(employeeCards.employeeId, card.employeeId), eq(employeeCards.status, "active")))
      .limit(1);
    if (other) throw new DomainError("The employee already has another active card.");
    const [emp] = await tx.select().from(employees).where(eq(employees.id, card.employeeId)).limit(1);
    if (!emp || emp.archivedAt || emp.employmentStatus === "left" || emp.employmentStatus === "suspended") {
      throw new DomainError("The employee is not active, so the card cannot be reactivated.");
    }
    await tx
      .update(employeeCards)
      .set({ status: "active", statusChangedAt: new Date(), statusChangedBy: actor.id, statusReason: reason })
      .where(eq(employeeCards.id, cardId));
    await audit(
      { actor, action: "card.reactivated", entityType: "card", entityId: cardId, summary: `${card.cardNumber} reactivated`, metadata: { reason }, ip },
      tx,
    );
    return card.employeeId;
  });
}

/** Disables the active card for an employee (used when archiving / leaving). */
export async function disableActiveCardsFor(tx: Tx, actor: Actor, employeeId: string, reason: string) {
  const updated = await tx
    .update(employeeCards)
    .set({ status: "disabled", statusChangedAt: new Date(), statusChangedBy: actor.id, statusReason: reason })
    .where(and(eq(employeeCards.employeeId, employeeId), eq(employeeCards.status, "active")))
    .returning({ id: employeeCards.id, cardNumber: employeeCards.cardNumber });
  for (const c of updated) {
    await audit(
      { actor, action: "card.status_changed", entityType: "card", entityId: c.id, summary: `${c.cardNumber}: active → disabled`, metadata: { reason, automatic: true } },
      tx,
    );
  }
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export type CardRecord = {
  id: string;
  employeeId: string;
  cardNumber: string;
  verificationToken: string;
  version: number;
  issuedAt: string;
  expiresAt: string;
  status: StoredCardStatus;
  issueReason: CardIssueReason;
  issueNote: string | null;
  snapshot: CardSnapshot;
  templateId: string | null;
  templateName: string | null;
  templateLayout: string | null;
  /** Layout/orientation captured at issue time - always used for rendering. */
  layout: CardLayoutKey;
  orientation: CardOrientation;
  templateConfig: CardTemplateConfig;
  issuedByName: string | null;
  statusChangedAt: Date | null;
  statusReason: string | null;
  replacedCardId: string | null;
  createdAt: Date;
  employeeIsDemo: boolean;
};

export async function getCard(cardId: string): Promise<CardRecord | null> {
  const [r] = await db
    .select({
      id: employeeCards.id,
      employeeId: employeeCards.employeeId,
      cardNumber: employeeCards.cardNumber,
      verificationToken: employeeCards.verificationToken,
      version: employeeCards.version,
      issuedAt: employeeCards.issuedAt,
      expiresAt: employeeCards.expiresAt,
      status: employeeCards.status,
      issueReason: employeeCards.issueReason,
      issueNote: employeeCards.issueNote,
      snapshot: employeeCards.snapshot,
      templateId: employeeCards.templateId,
      templateName: cardTemplates.name,
      templateLayout: cardTemplates.layout,
      templateConfig: cardTemplates.config,
      layout: employeeCards.layout,
      orientation: employeeCards.orientation,
      issuedByName: users.fullName,
      statusChangedAt: employeeCards.statusChangedAt,
      statusReason: employeeCards.statusReason,
      replacedCardId: employeeCards.replacedCardId,
      createdAt: employeeCards.createdAt,
      employeeIsDemo: employees.isDemo,
    })
    .from(employeeCards)
    .innerJoin(employees, eq(employees.id, employeeCards.employeeId))
    .leftJoin(cardTemplates, eq(cardTemplates.id, employeeCards.templateId))
    .leftJoin(users, eq(users.id, employeeCards.issuedBy))
    .where(eq(employeeCards.id, cardId))
    .limit(1);
  if (!r) return null;
  const layout = resolveLayout(r.layout);
  return { ...r, layout, orientation: orientationOfLayout(layout), templateConfig: parseTemplateConfig(r.snapshot.templateConfig ?? r.templateConfig) };
}

export async function getEmployeeCards(employeeId: string) {
  return db
    .select({
      id: employeeCards.id,
      cardNumber: employeeCards.cardNumber,
      version: employeeCards.version,
      issuedAt: employeeCards.issuedAt,
      expiresAt: employeeCards.expiresAt,
      status: employeeCards.status,
      issueReason: employeeCards.issueReason,
      statusReason: employeeCards.statusReason,
      statusChangedAt: employeeCards.statusChangedAt,
      templateName: cardTemplates.name,
      orientation: employeeCards.orientation,
      layout: employeeCards.layout,
      createdAt: employeeCards.createdAt,
    })
    .from(employeeCards)
    .leftJoin(cardTemplates, eq(cardTemplates.id, employeeCards.templateId))
    .where(eq(employeeCards.employeeId, employeeId))
    .orderBy(desc(employeeCards.version));
}

export function cardVerifyUrl(token: string): string {
  return verificationUrl(env.APP_URL, token);
}

/** Watermark for artwork that must not be usable as a genuine card. */
export function artworkWatermark(card: { status: StoredCardStatus; expiresAt: string }, isDemo: boolean): string | null {
  if (isDemo) return "DEMO · NOT VALID";
  const eff = effectiveCardStatus(card);
  if (eff === "active") return null;
  return `VOID · ${eff.toUpperCase()}`;
}

export { addDaysIso };
