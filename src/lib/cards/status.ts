import { daysBetween, todayIso } from "@/lib/dates";

export const CARD_STATUSES = ["active", "expired", "disabled", "replaced", "lost", "revoked"] as const;
export type StoredCardStatus = (typeof CARD_STATUSES)[number];

/** Status as it must be presented anywhere: an active card past its expiry is expired. */
export type EffectiveCardStatus = StoredCardStatus;

export const CARD_STATUS_LABELS: Record<EffectiveCardStatus, string> = {
  active: "Active",
  expired: "Expired",
  disabled: "Disabled",
  replaced: "Replaced",
  lost: "Reported lost",
  revoked: "Revoked",
};

/** Cards are valid up to and including their expiry date (UK time). */
export function effectiveCardStatus(
  card: { status: StoredCardStatus; expiresAt: string },
  today: string = todayIso(),
): EffectiveCardStatus {
  if (card.status === "active" && card.expiresAt < today) return "expired";
  return card.status;
}

export function isCardValid(card: { status: StoredCardStatus; expiresAt: string }, today: string = todayIso()) {
  return effectiveCardStatus(card, today) === "active";
}

export function daysUntilExpiry(expiresAt: string, today: string = todayIso()): number {
  return daysBetween(today, expiresAt);
}

/** Display state used for badges in lists ("expiring soon" is a presentation concern). */
export type CardDisplayState = EffectiveCardStatus | "expiring_soon" | "none";

export function cardDisplayState(
  card: { status: StoredCardStatus; expiresAt: string } | null | undefined,
  expiringSoonDays: number,
  today: string = todayIso(),
): CardDisplayState {
  if (!card) return "none";
  const eff = effectiveCardStatus(card, today);
  if (eff === "active" && daysUntilExpiry(card.expiresAt, today) <= expiringSoonDays) return "expiring_soon";
  return eff;
}

export const ISSUE_REASONS = [
  "new",
  "renewal",
  "lost",
  "damaged",
  "details_changed",
  "role_changed",
  "photo_changed",
  "other",
] as const;
export type CardIssueReason = (typeof ISSUE_REASONS)[number];

export const ISSUE_REASON_LABELS: Record<CardIssueReason, string> = {
  new: "First issue",
  renewal: "Renewal (expired / expiring)",
  lost: "Replacement - lost or stolen",
  damaged: "Replacement - damaged",
  details_changed: "Employee details changed",
  role_changed: "Role / department changed",
  photo_changed: "Photo updated",
  other: "Other",
};

/** Status given to the previous active card when a new card is issued for `reason`. */
export function supersededStatusFor(reason: CardIssueReason, prevExpired: boolean): StoredCardStatus {
  if (reason === "lost") return "lost";
  if (reason === "renewal" && prevExpired) return "expired";
  return "replaced";
}
