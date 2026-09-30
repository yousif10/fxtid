/* eslint-disable @next/next/no-img-element -- static SVG logo, no optimisation needed */
import { cn } from "@/lib/utils";

/** Official FXT logo (unaltered SVG from the brand assets). */
export function FxtLogo({ className, alt = "Fast Express Transport" }: { className?: string; alt?: string }) {
  return <img src="/brand/logo.svg" alt={alt} className={cn("h-auto w-auto select-none", className)} draggable={false} />;
}

/** Logo on a white tile - used on dark surfaces so the navy parts stay visible. */
export function FxtLogoTile({ className }: { className?: string }) {
  return (
    <div className={cn("grid place-items-center rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-black/5", className)}>
      <FxtLogo className="h-full w-auto" />
    </div>
  );
}
