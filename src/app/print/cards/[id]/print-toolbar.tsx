"use client";

import Link from "next/link";
import { Printer } from "lucide-react";
import { CARD_DIMENSIONS, ORIENTATION_LABELS, type CardOrientation } from "@/lib/cards/templates";

export function PrintToolbar({
  cardNumber,
  side,
  layout,
  id,
  orientation,
  designName,
}: {
  cardNumber: string;
  side: string;
  layout: "card" | "a4";
  id: string;
  orientation: CardOrientation;
  designName: string;
}) {
  const dims = CARD_DIMENSIONS[orientation];
  const link = (s: string, l: string) => `/print/cards/${id}?side=${s}&layout=${l}`;
  const tab = (active: boolean) =>
    `rounded-md px-2.5 py-1 text-xs font-semibold ${active ? "bg-[#02214F] text-white" : "text-slate-600 hover:bg-slate-100"}`;
  return (
    <div className="print-toolbar">
      <div className="flex flex-wrap items-center gap-3">
        <div className="leading-tight">
          <strong className="font-mono text-sm text-slate-900">{cardNumber}</strong>
          <p className="text-xs text-slate-600">
            {designName} · {dims.widthMm} × {dims.heightMm} mm
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-0.5">
          {(["both", "front", "back"] as const).map((s) => (
            <Link key={s} href={link(s, layout)} className={tab(side === s)}>
              {s === "both" ? "Both sides" : s[0].toUpperCase() + s.slice(1)}
            </Link>
          ))}
        </div>
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-0.5">
          <Link href={link(side, "card")} className={tab(layout === "card")}>
            Card printer (CR80)
          </Link>
          <Link href={link(side, "a4")} className={tab(layout === "a4")}>
            A4 sheet
          </Link>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="ml-auto inline-flex items-center gap-2 rounded-lg bg-[#02214F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0B3A7E]"
        >
          <Printer className="size-4" /> Print
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-600">
        {layout === "card"
          ? `Card printer: choose the CR80 card size in ${ORIENTATION_LABELS[orientation].toLowerCase()} orientation (${dims.widthMm} × ${dims.heightMm} mm), Scale 100% (Actual size), Margins: None, Background graphics ON. Enable duplex for both sides.`
          : "A4: prints at exact card size with cut marks. Scale 100%, Background graphics ON."}
      </p>
    </div>
  );
}
