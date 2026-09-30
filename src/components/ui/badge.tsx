import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const tones = {
  neutral: "bg-muted text-muted-foreground ring-border",
  success: "bg-success-soft text-success ring-success/25",
  warning: "bg-warning-soft text-warning ring-warning/25",
  danger: "bg-danger-soft text-danger ring-danger/25",
  info: "bg-info-soft text-primary ring-primary/20 dark:text-ring",
  navy: "bg-brand-navy text-white ring-brand-navy",
  red: "bg-brand-red text-white ring-brand-red",
} as const;
export type BadgeTone = keyof typeof tones;

export function Badge({ tone = "neutral", dot, className, children, ...props }: ComponentProps<"span"> & { tone?: BadgeTone; dot?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        tones[tone],
        className,
      )}
      {...props}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current" aria-hidden /> : null}
      {children}
    </span>
  );
}
