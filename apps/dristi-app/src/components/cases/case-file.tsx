"use client";

import { useMemo, useState } from "react";
import { useCaseRouter } from "@/components/cases/case-reader";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  PanelLeftOpenIcon,
} from "lucide-react";

import { DigitalRecord } from "@/components/cases/digital-record";
import { DocumentPreviewActions } from "@/components/cases/document-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  ancestorIds,
  CASE_FILE_TREE,
  caseFileDocHref,
  caseFilePdfSrc,
  fileNumberLabel,
  findNode,
  isCaseFileFolder,
  type CaseFileNode,
  type CaseFileView,
} from "@/lib/cases/case-file";
import {
  caseFileDigitalPane,
  caseFileRegisterDocumentId,
} from "@/lib/cases/case-file-digital";
import { useSessionValue } from "@/lib/cases/demo-session";
import { documentsFile } from "@/lib/cases/documents";
import {
  evidenceMarksKey,
  parseEvidenceMarks,
} from "@/lib/cases/evidence-marks";
import {
  MarkEvidenceDialog,
  useCanMarkEvidence,
} from "@/components/cases/mark-evidence-dialog";
import { type ComplaintPane } from "@/lib/cases/complaint";
import { type CaseRecord } from "@/lib/cases/types";
import { cn } from "@/lib/utils";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/ui/segmented-control";
import { PANEL_CLASS } from "@/components/shell/panel";

import { DOCUMENT_GROUND } from "./document-ground";
import { COLLAPSE_MOTION, glideToTop } from "./motion";
import { PdfViewer, parsePdfSrc } from "./pdf-viewer";

/**
 * One Case file region — index and document share a Card so they cannot
 * scroll apart (Laws: grouped content gets a border). The panel fills the
 * leftover scrollport and stays there. The Case file and document titles
 * sit outside the scroll; a long category (Orders) moves inside the
 * index, not the page. PDF and digital are two reads of the same paper;
 * only the nested document pane moves on the right.
 * Categories stay independently open.
 *
 * Phone: the index moves into a Sheet so the page stays the document
 * (RESPONSIVE — stack / overlay before splitting).
 */
