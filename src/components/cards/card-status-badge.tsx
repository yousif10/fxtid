import { RectangleHorizontal, RectangleVertical } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { ORIENTATION_LABELS, type CardOrientation } from "@/lib/cards/templates";
import { cardDisplayState, type CardDisplayState, type StoredCardStatus } from "@/lib/cards/status";
import { EMPLOYMENT_STATUS_LABELS, type EmploymentStatus } from "@/lib/validation/employee";

const DISPLAY: Record<CardDisplayState, { label: string; tone: BadgeTone }> = {
  active: { label: "Active", tone: "success" },
  expiring_soon: { label: "Expiring soon", tone: "warning" },
  expired: { label: "Expired", tone: "danger" },
  disabled: { label: "Disabled", tone: "neutral" },
  replaced: { label: "Replaced", tone: "neutral" },
  lost: { label: "Lost", tone: "danger" },
  revoked: { label: "Revoked", tone: "danger" },
  none: { label: "No card", tone: "info" },
};

export function CardStatusBadge({
  card,
  expiringSoonDays,
  today,
}: {
  card: { status: StoredCardStatus; expiresAt: string } | null;
  expiringSoonDays: number;
  today?: string;
}) {
  const state = cardDisplayState(card, expiringSoonDays, today);
  const d = DISPLAY[state];
  return (
    <Badge tone={d.tone} dot>
      {d.label}
    </Badge>
  );
}

const EMPLOYMENT_TONES: Record<EmploymentStatus, BadgeTone> = {
  active: "success",
  on_leave: "info",
  suspended: "warning",
  left: "neutral",
};

export function EmploymentStatusBadge({ status, archived }: { status: EmploymentStatus; archived?: boolean }) {
  if (archived) return <Badge tone="neutral">Archived</Badge>;
  return <Badge tone={EMPLOYMENT_TONES[status]}>{EMPLOYMENT_STATUS_LABELS[status]}</Badge>;
}

export function DemoBadge() {
  return (
    <Badge tone="warning" title="Fictional record for development/testing">
      DEMO
    </Badge>
  );
}

export function OrientationBadge({ orientation }: { orientation: CardOrientation }) {
  const Icon = orientation === "landscape" ? RectangleHorizontal : RectangleVertical;
  return (
    <Badge tone="info" title={`${ORIENTATION_LABELS[orientation]} CR80 card`}>
      <Icon className="size-3" aria-hidden /> {ORIENTATION_LABELS[orientation]}
    </Badge>
  );
}
