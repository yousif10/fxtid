import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  hrefFor: (page: number) => string;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const btn = "inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-card px-3 text-sm font-medium hover:bg-muted";
  return (
    <nav className="flex flex-col items-center justify-between gap-3 px-5 py-4 sm:flex-row" aria-label="Pagination">
      <p className="text-sm text-muted-foreground">
        Showing <span className="font-semibold text-foreground">{from}</span>–<span className="font-semibold text-foreground">{to}</span> of{" "}
        <span className="font-semibold text-foreground">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link className={btn} href={hrefFor(page - 1)} rel="prev">
            <ChevronLeft className="size-4" /> Previous
          </Link>
        ) : (
          <span className={cn(btn, "pointer-events-none opacity-40")} aria-disabled>
            <ChevronLeft className="size-4" /> Previous
          </span>
        )}
        <span className="px-2 text-sm text-muted-foreground">
          {page} / {pageCount}
        </span>
        {page < pageCount ? (
          <Link className={btn} href={hrefFor(page + 1)} rel="next">
            Next <ChevronRight className="size-4" />
          </Link>
        ) : (
          <span className={cn(btn, "pointer-events-none opacity-40")} aria-disabled>
            Next <ChevronRight className="size-4" />
          </span>
        )}
      </div>
    </nav>
  );
}
