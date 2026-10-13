"use client";

import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";

import { CaseFileIndex } from "@/components/cases/case-file";
import { PdfViewer, parsePdfSrc } from "@/components/cases/pdf-viewer";
import { PANEL_CLASS } from "@/components/shell/panel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ancestorIds,
  CASE_FILE_TREE,
  caseFilePdfSrc,
  fileNumberLabel,
  findNode,
  firstLeaf,
  flattenLeaves,
  isCaseFileFolder,
  type CaseFileNode,
} from "@/lib/cases/case-file";
import { cn } from "@/lib/utils";

const LEAVES = flattenLeaves(CASE_FILE_TREE);

/**
 * The case file, read beside the order rather than instead of it.
 *
 * **Docked, not a takeover** (owner, 2026-10-13: "it just hijacks the entire order
 * screen"). The composer makes room for this pane as a column of its own, next to the
 * order, so a paper can be read while the order is written. It is not a side sheet: a
 * sheet over the screen would cover the order it is being read for.
 *
 * **The index stands, in the form the width allows.** Where the pane is wide enough, the
 * whole tree is a column beside the document. Where it is not — three columns on a
 * laptop — the index folds to the rail of ticks the register-cases file uses (one per
 * section, the open one darker), and the tree opens over the document on hover or focus.
 * The tree, its rows and its folders are the advocate's case file
 * (`components/cases/case-file.tsx`), composed rather than rebuilt.
 *
 * **The app's own PDF surface** (`PdfViewer`), not the browser's viewer in an iframe:
 * pages on the sunken well, in the app's theme, with no second toolbar. A document that
 * is one page of its section's compiled file shows that page alone, as the advocate's
 * case file does. The arrows in the head step through every document in file order.
 *
 * The open document is local state, not the URL: routing it would carry the typist off
 * the order the moment they opened a paper.
 */
export function OrderCaseFile({
  id,
  className,
  onClose,
  onAnimationEnd,
}: {
  id?: string;
  className?: string;
  onClose: () => void;
  onAnimationEnd?: () => void;
}) {
  const [docId, setDocId] = React.useState(
    () => firstLeaf(CASE_FILE_TREE)?.id ?? "",
  );
  const [openIds, setOpenIds] = React.useState(
    () => new Set(ancestorIds(CASE_FILE_TREE, docId)),
  );

  const selected = findNode(CASE_FILE_TREE, docId);
  const leaf = selected && !isCaseFileFolder(selected) ? selected : undefined;
  const src = leaf ? caseFilePdfSrc(leaf) : undefined;
  const at = LEAVES.findIndex((entry) => entry.id === docId);
  const section = CASE_FILE_TREE.find(
    (node) =>
      node.id === docId || ancestorIds(CASE_FILE_TREE, docId).includes(node.id),
  );

  function selectDoc(id: string) {
    setOpenIds((current) => {
      const next = new Set(current);
      for (const ancestor of ancestorIds(CASE_FILE_TREE, id))
        next.add(ancestor);
      return next;
    });
    setDocId(id);
  }

  function setFolderOpen(id: string, open: boolean) {
    setOpenIds((current) => {
      const next = new Set(current);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const index = (
    <nav aria-label="Case file index">
      <CaseFileIndex
        nodes={CASE_FILE_TREE}
        selectedId={docId}
        openIds={openIds}
        onSelect={selectDoc}
        onFolderOpenChange={setFolderOpen}
      />
    </nav>
  );

  return (
    <Card
      id={id}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) onAnimationEnd?.();
      }}
      aria-label="Case file"
      className={cn(
        PANEL_CLASS,
        "@container min-w-0 flex-col gap-0 overflow-hidden py-0",
        className,
      )}
    >
      {/* The open paper and the way through the file. */}
      <div className="flex min-h-14 shrink-0 items-center gap-2 border-b border-hairline py-2 pr-2 pl-4">
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="truncate text-body-compact font-semibold">
            {leaf ? leaf.label : "Case file"}
          </h2>
          <p className="truncate text-body-compact text-muted-foreground">
            {section && section.id !== leaf?.id ? `${section.label} · ` : ""}
            <span className="tabular-nums">
              {at + 1} of {LEAVES.length}
            </span>
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Previous document"
          disabled={at <= 0}
          onClick={() => selectDoc(LEAVES[at - 1].id)}
        >
          <ChevronLeftIcon aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Next document"
          disabled={at < 0 || at >= LEAVES.length - 1}
          onClick={() => selectDoc(LEAVES[at + 1].id)}
        >
          <ChevronRightIcon aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Close case file"
          onClick={onClose}
        >
          <XIcon aria-hidden />
        </Button>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1">
        {/* The whole tree, where the pane has the width for it. */}
        <ScrollArea className="hidden w-60 shrink-0 border-r border-hairline @[44rem]:block">
          <div className="p-2">{index}</div>
        </ScrollArea>

        {/* Narrower: the rail, with the tree over the document on hover or focus. */}
        <SectionRail activeId={section?.id ?? ""}>{index}</SectionRail>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {src ? (
            <CaseFilePage
              key={src}
              src={src}
              title={leaf?.label ?? "Case document"}
            />
          ) : (
            <div className="m-4 flex min-h-0 flex-1 items-center justify-center rounded-lg border border-dashed border-border p-6 text-center text-body-compact text-muted-foreground">
              Choose a document from the index to open it here.
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

/** A leaf with a page is one document inside its section's compiled file. */
function CaseFilePage({ src, title }: { src: string; title: string }) {
  const { url, page } = parsePdfSrc(src);
  return (
    <PdfViewer
      src={url}
      title={title}
      pages={page ? { from: page, to: page } : undefined}
      className="min-h-0 flex-1 rounded-none"
    />
  );
}

/**
 * The register-cases contents rail (`register-case-file.tsx`), for the case file's
 * sections: a tick per section, the open one darker. The ticks are only its picture; the
 * tree beside it is the real navigation and is always in the tab order — transparent,
 * not hidden, until hover or focus brings it up — so a keyboard reaches every document
 * and a screen reader hears the whole index.
 */
function SectionRail({
  activeId,
  children,
}: {
  activeId: string;
  children: React.ReactNode;
}) {
  return (
    <div className="group/rail relative w-10 shrink-0 border-r border-hairline @[44rem]:hidden">
      <div aria-hidden className="flex flex-col items-center gap-3 py-4">
        {CASE_FILE_TREE.map((node: CaseFileNode) => (
          <span
            key={node.id}
            title={`${fileNumberLabel(node.number)} ${node.label}`}
            className={cn(
              "h-0.5 w-4 rounded-full transition-colors",
              activeId === node.id ? "bg-foreground" : "bg-border",
            )}
          />
        ))}
      </div>
      <div
        className={cn(
          "absolute top-2 left-2 z-30 flex max-h-[min(32rem,calc(100%-1rem))] w-72 flex-col rounded-xl border border-hairline bg-popover shadow-overlay transition-opacity duration-150",
          "pointer-events-none opacity-0",
          "group-hover/rail:pointer-events-auto group-hover/rail:opacity-100",
          "group-focus-within/rail:pointer-events-auto group-focus-within/rail:opacity-100",
        )}
      >
        <p className="shrink-0 border-b border-hairline px-3 py-2 text-body-compact text-muted-foreground">
          Case file index
        </p>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
          {children}
        </div>
      </div>
    </div>
  );
}
