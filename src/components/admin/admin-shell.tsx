"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Briefcase,
  Building2,
  IdCard,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  Menu,
  ScanLine,
  ScrollText,
  Settings,
  Users,
  X,
} from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { can, ROLE_LABELS, type AdminRole, type Permission } from "@/lib/permissions";
import { FxtLogo } from "./brand";
import { ThemeToggle } from "./theme-toggle";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; permission?: Permission };

const NAV: Array<{ section: string; items: NavItem[] }> = [
  {
    section: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    section: "People & cards",
    items: [
      { href: "/employees", label: "Employees", icon: Users, permission: "employees:read" },
      { href: "/cards", label: "ID Cards", icon: IdCard, permission: "cards:read" },
      { href: "/verification", label: "Verification", icon: ScanLine, permission: "cards:read" },
    ],
  },
  {
    section: "Organisation",
    items: [
      { href: "/departments", label: "Departments", icon: Building2, permission: "employees:read" },
      { href: "/positions", label: "Positions", icon: Briefcase, permission: "employees:read" },
      { href: "/templates", label: "Card Templates", icon: LayoutTemplate, permission: "cards:read" },
    ],
  },
  {
    section: "System",
    items: [
      { href: "/audit", label: "Audit Log", icon: ScrollText, permission: "audit:read" },
      { href: "/settings", label: "Settings", icon: Settings, permission: "settings:read" },
    ],
  },
];

export function AdminShell({
  user,
  companyName,
  logoutAction,
  children,
}: {
  user: { fullName: string; email: string; role: AdminRole };
  companyName: string;
  logoutAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile drawer after navigation (state adjustment during render).
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 pb-5 pt-6">
        <div className="rounded-xl bg-white p-1.5 shadow-sm">
          <FxtLogo className="h-10" alt="" />
        </div>
        <div className="min-w-0 leading-tight">
          <p className="text-sm font-bold leading-snug text-white">{companyName}</p>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">ID Card System</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-6" aria-label="Main">
        {NAV.map((group) => {
          const items = group.items.filter((i) => !i.permission || can(user.role, i.permission));
          if (!items.length) return null;
          return (
            <div key={group.section} className="mt-5 first:mt-1">
              <p className="px-3 pb-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/35">{group.section}</p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-white/[0.06] hover:text-white",
                          active && "bg-sidebar-active text-white",
                        )}
                      >
                        {active ? <span aria-hidden className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-[#D11E25]" /> : null}
                        <item.icon className={cn("size-[18px] shrink-0 opacity-70 group-hover:opacity-100", active && "opacity-100")} aria-hidden />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-3">
        <Link href="/account" className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/[0.06]">
          <span className="grid size-9 place-items-center rounded-lg bg-white/10 text-xs font-bold text-white">{initials(user.fullName)}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-white">{user.fullName}</span>
            <span className="block truncate text-xs text-white/50">{ROLE_LABELS[user.role]}</span>
          </span>
        </Link>
        <form action={logoutAction}>
          <button
            type="submit"
            className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-white/[0.06] hover:text-white"
          >
            <LogOut className="size-[18px] opacity-70" aria-hidden /> Sign out
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only z-50 rounded bg-card px-3 py-2 focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-sidebar lg:block">
        <div aria-hidden className="absolute inset-x-0 top-0 flex h-1">
          <span className="w-[82%] bg-[#0B3A7E]" />
          <span className="flex-1 bg-[#D11E25]" />
        </div>
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      <div className={cn("fixed inset-0 z-40 lg:hidden", open ? "" : "pointer-events-none")} aria-hidden={!open}>
        <div className={cn("absolute inset-0 bg-black/50 transition-opacity", open ? "opacity-100" : "opacity-0")} onClick={() => setOpen(false)} />
        <aside
          className={cn("absolute inset-y-0 left-0 w-72 max-w-[85%] bg-sidebar shadow-2xl transition-transform duration-200", open ? "translate-x-0" : "-translate-x-full")}
          aria-label="Navigation"
          inert={!open}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-3 top-3 rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
            aria-label="Close navigation"
          >
            <X className="size-5" />
          </button>
          {sidebar}
        </aside>
      </div>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="-ml-1 rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
            aria-label="Open navigation"
            aria-expanded={open}
          >
            <Menu className="size-5" />
          </button>
          <div className="flex items-center gap-2 lg:hidden">
            <FxtLogo className="h-8" alt={companyName} />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">{user.email}</span>
            <ThemeToggle />
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
