"use client";

"use client";

import * as React from "react";
import { FilesIcon } from "lucide-react";

import { shortDocName } from "@/lib/employee/scrutiny/bundle";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useScrutinyCase } from "@/components/employee/scrutiny/scrutiny-case-context";

/**
 * The bundle's index, as an overlay on the bundle — closed until asked for.
 *
 * It used to be a third pane. The filing's section rail took that width (owner,
 * 2026-10-12), and an index the officer glances at to jump does not need to stand open:
 * a `Popover` over the pages opens from the bundle's own bar, takes focus, closes on
 * Escape or a pick, and hands focus back to its trigger — the DS primitive's own wiring.
 *
 * Deliberately NOT `DocumentSlot`: that component is for "a checklist of expected
 * documents where each item has its own upload state". The rows are plain `ghost`
 * buttons; the document the selected field points at is marked with `accent`, the
 * selection role.
 */
export function IndexOverlay({
  relatedDocId,
  onGoToDoc,
}: {
  /** Doc the selected field points at — highlighted, not filtered away. */
  relatedDocId: string | null;
  onGoToDoc: (docId: string) => void;
}) {
  const { bundle } = useScrutinyCase();
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <FilesIcon />
          Documents
          <span className="text-muted-foreground tabular-nums">{bundle.length}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="flex max-h-[min(32rem,var(--radix-popover-content-available-height))] w-80 flex-col gap-0 p-0"
      >
        <PopoverHeader className="border-b border-hairline px-4 py-3">
          <PopoverTitle>Documents</PopoverTitle>
          <PopoverDescription>
            {bundle.length} in this bundle. Picking one scrolls the bundle to it.
          </PopoverDescription>
        </PopoverHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2">
          <IndexRows
            relatedDocId={relatedDocId}
            onGoToDoc={(docId) => {
              setOpen(false);
              onGoToDoc(docId);
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** One row per document: its number, its name, and whether it is a poor scan. */
function IndexRows({
  relatedDocId,
  onGoToDoc,
}: {
  relatedDocId: string | null;
  onGoToDoc: (docId: string) => void;
}) {
  const { bundle } = useScrutinyCase();
  return (
    <>
      {bundle.map((doc) => {
        const current = relatedDocId === doc.id;
        return (
          <Button
            key={doc.id}
            variant="ghost"
            className={cn(
              // A tidy index, not a nav menu: 36px rows on a fine pointer, but never
              // below the 40px touch floor where the registry works on a tablet. `px-2`
              // puts the number on the 16px content line (8px list + 8px here) with the
              // fill a gentle pill inside the gutter.
              "h-9 [@media(pointer:coarse)]:h-10 w-full justify-start gap-2 px-2 font-normal",
              current && "bg-accent",
            )}
            aria-current={current ? "true" : undefined}
            onClick={() => onGoToDoc(doc.id)}
          >
            {/* Left-aligned: with only single-digit documents, right-aligning them in the
                box pushed the numeral toward the middle and read as "too inset" (owner,
                2026-09-15). Left-aligned, the numeral sits on the same line as the header. */}
            <span className="w-4 shrink-0 text-caption text-muted-foreground tabular-nums">
              {doc.no}
            </span>
            {/* The row shows the short name because the rail is narrow; a screen reader
                gets the whole one, which is where the "— Complainant" half lives. */}
            <span
              className="min-w-0 flex-1 truncate text-start text-body-compact"
              aria-hidden="true"
            >
              {shortDocName(doc.name)}
            </span>
            <span className="sr-only">{doc.name}</span>
            {/* The badges are marks, so what they mean is said in words for anyone who
                cannot read a shape — never a `title` attribute, which no touch or
                keyboard user reaches. */}
            {doc.poorScan ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="warning" className="shrink-0">
                    <span aria-hidden="true">!</span>
                    <span className="sr-only">poor scan</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  Poor scan — may be blurred or missing pages
                </TooltipContent>
              </Tooltip>
            ) : null}
          </Button>
        );
      })}
    </>
  );
}
