/* eslint-disable @next/next/no-img-element -- photo is served by a token-gated route */
import type { Metadata } from "next";
import { CheckCircle2, CircleAlert, Clock3, ShieldX, XCircle } from "lucide-react";
import { FxtLogo } from "@/components/admin/brand";
import { formatCardDate } from "@/lib/dates";
import { env } from "@/lib/env";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";
import { verifyToken, type VerificationResult } from "@/lib/services/verification";
import { getSettings } from "@/lib/settings";
import { LiveClock } from "./live-clock";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "ID card verification",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

const INVALID_REASONS: Record<string, string> = {
  disabled: "This card has been disabled by FXT.",
  replaced: "This card has been replaced by a newer card and is no longer valid.",
  lost: "This card has been reported lost or stolen.",
  revoked: "This card has been revoked.",
  employee_inactive: "The cardholder is no longer an active employee.",
};

export default async function VerifyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const settings = await getSettings();
  const ip = await getClientIp();
  const limited = !(await rateLimit(rateLimitKey("verify", ip), 60, 60_000)).ok;
  const result: VerificationResult | null = limited ? null : await verifyToken(token.slice(0, 64));
  const host = new URL(env.APP_URL).host;
  const company = settings.company;

  return (
    <main className="min-h-dvh bg-[#eef2f7] text-[#0f1b2d]" style={{ colorScheme: "light" }}>
      <div className="flex h-1.5" aria-hidden>
        <span className="w-[82%] bg-[#02214F]" />
        <span className="flex-1 bg-[#D11E25]" />
      </div>
      <div className="mx-auto w-full max-w-md px-4 pb-12 pt-6">
        <header className="flex items-center gap-3">
          <FxtLogo className="h-14" alt={company.legalName} />
          <div className="leading-tight">
            <p className="text-sm font-bold text-[#02214F]">{company.legalName}</p>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5b6778]">Staff ID verification</p>
          </div>
        </header>

        <div className="mt-6 animate-rise overflow-hidden rounded-3xl bg-white shadow-[0_2px_4px_rgba(2,33,79,.06),0_20px_50px_-20px_rgba(2,33,79,.35)]">
          {limited || !result ? (
            <StatusBanner tone="neutral" icon={<Clock3 />} title="Too many checks" subtitle="Please wait a minute and scan again." />
          ) : result.outcome === "valid" ? (
            <>
              <StatusBanner tone="valid" icon={<CheckCircle2 />} title={`Valid ${company.shortName} employee ID`} subtitle="This card is active and was issued by FXT." live />
              <div className="p-6">
                <div className="flex gap-5">
                  <div className="h-40 w-30 shrink-0 overflow-hidden rounded-2xl bg-[#f3f5f9] ring-4 ring-[#02214F]">
                    {result.card.hasPhoto ? (
                      <img src={`/verify/${encodeURIComponent(token)}/photo`} alt={`Photo of ${result.card.fullName}`} className="size-full object-cover" />
                    ) : (
                      <div className="grid size-full place-items-center text-xs text-[#5b6778]">No photo</div>
                    )}
                  </div>
                  <div className="min-w-0 self-center">
                    <h1 className="text-xl font-extrabold uppercase leading-tight tracking-tight text-[#02214F]">{result.card.fullName}</h1>
                    {result.card.positionName ? <p className="mt-1.5 text-sm font-bold uppercase tracking-wider text-[#D11E25]">{result.card.positionName}</p> : null}
                    {result.card.departmentName ? <p className="mt-0.5 text-sm text-[#5b6778]">{result.card.departmentName}</p> : null}
                  </div>
                </div>
                {result.card.isDemo ? (
                  <p className="mt-4 rounded-lg bg-[#fff1d6] px-3 py-2 text-xs font-semibold text-[#9a5b00]">DEMO RECORD — fictional person for testing. Not a real employee.</p>
                ) : null}
                <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-[#e3e8f0] text-sm">
                  <Item label="Employee ID" value={result.card.employeeNumber} mono />
                  <Item label="Card number" value={result.card.cardNumber} mono />
                  <Item label="Issued" value={formatCardDate(result.card.issuedAt)} />
                  <Item label="Expires" value={formatCardDate(result.card.expiresAt)} />
                </dl>
              </div>
            </>
          ) : result.outcome === "expired" ? (
            <>
              <StatusBanner tone="expired" icon={<CircleAlert />} title="Expired ID card" subtitle="This card is past its expiry date and must not be accepted as proof of employment." />
              <div className="p-6">
                <p className="text-lg font-bold uppercase text-[#02214F]">{result.card.fullName}</p>
                <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-[#e3e8f0] text-sm">
                  <Item label="Employee ID" value={result.card.employeeNumber} mono />
                  <Item label="Card number" value={result.card.cardNumber} mono />
                  <Item label="Expired" value={formatCardDate(result.card.expiresAt)} />
                  <Item label="Status" value="Expired" />
                </dl>
              </div>
            </>
          ) : result.outcome === "invalid" ? (
            <>
              <StatusBanner tone="invalid" icon={<ShieldX />} title="Invalid ID card" subtitle="Do not accept this card." />
              <div className="p-6">
                <p className="text-base font-semibold">{INVALID_REASONS[result.reason] ?? "This card is not valid."}</p>
                <dl className="mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-2xl bg-[#e3e8f0] text-sm">
                  <Item label="Card number" value={result.card.cardNumber} mono />
                </dl>
              </div>
            </>
          ) : (
            <>
              <StatusBanner tone="invalid" icon={<XCircle />} title="Card not recognised" subtitle="This QR code does not match any card issued by FXT." />
              <div className="p-6 text-sm text-[#5b6778]">
                The card may be counterfeit or the QR code damaged. Do not accept it as proof of employment{company.phone ? ` — contact ${company.shortName} on ${company.phone}` : ""}.
              </div>
            </>
          )}

          {/* Verification metadata: makes a live result distinguishable from a screenshot. */}
          <div className="border-t border-dashed border-[#d3dae5] bg-[#f7f9fc] px-6 py-4 text-xs text-[#5b6778]">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold uppercase tracking-wider">Live check</span>
              <LiveClock />
            </div>
            {result ? (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span>
                  Checked {new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "medium" }).format(result.checkedAt)} UK
                </span>
                <span className="font-mono font-semibold text-[#0f1b2d]">Ref {result.reference}</span>
              </div>
            ) : null}
            <p className="mt-2">
              Verified directly with <span className="font-semibold text-[#0f1b2d]">{host}</span>. Refresh to re-check — screenshots are not valid proof.
            </p>
          </div>
        </div>

        <footer className="mt-6 space-y-1 text-center text-xs text-[#5b6778]">
          <p>{company.returnText}</p>
          {[company.website, company.phone, company.supportEmail].filter(Boolean).length ? (
            <p className="font-medium text-[#02214F]">{[company.website, company.phone, company.supportEmail].filter(Boolean).join(" · ")}</p>
          ) : null}
        </footer>
      </div>
    </main>
  );
}

function StatusBanner({
  tone,
  icon,
  title,
  subtitle,
  live,
}: {
  tone: "valid" | "expired" | "invalid" | "neutral";
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  live?: boolean;
}) {
  const styles = {
    valid: "bg-[#0f7a4a] text-white",
    expired: "bg-[#b45309] text-white",
    invalid: "bg-[#b3131a] text-white",
    neutral: "bg-[#02214F] text-white",
  }[tone];
  return (
    <div className={`relative px-6 py-6 ${styles}`} role="status" aria-live="polite">
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/15 [&_svg]:size-7">{icon}</span>
        <div>
          {live ? (
            <span className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-white" />
              </span>
              Live result
            </span>
          ) : null}
          <p className="text-[22px] font-extrabold uppercase leading-tight tracking-tight">{title}</p>
          <p className="mt-1 text-sm text-white/85">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

function Item({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-white px-4 py-3">
      <dt className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#5b6778]">{label}</dt>
      <dd className={`mt-0.5 font-bold text-[#0f1b2d] ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
