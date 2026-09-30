import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { ExternalLink, ScanLine, Search } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { CardStatusBadge } from "@/components/cards/card-status-badge";
import { requirePagePermission } from "@/lib/auth/session";
import { normaliseToken } from "@/lib/cards/tokens";
import { formatDateTime, formatUkDate, todayIso } from "@/lib/dates";
import { db } from "@/lib/db";
import { employeeCards, employees, verificationEvents } from "@/lib/db/schema";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Verification" };

const RESULT_TONES: Record<string, BadgeTone> = { valid: "success", expired: "warning", invalid: "danger", not_found: "neutral" };

export default async function VerificationPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePagePermission("cards:read");
  const { q: rawQ } = await searchParams;
  const settings = await getSettings();
  const q = rawQ?.trim().slice(0, 200) ?? "";

  // Accept a full verification URL, a bare token, or a card number.
  let match: { id: string; cardNumber: string; status: typeof employeeCards.$inferSelect.status; expiresAt: string; token: string; fullName: string; employeeId: string } | null = null;
  if (q) {
    const tokenCandidate = normaliseToken(q.split("/").filter(Boolean).pop() ?? "");
    const [row] = await db
      .select({
        id: employeeCards.id,
        cardNumber: employeeCards.cardNumber,
        status: employeeCards.status,
        expiresAt: employeeCards.expiresAt,
        token: employeeCards.verificationToken,
        fullName: employees.fullName,
        employeeId: employees.id,
      })
      .from(employeeCards)
      .innerJoin(employees, eq(employees.id, employeeCards.employeeId))
      .where(tokenCandidate ? eq(employeeCards.verificationToken, tokenCandidate) : sql`upper(${employeeCards.cardNumber}) = ${q.toUpperCase()}`)
      .limit(1);
    match = row ?? null;
  }

  const recent = await db
    .select({
      id: verificationEvents.id,
      result: verificationEvents.result,
      reference: verificationEvents.reference,
      createdAt: verificationEvents.createdAt,
      cardId: employeeCards.id,
      cardNumber: employeeCards.cardNumber,
      fullName: sql<string | null>`${employeeCards.snapshot}->>'fullName'`,
    })
    .from(verificationEvents)
    .leftJoin(employeeCards, eq(employeeCards.id, verificationEvents.cardId))
    .orderBy(desc(verificationEvents.createdAt))
    .limit(25);

  return (
    <>
      <PageHeader eyebrow="Security" title="Verification" description="Look up a card by QR link or card number, and review recent public QR scans." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader title="Check a card" description="Paste the URL from a scanned QR code, the token, or a card number." />
          <CardBody>
            <form className="flex gap-2" role="search">
              <label htmlFor="verify-q" className="sr-only">
                Verification URL or card number
              </label>
              <input
                id="verify-q"
                name="q"
                defaultValue={q}
                placeholder="https://…/verify/… or CARD-00001-01"
                className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-card px-3 font-mono text-sm"
              />
              <Button type="submit">
                <Search /> Check
              </Button>
            </form>
            {q ? (
              match ? (
                <div className="mt-6 rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-semibold">{match.cardNumber}</span>
                    <CardStatusBadge card={match} expiringSoonDays={settings.cards.expiringSoonDays} today={todayIso()} />
                  </div>
                  <p className="mt-1 text-sm">
                    {match.fullName} · expires {formatUkDate(match.expiresAt)}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 text-sm font-semibold">
                    <Link href={`/cards/${match.id}`} className="text-primary hover:underline dark:text-ring">
                      Open card
                    </Link>
                    <Link href={`/employees/${match.employeeId}`} className="text-primary hover:underline dark:text-ring">
                      Employee record
                    </Link>
                    <a href={`/verify/${match.token}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-primary hover:underline dark:text-ring">
                      Public result <ExternalLink className="size-3.5" />
                    </a>
                  </div>
                </div>
              ) : (
                <p role="alert" className="mt-6 rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm font-medium text-danger">
                  No card matches “{q}”. If this came from a card&apos;s QR code, the card is not genuine.
                </p>
              )
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Recent public scans" description="Every QR verification is logged (no personal data about the scanner is stored)." />
          {recent.length === 0 ? (
            <EmptyState icon={<ScanLine />} title="No scans yet" description="When someone scans a card's QR code it will appear here." />
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <Badge tone={RESULT_TONES[r.result] ?? "neutral"}>{r.result.replace("_", " ")}</Badge>
                  <span className="min-w-0 flex-1 truncate">
                    {r.cardId ? (
                      <Link href={`/cards/${r.cardId}`} className="font-mono font-medium hover:underline">
                        {r.cardNumber}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Unknown token</span>
                    )}
                    {r.fullName ? <span className="text-muted-foreground"> · {r.fullName}</span> : null}
                  </span>
                  <span className="hidden font-mono text-xs text-muted-foreground sm:inline">{r.reference}</span>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
