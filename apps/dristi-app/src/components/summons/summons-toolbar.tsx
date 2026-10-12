"use client";

import * as React from "react";
import { PrinterIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";

import type { SummonsVersion } from "./summons-document";

/**
 * Above the sheet, on screen only: which version is showing, and Print for the paper one.
 * The version lives in the URL (`?version=`), so either can be linked to directly.
 */
export function SummonsToolbar({ version }: { version: SummonsVersion }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function show(next: string) {
    if (next !== "print" && next !== "digital") return;
    const query = new URLSearchParams(params.toString());
    query.set("version", next);
    router.replace(`${pathname}?${query.toString()}`, { scroll: false });
  }

  return (
    <div className="summons-toolbar flex w-full max-w-[210mm] flex-wrap items-center justify-between gap-3">
      <SegmentedControl
        type="single"
        value={version}
        onValueChange={show}
        aria-label="Summons version"
      >
        <SegmentedControlItem value="digital">Digital</SegmentedControlItem>
        <SegmentedControlItem value="print">Print</SegmentedControlItem>
      </SegmentedControl>
      {version === "print" && (
        <Button variant="outline" onClick={() => window.print()}>
          <PrinterIcon data-icon="inline-start" aria-hidden />
          Print or save as PDF
        </Button>
      )}
    </div>
  );
}

/** 210mm in CSS pixels: the width the sheet is drawn at before it is fitted. */
const SHEET_PX = (210 / 25.4) * 96;

/**
 * Fits the A4 sheet to a narrow screen the way a PDF viewer fits to width, so a phone
 * reads the whole line rather than panning across it. Printing resets it (`summons.css`).
 */
export function SummonsFit({ children }: { children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = React.useState(1);

  React.useEffect(() => {
    const el = ref.current?.parentElement;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setZoom(Math.min(1, entry.contentRect.width / SHEET_PX));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="summons-fit w-full" style={{ zoom }}>
      {children}
    </div>
  );
}
