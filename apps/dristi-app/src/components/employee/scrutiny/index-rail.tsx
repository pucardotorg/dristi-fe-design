"use client";

import { shortDocName } from "@/lib/employee/scrutiny/bundle";
import { replacedDocs } from "@/lib/employee/scrutiny/returns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useScrutinyCase } from "@/components/employee/scrutiny/scrutiny-case-context";

/**
 * The bundle's index.
 *
 * Deliberately NOT `DocumentSlot`: that component is documented for "a checklist of
 * expected documents where each item has its own upload state", and its own demo runs
 * past 400px. At the width this rail defaults to, its `p-4` + `gap-4` + 40px media
 * leaves ~117px for a filename — three-line wraps and a list that has to scroll.
 *
 * It is a plain `ghost` `Button` list rather than `SidebarMenuButton`, which was the
 * previous answer: that component carries the *navigation rail's* brand-tinted hover and
 * active states, and putting them in a page panel meant two things on screen claiming to
 * be the app's nav. The active document is marked with `accent`, which is the selection
 * role, and the rail spends no brand colour at all.
 */
export function IndexRail({
  relatedDocId,
  aiOn,
  onGoToDoc,
  onlyDocs = null,
}: {
  /** Doc the selected field points at — highlighted, not filtered away. */
  relatedDocId: string | null;
  /** Poor-scan detection is an AI reading; without AI the badge is not shown. */
  aiOn: boolean;
  onGoToDoc: (docId: string) => void;
  /** Only the documents behind the returned items, on the Changes tab. */
  onlyDocs?: string[] | null;
}) {
  return (
    <aside
      className="flex h-full flex-col overflow-hidden bg-card"
      aria-label="Document index"
    >
      {/* The same chrome bar the bundle and fields panels carry — `h-14`, a hairline
          seam below it — so all three pane headers line up across the workbench. */}
      <div className="flex h-14 shrink-0 items-center border-b border-hairline px-4">
        <b className="text-body-compact font-semibold">Index</b>
      </div>
      {/* The row content sits on the 16px line — aligned with the "Index" header above and
          the fields panel's own 16px margin — while the row fill is a gentler 8px pill, so
          the numbers read as balanced rather than pushed in (owner, 2026-09-15). */}
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 py-2">
        <IndexRows
          relatedDocId={relatedDocId}
          aiOn={aiOn}
          onGoToDoc={onGoToDoc}
          onlyDocs={onlyDocs}
        />
      </div>
    </aside>
  );
}

/**
 * The same index, as a detour, for the widths where there is no room for a third pane.
 *
 * A sheet rather than a vanishing rail: the officer asks for the index, reads it, picks a
 * document and it closes behind them — the same shape `HistorySheet` uses one control
 * along in the same bar.
 */
export function IndexSheet({
  open,
  onOpenChange,
  relatedDocId,
  aiOn,
  onGoToDoc,
  onlyDocs = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  relatedDocId: string | null;
  aiOn: boolean;
  onGoToDoc: (docId: string) => void;
  onlyDocs?: string[] | null;
}) {
  const { bundle } = useScrutinyCase();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="data-[side=right]:sm:max-w-100">
        <SheetHeader>
          <SheetTitle>Documents</SheetTitle>
          <SheetDescription>
            {bundle.length} documents in this bundle. Picking one opens it in the
            bundle.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 pb-4">
          <IndexRows
            relatedDocId={relatedDocId}
            aiOn={aiOn}
            onGoToDoc={onGoToDoc}
            onlyDocs={onlyDocs}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * One row per document: its number, its name, and — with AI on — whether it is a poor
 * scan. Poor-scan detection is a machine reading, so without AI the row says nothing.
 */
function IndexRows({
  relatedDocId,
  aiOn,
  onGoToDoc,
  onlyDocs,
}: {
  relatedDocId: string | null;
  aiOn: boolean;
  onGoToDoc: (docId: string) => void;
  onlyDocs: string[] | null;
}) {
  const { bundle, returned, fieldById } = useScrutinyCase();
  const replaced = replacedDocs(returned, fieldById);
  const shown = onlyDocs ? bundle.filter((doc) => onlyDocs.includes(doc.id)) : bundle;
  return (
    <>
      {/* Said, so a short index reads as a choice and not as a bundle gone missing. */}
      {onlyDocs ? (
        <p className="px-2 pb-1 text-caption font-medium text-muted-foreground">
          Documents behind the returned items. Full filing shows all {bundle.length}.
        </p>
      ) : null}
      {shown.map((doc) => {
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
            {/* Re-uploaded this round: a word, not a dot — the rail is where the officer
                looks for "which documents are new", and a shape alone says nothing. */}
            {replaced[doc.id] ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="info" className="shrink-0">
                    New
                    <span className="sr-only"> upload this round</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  Re-uploaded on {replaced[doc.id].answered}
                </TooltipContent>
              </Tooltip>
            ) : null}
            {aiOn && doc.poorScan ? (
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
