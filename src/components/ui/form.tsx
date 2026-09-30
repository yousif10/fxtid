import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground shadow-xs transition-colors placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring/40 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-24 py-2", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        control,
        "h-10 appearance-none bg-[length:16px] bg-[right_0.6rem_center] bg-no-repeat pr-9",
        "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%235b6778' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("text-[13px] font-medium text-foreground", className)} {...props} />;
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="ml-0.5 text-accent" aria-hidden>*</span> : null}
      </Label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Checkbox({ className, ...props }: ComponentProps<"input">) {
  return <input type="checkbox" className={cn("size-4 rounded border-input accent-[var(--primary)]", className)} {...props} />;
}
