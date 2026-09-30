import "server-only";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { effectiveCardStatus, type EffectiveCardStatus } from "@/lib/cards/status";
import { normaliseToken } from "@/lib/cards/tokens";
import { todayIso } from "@/lib/dates";
import { db } from "@/lib/db";
import { employeeCards, employees, verificationEvents } from "@/lib/db/schema";

export type VerificationResult =
  | {
      outcome: "valid";
      reference: string;
      checkedAt: Date;
      card: {
        cardNumber: string;
        issuedAt: string;
        expiresAt: string;
        fullName: string;
        employeeNumber: string;
        positionName: string | null;
        departmentName: string | null;
        hasPhoto: boolean;
        isDemo: boolean;
      };
    }
  | {
      outcome: "expired";
      reference: string;
      checkedAt: Date;
      card: { cardNumber: string; expiresAt: string; fullName: string; employeeNumber: string };
    }
  | {
      outcome: "invalid";
      reference: string;
      checkedAt: Date;
      reason: "disabled" | "replaced" | "lost" | "revoked" | "employee_inactive";
      card: { cardNumber: string };
    }
  | { outcome: "not_found"; reference: string; checkedAt: Date };

const newReference = () => randomBytes(5).toString("hex").toUpperCase();

type CardRow = {
  id: string;
  status: typeof employeeCards.$inferSelect.status;
  expiresAt: string;
  issuedAt: string;
  cardNumber: string;
  snapshot: typeof employeeCards.$inferSelect.snapshot;
  employmentStatus: typeof employees.$inferSelect.employmentStatus;
  archivedAt: Date | null;
  isDemo: boolean;
};

async function findCard(token: string): Promise<CardRow | null> {
  const [row] = await db
    .select({
      id: employeeCards.id,
      status: employeeCards.status,
      expiresAt: employeeCards.expiresAt,
      issuedAt: employeeCards.issuedAt,
      cardNumber: employeeCards.cardNumber,
      snapshot: employeeCards.snapshot,
      employmentStatus: employees.employmentStatus,
      archivedAt: employees.archivedAt,
      isDemo: employees.isDemo,
    })
    .from(employeeCards)
    .innerJoin(employees, eq(employees.id, employeeCards.employeeId))
    .where(eq(employeeCards.verificationToken, token))
    .limit(1);
  return row ?? null;
}

/** Card validity also requires the employee to still be current. */
function evaluate(row: CardRow, today: string): EffectiveCardStatus | "employee_inactive" {
  const status = effectiveCardStatus(row, today);
  if (status === "active" && (row.archivedAt || row.employmentStatus === "left" || row.employmentStatus === "suspended")) {
    return "employee_inactive";
  }
  return status;
}

/**
 * Live verification - always reads the database (never cached) so a disabled,
 * lost or revoked card stops validating immediately.
 */
export async function verifyToken(rawToken: string): Promise<VerificationResult> {
  const checkedAt = new Date();
  const reference = newReference();
  const token = normaliseToken(rawToken);
  const row = token ? await findCard(token) : null;

  if (!row) {
    await db.insert(verificationEvents).values({ cardId: null, result: "not_found", reference });
    return { outcome: "not_found", reference, checkedAt };
  }
  const state = evaluate(row, todayIso(checkedAt));
  const outcome = state === "active" ? "valid" : state === "expired" ? "expired" : "invalid";
  await db.insert(verificationEvents).values({ cardId: row.id, result: outcome, reference });

  const s = row.snapshot;
  if (outcome === "valid") {
    return {
      outcome,
      reference,
      checkedAt,
      card: {
        cardNumber: row.cardNumber,
        issuedAt: row.issuedAt,
        expiresAt: row.expiresAt,
        fullName: s.fullName,
        employeeNumber: s.employeeNumber,
        positionName: s.positionName,
        departmentName: s.departmentName,
        hasPhoto: !!s.photoKey,
        isDemo: row.isDemo,
      },
    };
  }
  if (outcome === "expired") {
    return { outcome, reference, checkedAt, card: { cardNumber: row.cardNumber, expiresAt: row.expiresAt, fullName: s.fullName, employeeNumber: s.employeeNumber } };
  }
  return {
    outcome: "invalid",
    reference,
    checkedAt,
    reason: state as "disabled" | "replaced" | "lost" | "revoked" | "employee_inactive",
    card: { cardNumber: row.cardNumber },
  };
}

/** Photo for the public verification page - only released while the card is valid. */
export async function verifiedPhotoKey(rawToken: string): Promise<string | null> {
  const token = normaliseToken(rawToken);
  if (!token) return null;
  const row = await findCard(token);
  if (!row || evaluate(row, todayIso()) !== "active") return null;
  return row.snapshot.photoKey;
}
