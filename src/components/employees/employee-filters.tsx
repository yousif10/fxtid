"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Loader2, Search, X } from "lucide-react";
import { Select } from "@/components/ui/form";
import { cn } from "@/lib/utils";

type Option = { id: string; name: string };

export function EmployeeFilters({ departments, positions }: { departments: Option[]; positions: Option[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(sp.get("q") ?? "");

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  // Debounced search.
  useEffect(() => {
    if ((sp.get("q") ?? "") === q) return;
    const t = setTimeout(() => update({ q: q.trim() || null }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const active = ["status", "department", "position", "card"].some((k) => sp.get(k)) || q;

  return (
    <div className="flex flex-col gap-3 border-b border-border p-4 xl:flex-row xl:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <label htmlFor="employee-search" className="sr-only">
          Search employees
        </label>
        <input
          id="employee-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, employee ID, card no., department or position…"
          className="h-10 w-full rounded-lg border border-input bg-card pl-9 pr-9 text-sm shadow-xs placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring/40"
        />
        {pending ? <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-label="Loading" /> : null}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:flex">
        <FilterSelect label="Employment status" value={sp.get("status") ?? ""} onChange={(v) => update({ status: v })}>
          <option value="">Current staff</option>
          <option value="active">Active</option>
          <option value="on_leave">On leave</option>
          <option value="suspended">Suspended</option>
          <option value="left">Left company</option>
          <option value="archived">Archived</option>
        </FilterSelect>
        <FilterSelect label="Card status" value={sp.get("card") ?? ""} onChange={(v) => update({ card: v })}>
          <option value="">Any card status</option>
          <option value="active">Active card</option>
          <option value="expiring">Expiring soon</option>
          <option value="expired">Expired</option>
          <option value="inactive">Disabled / lost / revoked</option>
          <option value="none">No card</option>
        </FilterSelect>
        <FilterSelect label="Department" value={sp.get("department") ?? ""} onChange={(v) => update({ department: v })}>
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Position" value={sp.get("position") ?? ""} onChange={(v) => update({ position: v })}>
          <option value="">All positions</option>
          {positions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </FilterSelect>
      </div>
      {active ? (
        <button
          type="button"
          onClick={() => {
            setQ("");
            startTransition(() => router.replace(pathname, { scroll: false }));
          }}
          className="inline-flex h-10 items-center gap-1 self-start rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground xl:self-auto"
        >
          <X className="size-4" /> Clear
        </button>
      ) : null}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string | null) => void;
  children: React.ReactNode;
}) {
  return (
    <Select aria-label={label} value={value} onChange={(e) => onChange(e.target.value || null)} className={cn("xl:w-44", value && "border-ring/60")}>
      {children}
    </Select>
  );
}
