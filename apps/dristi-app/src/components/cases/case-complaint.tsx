"use client";

import { useState } from "react";
import { useCaseRouter } from "@/components/cases/case-reader";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";

import { DigitalRecord } from "@/components/cases/digital-record";
import { Identifier } from "@/components/chrome/identifier";
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
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  ancestorIds,
  complaintPane,
  complaintPartHref,
  complaintTree,
  fileNumberLabel,
  findNode,
  isComplaintFolder,
  type ComplaintNode,
} from "@/lib/cases/complaint";
import { type CaseRecord } from "@/lib/cases/types";
import { cn } from "@/lib/utils";

/**
 * Same region as Case file — numbered index and the selected record share
 * a Card so they cannot scroll apart (Laws: grouped content gets a border).
 * The case header and section tabs still scroll away. The panel is at least
 * the leftover scrollport; opening a section grows the card downward.
 * Only the nested record pane moves.
 *
 * Phone: the index moves into a Sheet so the page stays the record
 * (RESPONSIVE — stack / overlay before splitting).
 *
 * Papers show as a thumbnail strip — a look at the page, not a reader.
 * A filed preview opens that paper in Case file.
 */
export function CaseComplaint({
  record,
  partId,
}: {
  record: CaseRecord;
  partId: string;
}) {
  const router = useCaseRouter();
  const tree = complaintTree(record.id);
  const selected = findNode(tree, partId);
  const pane =
    selected && !isComplaintFolder(selected)
      ? complaintPane(record.id, selected.id)
      : undefined;
  const [sheetOpen, setSheetOpen] = useState(false);
  const [openIds, setOpenIds] = useState(
    () => new Set(ancestorIds(tree, partId))
  );

  function selectPart(id: string) {
    setOpenIds((current) => {
      const next = new Set(current);
      for (const ancestor of ancestorIds(tree, id)) next.add(ancestor);
      return next;
    });
    router.replace(complaintPartHref(record.id, id), { scroll: false });
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

  if (tree.length === 0) {
    return (
      <Empty className="border border-dashed border-border">
        <EmptyHeader>
          <EmptyTitle className="text-title-s font-semibold">
            Complaint is not in this fixture
          </EmptyTitle>
          <EmptyDescription className="text-body">
            Structured complaint details are filed for the dummy Section 138
            case. Open Sunil Varghese v. Anand Traders to read them.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  /* The cheque's number comes back apart from the words in front of it, because
     "Cheque number 000184" as one string leaves nothing to set as an identifier. The
     heading is the kind of thing, so it is also the copy affordance's name. */
  const headingText =
    pane?.title ??
    (selected && !isComplaintFolder(selected) ? selected.label : "Complaint");
  const headingId = pane
    ? pane.titleId
    : selected && !isComplaintFolder(selected)
      ? selected.labelId
      : undefined;

  const indexProps = {
    nodes: tree,
    selectedId: partId,
    openIds,
    onSelect: selectPart,
    onFolderOpenChange: setFolderOpen,
  };

  return (
    <div className="sticky top-0 z-10 flex w-full flex-col gap-4 bg-background md:gap-0">
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full shrink-0 sm:w-auto md:hidden"
          >
            Browse complaint
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="w-full overflow-y-auto p-0 sm:max-w-sm"
        >
          <SheetHeader>
            <SheetTitle className="text-title-s font-semibold">
              Complaint
            </SheetTitle>
            <SheetDescription>
              Choose a record to open.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <nav aria-label="Complaint">
              <ComplaintIndex {...indexProps} />
            </nav>
          </div>
        </SheetContent>
      </Sheet>

      <Card className="flex min-h-[calc(100svh-theme(spacing.14)-theme(spacing.6))] flex-col overflow-hidden py-0 hover:bg-card md:min-h-[calc(100svh-theme(spacing.14)-theme(spacing.8))] md:flex-row md:items-stretch md:gap-0">
        <div className="hidden w-80 shrink-0 flex-col gap-4 p-6 md:flex">
          <h2 className="text-title-s font-semibold">Complaint</h2>
          <nav aria-label="Complaint">
            <ComplaintIndex {...indexProps} />
          </nav>
        </div>
        <Separator orientation="vertical" className="hidden self-stretch md:block" />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden p-6">
          <div className="flex shrink-0 flex-wrap items-start justify-between gap-4">
            <h2 className="min-w-0 text-title-s font-semibold">
              {headingText}
              {headingId ? (
                <>
                  {" "}
                  {/* The face, not the affordance: a copy control inside the heading
                      would put "Copy the cheque number" into the heading's accessible
                      name. The number is copyable in the record below. */}
                  <Identifier value={headingId} copyable={false} />
                </>
              ) : null}
            </h2>
            {pane?.badges && pane.badges.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {pane.badges.map((badge) => (
                  <Badge key={badge} variant="secondary">
                    {badge}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
          <DigitalRecord caseId={record.id} pane={pane} />
        </div>
      </Card>
    </div>
  );
}

function ComplaintIndex({
  nodes,
  selectedId,
  openIds,
  onSelect,
  onFolderOpenChange,
  depth = 0,
}: {
  nodes: ComplaintNode[];
  selectedId: string;
  openIds: Set<string>;
  onSelect: (id: string) => void;
  onFolderOpenChange: (id: string, open: boolean) => void;
  depth?: number;
}) {
  return (
    <ul className="flex flex-col">
      {nodes.map((node) => (
        <li key={node.id}>
          {isComplaintFolder(node) ? (
            <Collapsible
              open={openIds.has(node.id)}
              onOpenChange={(open) => onFolderOpenChange(node.id, open)}
            >
              <div className={rowShell}>
                <CollapsibleTrigger
                  className={cn(
                    rowClass,
                    depthPad[Math.min(depth, depthPad.length - 1)]
                  )}
                >
                  <IndexLabel
                    number={node.number}
                    label={node.label}
                    labelId={node.labelId}
                  />
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
              <CollapsibleContent>
                {node.children && node.children.length > 0 ? (
                  <ComplaintIndex
                    nodes={node.children}
                    selectedId={selectedId}
                    openIds={openIds}
                    onSelect={onSelect}
                    onFolderOpenChange={onFolderOpenChange}
                    depth={depth + 1}
                  />
                ) : (
                  <p
                    className={cn(
                      "border-b border-border py-3 text-body text-muted-foreground",
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
              <button
                type="button"
                aria-current={selectedId === node.id ? "page" : undefined}
                onClick={() => onSelect(node.id)}
                className={cn(
                  rowClass,
                  depthPad[Math.min(depth, depthPad.length - 1)],
                  selectedId === node.id &&
                    "bg-accent-strong font-medium hover:bg-accent-strong"
                )}
              >
                <IndexLabel
                  number={node.number}
                  label={node.label}
                  labelId={node.labelId}
                />
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Hairline on the shell, fill on the row — same split as Item + ItemSeparator. */
const rowShell = "border-b border-border py-1";

const rowClass =
  "group/file-row flex min-h-10 w-full min-w-0 items-start justify-between gap-2 rounded-lg py-2 text-left text-body text-foreground outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50";

const depthPad = ["px-2", "pr-2 pl-6", "pr-2 pl-12"] as const;

function IndexLabel({
  number,
  label,
  labelId,
}: {
  number: string;
  label: string;
  labelId?: string;
}) {
  return (
    <span className="grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2 text-left">
      <span className="tabular-nums text-muted-foreground">
        {fileNumberLabel(number)}
      </span>
      <span className="min-w-0 whitespace-normal">
        {label}
        {labelId ? (
          <>
            {" "}
            {/* The row itself is the navigation button — no control nested inside it. */}
            <Identifier
              value={labelId}
              label={label.toLowerCase()}
              copyable={false}
            />
          </>
        ) : null}
      </span>
    </span>
  );
}