export function CaseFile({
  record,
  docId,
  view,
}: {
  record: CaseRecord;
  docId: string;
  view: CaseFileView;
}) {
  const router = useCaseRouter();
  const selected = findNode(CASE_FILE_TREE, docId);
  const pane = caseFileDigitalPane(record, docId);
  const isLeaf = Boolean(selected && !isCaseFileFolder(selected));
  const leaf = selected && !isCaseFileFolder(selected) ? selected : undefined;
  // The same src the pane renders, so Download and Full view hand over the
  // page the reader is actually on rather than the top of the file.
  const leafSrc = leaf ? caseFilePdfSrc(leaf) : undefined;
  const leafLabel = leaf?.label;
  const [sheetOpen, setSheetOpen] = useState(false);
  const [openIds, setOpenIds] = useState(
    () => new Set(ancestorIds(CASE_FILE_TREE, docId))
  );

  function selectDoc(id: string) {
    setOpenIds((current) => {
      const next = new Set(current);
      for (const ancestor of ancestorIds(CASE_FILE_TREE, id)) next.add(ancestor);
      return next;
    });
    router.replace(caseFileDocHref(record.id, id, view), { scroll: false });
    setSheetOpen(false);
  }

  function setFolderOpen(id: string, open: boolean) {
    setOpenIds((current) => {
      const next = new Set(current);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  /* Marking from the case file (DSB-20): a leaf that is a row of the
     Documents register, not yet marked, for a seat that marks evidence. */
  const canMark = useCanMarkEvidence();
  const marksRaw = useSessionValue(evidenceMarksKey(record.id));
  const marks = useMemo(() => parseEvidenceMarks(marksRaw), [marksRaw]);
  const register = useMemo(() => {
    try {
      return documentsFile(record).documents.map((document) => ({
        ...document,
        evidenceNumber: marks[document.id] ?? document.evidenceNumber,
      }));
    } catch {
      return [];
    }
  }, [record, marks]);
  const [marking, setMarking] = useState<{ id: string; title: string } | null>(null);
  const markableDocument = (nodeId: string) => {
    const id = caseFileRegisterDocumentId(nodeId);
    const document = id ? register.find((item) => item.id === id) : undefined;
    return document && !document.evidenceNumber ? document : undefined;
  };

  const indexProps = {
    nodes: CASE_FILE_TREE,
    selectedId: docId,
    openIds,
    onSelect: selectDoc,
    onFolderOpenChange: setFolderOpen,
    mark: canMark
      ? {
          can: (nodeId: string) => Boolean(markableDocument(nodeId)),
          onMark: (nodeId: string) => {
            const document = markableDocument(nodeId);
            if (document) setMarking({ id: document.id, title: document.title });
          },
        }
      : undefined,
  };

  return (
    <div className="sticky top-0 z-10 flex h-[calc(100svh-theme(spacing.14)-theme(spacing.6))] w-full flex-col gap-4 bg-muted dark:bg-background md:pointer-fine:h-[calc(100svh-theme(spacing.14)-theme(spacing.8))] md:landscape:h-[calc(100svh-theme(spacing.14)-theme(spacing.8))] md:pointer-fine:gap-0 md:landscape:gap-0">
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full shrink-0 justify-between md:pointer-fine:hidden md:landscape:hidden"
          >
            {/* The panel glyph says where the list comes from: a side panel
                from the left, not a page and not a menu (owner, Sept 21). */}
            <span className="flex items-center gap-2">
              <PanelLeftOpenIcon aria-hidden />
              Browse case file
            </span>
            <ChevronRightIcon aria-hidden className="text-muted-foreground" />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="w-full overflow-y-auto p-0 sm:max-w-sm"
        >
          <SheetHeader>
            <SheetTitle className="text-title-s font-semibold">
              Case file
            </SheetTitle>
            <SheetDescription>Choose a document to open.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <nav aria-label="Case file">
              <CaseFileIndex {...indexProps} />
            </nav>
          </div>
        </SheetContent>
      </Sheet>

      <Card
        className={cn(
          PANEL_CLASS,
          "flex min-h-0 flex-1 flex-col overflow-hidden py-0 hover:bg-card md:pointer-fine:flex-row md:landscape:flex-row md:pointer-fine:items-stretch md:landscape:items-stretch md:pointer-fine:gap-0 md:landscape:gap-0"
        )}
      >
        <div className="hidden min-h-0 w-72 shrink-0 flex-col gap-2 overflow-hidden p-4 md:pointer-fine:flex md:landscape:flex">
          {/* The row height of the document's title bar beside it, so the two
              headings and the PDF/Digital switch share one centre line. */}
          <h2 className="flex min-h-10 shrink-0 items-center px-2 text-body font-semibold">
            Case file
          </h2>
          <ScrollArea type="always" className="min-h-0 flex-1">
            <nav aria-label="Case file">
              <CaseFileIndex {...indexProps} />
            </nav>
          </ScrollArea>
        </div>
        <Separator
          orientation="vertical"
          className="hidden self-stretch bg-hairline md:pointer-fine:block md:landscape:block"
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden p-4">
          {/* One wrapping row at every width: the name on the left, the switch
              and the two actions at the far end. When a long name leaves no
              room they drop to their own line and still keep the far end
              (owner, Sept 21: stacked on the left they read as stray). */}
          <div className="flex shrink-0 flex-row flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <h2 className="min-w-0 text-body font-semibold">
                {selected && !isCaseFileFolder(selected)
                  ? selected.label
                  : "Case file"}
              </h2>
              {view === "digital" && pane?.badges && pane.badges.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {pane.badges.map((badge) => (
                    <Badge key={badge} variant="secondary">
                      {badge}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
            {isLeaf ? (
              <div className="ml-auto flex items-center gap-2">
                <DocumentViewSwitch
                  view={view}
                  onViewChange={(next) => {
                    router.replace(
                      caseFileDocHref(record.id, docId, next),
                      { scroll: false }
                    );
                  }}
                />
                {/*
                  The pane's two reads share one grid cell, so the actions
                  cannot hang off a preview header the way they do everywhere
                  else — they compose the shared row here instead. They stay
                  put across the toggle: both act on the paper, which is what
                  a case file item is, whichever read is open.
                */}
                {leafSrc && leafLabel ? (
                  <DocumentPreviewActions
                    title={leafLabel}
                    source={{ kind: "src", src: leafSrc }}
                    download={{
                      href: leafSrc,
                      label: `Download ${leafLabel} PDF`,
                    }}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
          <DocumentPane
            caseId={record.id}
            node={selected}
            pane={pane}
            view={view}
          />
        </div>
      </Card>
      <MarkEvidenceDialog
        caseId={record.id}
        document={marking}
        /* Every number given in the case, from any tab: a submitted document
           marked from Documents is not in the case file's own list. */
        taken={[
          ...register.map((document) => document.evidenceNumber),
          ...Object.values(marks),
        ]}
        onOpenChange={(open) => {
          if (!open) setMarking(null);
        }}
      />
    </div>
  );
}

/**
 * Exported for `order-case-file.tsx`: the order composer reads a document
 * from the same case-file tree while writing an order, and this is the
 * whole of the tree's accessible behaviour — focus rings, `aria-current`,
 * scroll-into-view — not something a second screen should rebuild.
 */
export function CaseFileIndex({
  nodes,
  selectedId,
  openIds,
  onSelect,
  onFolderOpenChange,
  mark,
  depth = 0,
}: {
  nodes: CaseFileNode[];
  selectedId: string;
  openIds: Set<string>;
  onSelect: (id: string) => void;
  onFolderOpenChange: (id: string, open: boolean) => void;
  /** Set for a seat that marks evidence (DET-12, DSB-20). */
  mark?: { can: (id: string) => boolean; onMark: (id: string) => void };
  depth?: number;
}) {
  return (
    <ul className="flex flex-col">
      {nodes.map((node) => (
        <li key={node.id}>
          {isCaseFileFolder(node) ? (
            <Collapsible
              open={openIds.has(node.id)}
              onOpenChange={(open) => onFolderOpenChange(node.id, open)}
            >
              <div className={rowShell}>
                <CollapsibleTrigger
                  className={cn(
                    rowClass,
                    "font-medium",
                    depthPad[Math.min(depth, depthPad.length - 1)]
                  )}
                  onClick={(event) => {
                    if (openIds.has(node.id)) return;
                    const item = event.currentTarget.closest("li");
                    if (!(item instanceof HTMLElement)) return;
                    /* One frame, so the folder has mounted its content and
                       the glide starts with the opening, not after it. */
                    requestAnimationFrame(() => scrollNodeIntoIndex(item));
                  }}
                >
                  <IndexLabel number={node.number} label={node.label} />
                  <ChevronDownIcon
                    className="pointer-events-none mt-0.5 size-4 shrink-0 text-muted-foreground group-aria-expanded/file-row:hidden"
                    aria-hidden
                  />
                  <ChevronUpIcon
                    className="pointer-events-none mt-0.5 hidden size-4 shrink-0 text-muted-foreground group-aria-expanded/file-row:inline"
                    aria-hidden
                  />
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent className={COLLAPSE_MOTION}>
                {node.children && node.children.length > 0 ? (
                  <CaseFileIndex
                    nodes={node.children}
                    selectedId={selectedId}
                    openIds={openIds}
                    onSelect={onSelect}
                    onFolderOpenChange={onFolderOpenChange}
                    mark={mark}
                    depth={depth + 1}
                  />
                ) : (
                  <p
                    className={cn(
                      "py-1.5 text-body-compact text-muted-foreground",
                      depthPad[Math.min(depth + 1, depthPad.length - 1)]
                    )}
                  >
                    None in this file yet
                  </p>
                )}
              </CollapsibleContent>
            </Collapsible>
          ) : (
            <div className={rowShell}>
              {/* DET-12. Right-click, the menu key, or a long press. Marking is
                  the court's; everyone with access to the case can download. */}
              <ContextMenu>
                <ContextMenuTrigger asChild>
                  <button
                    type="button"
                    aria-current={selectedId === node.id ? "page" : undefined}
                    onClick={() => onSelect(node.id)}
                    className={cn(
                      rowClass,
                      depthPad[Math.min(depth, depthPad.length - 1)],
                      selectedId === node.id &&
                        "bg-accent font-medium hover:bg-accent"
                    )}
                  >
                    <IndexLabel number={node.number} label={node.label} />
                  </button>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  {mark?.can(node.id) ? (
                    <>
                      <ContextMenuItem onSelect={() => mark.onMark(node.id)}>
                        Mark as Evidence
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                    </>
                  ) : null}
                  <ContextMenuItem asChild>
                    <a href={node.href} download>
                      Download
                    </a>
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Hairline on the shell, fill on the row — same split as Item + ItemSeparator. */
const rowShell = "py-1";

const rowClass =
  "group/file-row flex min-h-10 w-full min-w-0 items-start justify-between gap-2 rounded-lg py-2.5 text-left text-body-compact text-foreground outline-none hover:bg-surface-sunken focus-visible:ring-3 focus-visible:ring-ring/50 md:pointer-fine:min-h-8 md:pointer-fine:py-1.5 md:landscape:min-h-8 md:landscape:py-1.5";

const depthPad = ["px-2", "pr-2 pl-6", "pr-2 pl-8"] as const;

function scrollNodeIntoIndex(node: HTMLElement) {
  const viewport = node.closest("[data-slot=scroll-area-viewport]");
  const scroller =
    viewport instanceof HTMLElement ? viewport : node.closest("nav");
  if (!(scroller instanceof HTMLElement)) return;
  glideToTop(scroller, node);
}

function IndexLabel({ number, label }: { number: string; label: string }) {
  return (
    <span className="grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2 text-left">
      <span className="tabular-nums text-muted-foreground">
        {fileNumberLabel(number)}
      </span>
      <span className="min-w-0 whitespace-normal">{label}</span>
    </span>
  );
}

function DocumentViewSwitch({
  view,
  onViewChange,
}: {
  view: CaseFileView;
  onViewChange: (view: CaseFileView) => void;
}) {
  return (
    <SegmentedControl
      type="single"
      size="compact"
      value={view}
      onValueChange={(next) => {
        if (next === "pdf" || next === "digital") onViewChange(next);
      }}
      className="shrink-0"
      aria-label="Document view"
      aria-controls="case-file-document"
    >
      <SegmentedControlItem value="pdf">PDF</SegmentedControlItem>
      <SegmentedControlItem value="digital">Digital</SegmentedControlItem>
    </SegmentedControl>
  );
}

/**
 * Both reads of the paper live in one grid cell and the inactive one is
 * hidden rather than unmounted. Tearing the iframe down hands the browser a
 * fresh PDF viewer on every toggle: the reader loses their page, and on a
 * quick switch back the frame can come up blank because the plugin is
 * rebuilt against a box that has not been laid out yet. `invisible` keeps
 * the box in flow, so the viewer is built once and only ever hidden.
 */
function DocumentPane({
  caseId,
  node,
  pane,
  view,
}: {
  caseId: string;
  node: CaseFileNode | undefined;
  pane: ComplaintPane | undefined;
  view: CaseFileView;
}) {
  const leaf = node && !isCaseFileFolder(node) ? node : undefined;
  const src = leaf ? caseFilePdfSrc(leaf) : undefined;

  if (!leaf || !src) {
    return <NoDocumentSelected />;
  }

  return (
    <div
      id="case-file-document"
      className="grid min-h-0 min-w-0 flex-1 grid-cols-1 grid-rows-1 overflow-hidden"
    >
      <div
        className={cn(
          "col-start-1 row-start-1 min-h-0 min-w-0 overflow-hidden rounded-xl",
          DOCUMENT_GROUND,
          view === "pdf" ? "visible" : "invisible"
        )}
        aria-hidden={view === "pdf" ? undefined : true}
      >
        <CaseFilePdf src={src} title={leaf.label} />
      </div>

      {view === "digital" ? (
        <div className="col-start-1 row-start-1 flex min-h-0 min-w-0 flex-col">
          {pane ? (
            <DigitalRecord caseId={caseId} pane={pane} />
          ) : (
            <Empty className="min-h-0 flex-1 border border-dashed border-border bg-background">
              <EmptyHeader>
                <EmptyTitle className="text-body font-semibold">
                  No digital record
                </EmptyTitle>
                <EmptyDescription>
                  No digital record is filed for this paper. Open PDF to read
                  the document.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** A leaf with a page is one document inside its section's compiled file. */
function CaseFilePdf({ src, title }: { src: string; title: string }) {
  const { url, page } = parsePdfSrc(src);
  return (
    <PdfViewer
      key={src}
      src={url}
      title={title}
      pages={page ? { from: page, to: page } : undefined}
      className="size-full"
    />
  );
}

function NoDocumentSelected() {
  return (
    <Empty
      id="case-file-document"
      className="min-h-0 flex-1 border border-dashed border-border"
    >
      <EmptyHeader>
        <EmptyTitle className="text-body font-semibold">
          No document selected
        </EmptyTitle>
        <EmptyDescription>
          Choose an item from the case file to open it here.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
