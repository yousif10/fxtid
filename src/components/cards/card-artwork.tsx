import { cn } from "@/lib/utils";
import type { CardOrientation } from "@/lib/cards/templates";

/**
 * Frame styles per orientation: exact CR80 aspect ratio and 3.18 mm corner radius
 * expressed as percentages of width/height, so scaling never distorts the card.
 */
export const CARD_FRAME: Record<CardOrientation, string> = {
  portrait: "aspect-[53.98/85.6] rounded-[5.9%/3.71%]",
  landscape: "aspect-[85.6/53.98] rounded-[3.71%/5.9%]",
};

/**
 * Displays server- or client-rendered card SVG. The SVG is produced by
 * lib/cards/render.ts, where every dynamic value is XML-escaped, so injecting it
 * is safe. Scaling is purely visual (CSS width); the SVG keeps its physical mm
 * size for print.
 */
export function CardArtwork({
  svg,
  orientation = "portrait",
  className,
  label,
}: {
  svg: string;
  orientation?: CardOrientation;
  className?: string;
  label?: string;
}) {
  return (
    <figure
      className={cn(
        "card-artwork overflow-hidden shadow-[0_1px_2px_rgba(2,33,79,.08),0_12px_32px_-8px_rgba(2,33,79,.28)] ring-1 ring-black/5",
        CARD_FRAME[orientation],
        className,
      )}
    >
      <div dangerouslySetInnerHTML={{ __html: svg }} />
      {label ? <figcaption className="sr-only">{label}</figcaption> : null}
    </figure>
  );
}

/**
 * Front + back side by side (portrait) or stacked/side by side depending on the
 * available width (landscape). Always keeps the real card aspect ratio.
 */
export function CardPair({
  front,
  back,
  orientation,
  size = "md",
}: {
  front: string;
  back: string;
  orientation: CardOrientation;
  size?: "sm" | "md";
}) {
  const landscape = orientation === "landscape";
  return (
    <div className="@container">
    <div
      className={cn(
        "grid gap-4 sm:gap-6",
        landscape
          ? size === "sm"
            ? "mx-auto max-w-md grid-cols-1"
            : "mx-auto max-w-[26rem] grid-cols-1 @2xl:max-w-[56rem] @2xl:grid-cols-2"
          : "mx-auto max-w-xl grid-cols-2",
      )}
    >
      {(
        [
          ["Front", front],
          ["Back", back],
        ] as const
      ).map(([label, svg]) => (
        <div key={label} className="min-w-0">
          <CardArtwork svg={svg} orientation={orientation} label={`${label} of card`} />
          <p className="mt-2 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
    </div>
  );
}
