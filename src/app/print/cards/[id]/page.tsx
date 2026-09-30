import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/session";
import { templateDisplayName } from "@/lib/cards/templates";
import { UUID_RE } from "@/lib/http";
import { buildCardSvg } from "@/lib/services/card-artwork";
import { getCard } from "@/lib/services/cards";
import { PrintToolbar } from "./print-toolbar";
import "./print.css";

export const metadata: Metadata = { title: "Print ID card" };

/**
 * Dedicated print surface: no dashboard chrome, fixed physical sizes (mm) and
 * one card side per printed page (CR80 page size in the card's orientation =>
 * card printers print 1:1; duplex printers print front/back on a single card).
 */
export default async function PrintCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ side?: string; layout?: string }>;
}) {
  await requirePagePermission("cards:read");
  const { id } = await params;
  const { side = "both", layout = "card" } = await searchParams;
  if (!UUID_RE.test(id)) notFound();
  const card = await getCard(id);
  if (!card) notFound();
  const sides = side === "front" ? (["front"] as const) : side === "back" ? (["back"] as const) : (["front", "back"] as const);
  const svgs = await Promise.all(sides.map((s) => buildCardSvg(card, s, "export", `pr-${s}`)));
  const a4 = layout === "a4";
  // The card's own orientation decides the physical page/card size - the artwork is
  // rendered natively in that orientation, never rotated with CSS.
  const orientation = card.orientation;

  return (
    <div className={`print-root ${a4 ? "print-a4" : "print-card"} print-${orientation}`}>
      <PrintToolbar
        cardNumber={card.cardNumber}
        side={side}
        layout={a4 ? "a4" : "card"}
        id={card.id}
        orientation={orientation}
        designName={templateDisplayName(card.templateName, orientation)}
      />
      {a4 ? (
        <div className="a4-sheet">
          {svgs.map((svg, i) => (
            <div key={i} className="a4-slot">
              <div className={`card-physical ${orientation}`} dangerouslySetInnerHTML={{ __html: svg }} />
              <span className="a4-label">{sides[i]}</span>
            </div>
          ))}
        </div>
      ) : (
        svgs.map((svg, i) => <div key={i} className={`card-page card-physical ${orientation}`} dangerouslySetInnerHTML={{ __html: svg }} />)
      )}
    </div>
  );
}
