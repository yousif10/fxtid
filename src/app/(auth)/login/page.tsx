import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { FxtLogo } from "@/components/admin/brand";
import { getCurrentUser } from "@/lib/auth/session";
import { safeRedirectPath } from "@/lib/actions";
import { getSettings } from "@/lib/settings";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect(safeRedirectPath(next));
  const settings = await getSettings();

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-[#02214F] text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-40 size-[34rem] rounded-full border-[56px] border-white/[0.04]"
        />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-24 size-80 rounded-full border-[28px] border-white/[0.04]" />
        <div aria-hidden className="absolute inset-x-0 top-0 flex h-1.5">
          <span className="w-[82%] bg-[#0B3A7E]" />
          <span className="flex-1 bg-[#D11E25]" />
        </div>
        <div className="relative flex items-center gap-4">
          <div className="rounded-2xl bg-white p-3 shadow-lg">
            <FxtLogo className="h-16" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/60">{settings.company.shortName}</p>
            <p className="text-lg font-semibold">{settings.company.legalName}</p>
          </div>
        </div>
        <div className="relative max-w-md">
          <h1 className="text-4xl font-bold leading-tight tracking-tight">Employee identity, issued with confidence.</h1>
          <p className="mt-4 text-base leading-relaxed text-white/70">
            Create, print and verify {settings.company.shortName} staff ID cards. Every card carries a secure QR code that confirms its live status.
          </p>
          <div className="mt-8 flex items-center gap-3 text-sm text-white/70">
            <ShieldCheck className="size-5 text-[#ff6b70]" aria-hidden />
            Authorised administrators only. All activity is audited.
          </div>
        </div>
        <p className="relative text-xs uppercase tracking-[0.25em] text-white/40">{settings.company.tagline}</p>
      </section>

      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-sm animate-rise">
          <div className="mb-8 flex justify-center lg:hidden">
            <FxtLogo className="h-24" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Sign in</h2>
          <p className="mt-1 text-sm text-muted-foreground">Use your administrator account to manage ID cards.</p>
          <LoginForm next={safeRedirectPath(next)} />
          <p className="mt-10 text-center text-xs text-muted-foreground">
            Checking someone&apos;s ID? Scan the QR code on the back of their card.
          </p>
        </div>
      </section>
    </main>
  );
}
