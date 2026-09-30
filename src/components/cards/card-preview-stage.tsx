"use client";

import { useState } from "react";
import { Maximize2, Ruler } from "lucide-react";
import { CARD_DIMENSIONS, type CardOrientation } from "@/lib/cards/templates";
import { cn } from "@/lib/utils";
import { CARD_FRAME } from "./card-artwork";

/**
 * Front/back preview. "Fit" scales the artwork to the available width; "Actual
 * size" renders at the physical CR80 size in CSS mm (accurate on calibrated
 * displays; scrolls inside its own container on very narrow screens).
 * Either way the underlying SVG keeps its physical print dimensions.
 */
export function CardPreviewStage({ front, back, orientation = "portrait" }: { front: string; back: string; orientation?: CardOrientation }) {
  const [mode, setMode] = useState<"fit" | "actual">("fit");
  const landscape = orientation === "landscape";
  const dims = CARD_DIMENSIONS[orientation];
  return (
    <div className="@container">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          {landscape ? "Landscape" : "Portrait"} · {dims.widthMm} × {dims.heightMm} mm
        </p>
        <div className="flex rounded-lg border border-border bg-card p-0.5 text-xs font-semibold" role="radiogroup" aria-label="Preview size">
          {(
            [
              ["fit", "Fit", Maximize2],
              ["actual", "Actual size", Ruler],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              onClick={() => setMode(value)}
              className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-muted-foreground", mode === value && "bg-muted text-foreground")}
            >
              <Icon className="size-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>
      <div className="relative overflow-x-auto rounded-2xl bg-[radial-gradient(circle_at_30%_20%,#e9eef6,#d3dbe7)] p-4 sm:p-8 dark:bg-[radial-gradient(circle_at_30%_20%,#1a2640,#0c1426)]">
        <div
          className={cn(
            "mx-auto grid justify-items-center gap-6 sm:gap-8",
            mode === "fit"
              ? landscape
                ? "max-w-[58rem] grid-cols-1 @3xl:grid-cols-2"
                : "max-w-2xl grid-cols-1 min-[440px]:grid-cols-2"
              : "w-max grid-cols-1 @3xl:grid-cols-2",
          )}
        >
          {(
            [
              ["Front", front],
              ["Back", back],
            ] as const
          ).map(([label, svg]) => (
            <div
              key={label}
              className={cn(mode === "fit" ? (landscape ? "w-full max-w-[27rem]" : "w-full max-w-[18rem]") : "")}
              style={mode === "actual" ? { width: `${dims.widthMm}mm` } : undefined}
            >
              <figure
                className={cn(
                  "card-artwork overflow-hidden shadow-[0_2px_4px_rgba(2,33,79,.12),0_24px_48px_-12px_rgba(2,33,79,.45)] ring-1 ring-black/5 transition-transform duration-300 hover:-translate-y-1",
                  CARD_FRAME[orientation],
                )}
              >
                <div dangerouslySetInnerHTML={{ __html: svg }} />
              </figure>
              <p className="mt-3 text-center text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
