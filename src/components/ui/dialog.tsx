"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Accessible modal built on the native <dialog> element (focus trapping,
 * Escape to close and inert background are provided by the browser).
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto w-[calc(100%-2rem)] rounded-2xl border border-border bg-card p-0 text-card-foreground shadow-pop open:animate-rise",
        size === "sm" ? "max-w-md" : size === "lg" ? "max-w-2xl" : "max-w-lg",
        className,
      )}
    >
      {open ? (
        <div className="p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 id={titleId} className="text-lg font-semibold tracking-tight">
                {title}
              </h2>
              {description ? (
                <p id={descId} className="mt-1 text-sm text-muted-foreground">
                  {description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="-m-1 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close dialog"
            >
              <X className="size-5" />
            </button>
          </div>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
