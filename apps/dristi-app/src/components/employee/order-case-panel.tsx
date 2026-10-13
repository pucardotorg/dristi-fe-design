"use client";

import * as React from "react";
import {
  CheckIcon,
  ChevronRightIcon,
  FileTextIcon,
  LinkIcon,
  XIcon,
} from "lucide-react";

import { PdfViewer, parsePdfSrc } from "@/components/cases/pdf-viewer";
import { PANEL_CLASS } from "@/components/shell/panel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionRow,
  DescriptionTerm,
} from "@/components/ui/description-list";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CASE_FILE_TREE,
  caseFilePdfSrc,
  flattenLeaves,
  isCaseFileFolder,
  type CaseFileNode,
} from "@/lib/cases/case-file";
import { cn } from "@/lib/utils";

/** An application standing on the matter, as the case file lists it. */
export type PanelApplication = {
  id: string;
  label: string;
  /** Its number, on a line of its own under its name in the case file's list. */
  number?: string;
  /** "By the accused, 28 Aug 2026" — the line under that, worded as in the order. */
  detail: string;
  /** Decided in this order — linked by deciding it, so it cannot be unlinked here. */
  decided: boolean;
  onOpen: () => void;
};

type DocumentRow = {
  id: string;
  label: string;
  number?: string;
  detail?: string;
  node?: CaseFileNode;
  application?: PanelApplication;
};

/**
 * The case file beside the order — Abhirami's right-hand panel (v14).
 *
 * **Documents**: the case file's own index (`CASE_FILE_TREE`, the tree the advocate's
 * case file reads), searchable, with the applications standing on the matter first. Any
 * document can be **linked to the order**; an application decided in the order is linked
 * by deciding it. A document opens in one viewer, with Link in its header.
 *
 * **Overview**: the facts of the matter, as the screen that opened the order knows them.
 *
 * Abhirami's third tab, Case history, is not built: the employee side carries no history
 * of a matter's earlier hearings and orders to show, and borrowing the advocate fixture's
 * would put another case's history beside this one.
 */
export function OrderCasePanel({
  className,
  overview,
  applications = [],
  links,
  onLinksChange,
  disabled,
  cited = [],
  overviewContent,
  historyContent,
  preview,
  requestView,
  onViewRequested,
}: {
  className?: string;
  overview: { label: string; value: string }[];
  applications?: PanelApplication[];
  links: readonly string[];
  onLinksChange: (links: string[]) => void;
  disabled: boolean;
  /** Documents cited in the order's own words (version C's `@`): linked by citing them. */
  cited?: readonly string[];
  /** The court's own case overview, in place of the plain fact list. */
  overviewContent?: React.ReactNode;
  /**
   * The order as paper, kept live beside the drafting (version D, owner 2026-10-14) —
   * shows a Preview tab ahead of the case file's own, and opens on it.
   */
  preview?: React.ReactNode;
  /** The court's own case history, in place of the plain list — shows the tab. */
  historyContent?: React.ReactNode;
  /** A document to open in the viewer — a citation clicked in the order, say. */
  requestView?: string | null;
  onViewRequested?: () => void;
}) {
  const [query, setQuery] = React.useState("");
  /* Which sections are open: Applications, and any holding a paper already linked. */
  const [openSections, setOpenSections] = React.useState<Set<string>>(
    () =>
      new Set([
        "applications",
        ...CASE_FILE_TREE.filter((node) =>
          (isCaseFileFolder(node)
            ? flattenLeaves(node.children ?? [])
            : [node]
          ).some((leaf) => links.includes(leaf.id) || cited.includes(leaf.id)),
        ).map((node) => node.id),
      ]),
  );
  const [viewing, setViewing] = React.useState<DocumentRow | null>(null);
  const searchId = React.useId();

  const sections = React.useMemo(() => {
    const filed = CASE_FILE_TREE.map((node) => ({
      id: node.id,
      label: node.label,
      /* A section that is one document of its own name is that document's row. */
      single: !isCaseFileFolder(node),
      rows: (isCaseFileFolder(node)
        ? flattenLeaves(node.children ?? [])
        : [node]
      ).map((leaf): DocumentRow => ({
        id: leaf.id,
        label: leaf.label,
        node: leaf,
      })),
    }));
    return applications.length > 0
      ? [
          {
            id: "applications",
            label: "Applications",
            single: false,
            rows: applications.map((application): DocumentRow => ({
              id: application.id,
              label: application.label,
              number: application.number,
              detail: application.detail,
              application,
            })),
          },
          ...filed,
        ]
      : filed;
  }, [applications]);

  const allRows = sections.flatMap((section) => section.rows);
  /* Linked by deciding it or by citing it: fixed here, undone where it was done. */
  const decidedIds = [
    ...applications
      .filter((application) => application.decided)
      .map((application) => application.id),
    ...cited,
  ];
  const fixedReason = (id: string) =>
    cited.includes(id) ? "Cited here" : "Decided here";
  const linkedIds = [...new Set([...decidedIds, ...links])];

  /* A document asked for from outside — a citation clicked in the order. A filed paper
     opens in this panel's viewer; an application opens its own dialog. */
  const [seenRequest, setSeenRequest] = React.useState(requestView);
  if (requestView !== seenRequest) {
    setSeenRequest(requestView);
    const row = requestView
      ? allRows.find((entry) => entry.id === requestView)
      : undefined;
    if (row && !row.application) setViewing(row);
  }
  React.useEffect(() => {
    if (!requestView) return;
    allRows.find((entry) => entry.id === requestView)?.application?.onOpen();
    onViewRequested?.();
  }, [requestView, allRows, onViewRequested]);
  const linkedRows = linkedIds
    .map((id) => allRows.find((row) => row.id === id))
    .filter((row): row is DocumentRow => row !== undefined);

  const needle = query.trim().toLowerCase();
  const shown = sections
    .map((section) => ({
      ...section,
      rows: section.rows.filter(
        (row) =>
          !needle ||
          `${row.label} ${row.number ?? ""} ${row.detail ?? ""} ${section.label}`
            .toLowerCase()
            .includes(needle),
      ),
    }))
    .filter((section) => section.rows.length > 0);

  function toggle(id: string) {
    onLinksChange(
      links.includes(id)
        ? links.filter((entry) => entry !== id)
        : [...links, id],
    );
  }

  function open(row: DocumentRow) {
    if (row.application) row.application.onOpen();
    else setViewing(row);
  }

  return (
    <Card
      className={cn(
        PANEL_CLASS,
        "min-w-0 flex-col gap-0 overflow-hidden py-0",
        className,
      )}
    >
      <Tabs
        defaultValue={preview ? "preview" : "documents"}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        {/* The product's line tabs (case peek, Approve registrations): left-aligned on
            their own rule, the active mark landing on it. Here the strip is the panel's
            head, so it takes the head's height and its rule lines up with the heads either
            side; the header button already names the panel. */}
        <div className="h-14 shrink-0 border-b border-hairline px-1">
          <TabsList
            variant="line"
            aria-label="Case file"
            className="h-14 w-full justify-start rounded-none p-0 group-data-horizontal/tabs:h-14"
          >
            {preview ? (
              <TabsTrigger
                value="preview"
                className="h-full flex-none px-3 text-body-compact group-data-horizontal/tabs:after:-bottom-px"
              >
                Order preview
              </TabsTrigger>
            ) : null}
            <TabsTrigger
              value="documents"
              className="h-full flex-none px-3 text-body-compact group-data-horizontal/tabs:after:-bottom-px"
            >
              Documents
            </TabsTrigger>
            <TabsTrigger
              value="overview"
              className="h-full flex-none px-3 text-body-compact group-data-horizontal/tabs:after:-bottom-px"
            >
              Overview
            </TabsTrigger>
            {historyContent ? (
              <TabsTrigger
                value="history"
                className="h-full flex-none px-3 text-body-compact group-data-horizontal/tabs:after:-bottom-px"
              >
                Case history
              </TabsTrigger>
            ) : null}
          </TabsList>
        </div>

        {preview ? (
          /* The paper on the panel's sunken well, the way a document reads everywhere
             else in the product: a white sheet with a hairline, scrolling on its own. */
          <TabsContent
            value="preview"
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-surface-sunken p-4"
          >
            <div className="rounded-lg border border-hairline bg-card p-6 shadow-raised">
              {preview}
            </div>
          </TabsContent>
        ) : null}

        <TabsContent
          value="documents"
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4"
        >
          <div className="flex min-w-0 flex-col gap-1">
            <Label htmlFor={searchId} className="sr-only">
              Search the case file
            </Label>
            <Input
              id={searchId}
              type="search"
              placeholder="Search the case file"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          {needle ? null : (
            <section
              aria-labelledby={`${searchId}-linked`}
              className="flex min-w-0 flex-col gap-1 rounded-lg border border-hairline bg-surface-sunken p-2"
            >
              <div className="flex min-h-8 items-center justify-between gap-2 pr-3 pl-2">
                <h3
                  id={`${searchId}-linked`}
                  className="text-body-compact font-semibold"
                >
                  Linked to this order
                </h3>
                {linkedRows.length > 0 ? (
                  <span className="text-body-compact tabular-nums text-muted-foreground">
                    {linkedRows.length}
                  </span>
                ) : null}
              </div>
              {linkedRows.length === 0 ? (
                <p className="px-2 pb-1 text-body-compact text-muted-foreground">
                  Nothing yet. Choose Link on a document below.
                </p>
              ) : (
                /* The list rows' grammar in the well: one hover per row, the name
                   shortening before anything else does, and the right-hand slot — the
                   unlink, or the word for why there is none — held to one edge. */
                <ul className="flex min-w-0 flex-col">
                  {linkedRows.map((row) => {
                    const decided = decidedIds.includes(row.id);
                    return (
                      <li
                        key={row.id}
                        className="group/row flex min-w-0 items-center gap-2 rounded-md pr-1 transition-colors hover:bg-accent has-focus-visible:bg-accent"
                      >
                        <button
                          type="button"
                          onClick={() => open(row)}
                          className="flex min-h-10 min-w-0 flex-1 items-center rounded-md px-2 text-left text-body-compact font-medium focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                        >
                          <span className="truncate">{row.label}</span>
                        </button>
                        {decided ? (
                          <span className="shrink-0 pr-2 text-body-compact text-muted-foreground">
                            {fixedReason(row.id)}
                          </span>
                        ) : disabled ? null : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Unlink ${row.label}`}
                            className="relative shrink-0 text-muted-foreground after:absolute after:-inset-1 after:content-[''] group-hover/row:text-foreground hover:bg-accent-strong"
                            onClick={() => toggle(row.id)}
                          >
                            <XIcon aria-hidden />
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {shown.length === 0 ? (
            <p className="text-body-compact text-muted-foreground">
              Nothing in the case file matches &ldquo;{query.trim()}&rdquo;.
            </p>
          ) : (
            /* The case file as folders (owner, 2026-10-13): a section is one quiet row
               — its name and how many papers it holds — that opens to show them, hung
               from a guide line under its chevron like the index's steps. Shut, the
               fourteen sections read as a short list of names; open, a paper can never
               be mistaken for its section. Applications, and any section holding a
               linked paper, start open; a search opens what it finds. A section that is
               a single paper of its own name is simply that paper's row, with a page
               glyph in the chevron's column so every row of the list starts alike. */
            /* Pulled out by a row's padding, so the glyphs start on the search
               field's left edge and the counts and Link end on its right. */
            <div className="-mx-2 flex min-w-0 flex-col gap-0.5">
              {shown.map((section) => {
                const expanded =
                  Boolean(needle) || openSections.has(section.id);
                if (section.single) {
                  const row = section.rows[0];
                  return (
                    <ul
                      key={section.id}
                      aria-label={section.label}
                      className="flex min-w-0 flex-col"
                    >
                      <DocumentLine
                        row={row}
                        icon={
                          <FileTextIcon
                            aria-hidden
                            className="size-4 shrink-0 text-muted-foreground"
                          />
                        }
                        linked={linkedIds.includes(row.id)}
                        fixed={
                          decidedIds.includes(row.id)
                            ? fixedReason(row.id)
                            : null
                        }
                        disabled={disabled}
                        onOpen={() => open(row)}
                        onToggle={() => toggle(row.id)}
                      />
                    </ul>
                  );
                }
                return (
                  <section
                    key={section.id}
                    aria-labelledby={`${searchId}-${section.id}`}
                    className="flex min-w-0 flex-col"
                  >
                    <h3 id={`${searchId}-${section.id}`} className="min-w-0">
                      <button
                        type="button"
                        aria-expanded={expanded}
                        onClick={() =>
                          setOpenSections((current) => {
                            const next = new Set(current);
                            if (next.has(section.id)) next.delete(section.id);
                            else next.add(section.id);
                            return next;
                          })
                        }
                        className="flex min-h-10 w-full min-w-0 items-center gap-2 rounded-lg px-2 text-left text-body-compact transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        <ChevronRightIcon
                          aria-hidden
                          className={cn(
                            "size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none",
                            expanded && "rotate-90",
                          )}
                        />
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {section.label}
                        </span>
                        <span className="shrink-0 text-muted-foreground tabular-nums">
                          {section.rows.length}
                        </span>
                      </button>
                    </h3>
                    {expanded ? (
                      /* The guide line runs from under the chevron's centre. */
                      <ul className="relative ml-4 flex min-w-0 flex-col pl-2 before:absolute before:inset-y-1 before:left-0 before:w-px before:bg-hairline">
                        {section.rows.map((row) => (
                          <DocumentLine
                            key={row.id}
                            row={row}
                            linked={linkedIds.includes(row.id)}
                            fixed={
                              decidedIds.includes(row.id)
                                ? fixedReason(row.id)
                                : null
                            }
                            disabled={disabled}
                            onOpen={() => open(row)}
                            onToggle={() => toggle(row.id)}
                          />
                        ))}
                      </ul>
                    ) : null}
                  </section>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent
          value="overview"
          className="min-h-0 flex-1 overflow-y-auto p-4"
        >
          {overviewContent ?? (
            <DescriptionList>
              {overview.map((row) => (
                <DescriptionRow key={row.label}>
                  <DescriptionTerm className="text-body-compact">
                    {row.label}
                  </DescriptionTerm>
                  <DescriptionDetails className="text-body-compact">
                    {row.value}
                  </DescriptionDetails>
                </DescriptionRow>
              ))}
            </DescriptionList>
          )}
        </TabsContent>
        {historyContent ? (
          <TabsContent
            value="history"
            className="min-h-0 flex-1 overflow-y-auto p-4"
          >
            {historyContent}
          </TabsContent>
        ) : null}
      </Tabs>

      <Dialog
        open={viewing !== null}
        onOpenChange={(next) => {
          if (!next) setViewing(null);
        }}
      >
        <DialogContent className="flex h-[85dvh] flex-col gap-4 sm:max-w-5xl">
          <DialogHeader className="flex-row items-start justify-between gap-4 pr-12">
            <div className="flex min-w-0 flex-col gap-1">
              <DialogTitle className="text-title-s font-semibold">
                {viewing?.label}
              </DialogTitle>
              <DialogDescription>From the case file</DialogDescription>
            </div>
            {viewing && !disabled ? (
              <Button
                type="button"
                variant={links.includes(viewing.id) ? "outline" : "default"}
                aria-pressed={links.includes(viewing.id)}
                onClick={() => toggle(viewing.id)}
              >
                {links.includes(viewing.id) ? (
                  <CheckIcon data-icon="inline-start" aria-hidden />
                ) : (
                  <LinkIcon data-icon="inline-start" aria-hidden />
                )}
                {links.includes(viewing.id)
                  ? "Linked to the order"
                  : "Link to the order"}
              </Button>
            ) : null}
          </DialogHeader>
          {/* The app's own PDF surface, as on the case file itself — not the browser's
              viewer in an iframe. */}
          {viewing?.node && caseFilePdfSrc(viewing.node) ? (
            <CaseDocument
              key={viewing.id}
              src={caseFilePdfSrc(viewing.node) ?? ""}
              title={viewing.label}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/** A leaf with a page is one document inside its section's compiled file. */
function CaseDocument({ src, title }: { src: string; title: string }) {
  const { url, page } = parsePdfSrc(src);
  return (
    <PdfViewer
      src={url}
      title={title}
      pages={page ? { from: page, to: page } : undefined}
      className="min-h-0 flex-1"
    />
  );
}

/**
 * One paper in the case file's list, always the same shape however long its words: the
 * name on one line, and for an application its number and its filing each on a quiet
 * line of their own under it — every line shortening rather than wrapping (the full
 * text is the row's tooltip), and the shortening falling on no date.
 * One hover covers the row. Link is not drawn at rest, so thirty papers do not carry
 * thirty buttons and the words keep the row's full width: on hover or keyboard focus it
 * comes in over the row's end, on the row's own fill, with no box of its own; on a touch
 * screen it always stands at the end. A linked paper keeps its tick. A paper that is a
 * section of its own carries a glyph (`icon`) in the chevron's column.
 */
function DocumentLine({
  row,
  icon,
  linked,
  fixed,
  disabled,
  onOpen,
  onToggle,
}: {
  row: DocumentRow;
  icon?: React.ReactNode;
  linked: boolean;
  fixed: string | null;
  disabled: boolean;
  onOpen: () => void;
  onToggle: () => void;
}) {
  const meta = [row.number, row.detail].filter(Boolean).join(" · ");
  return (
    <li className="group/row relative flex min-w-0 items-center gap-1 rounded-lg transition-colors hover:bg-accent has-focus-visible:bg-accent">
      <button
        type="button"
        onClick={onOpen}
        title={meta ? `${row.label}\n${meta}` : row.label}
        className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-lg py-2 pr-2 pl-2 text-left text-body-compact focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {icon}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={cn("truncate", icon && "font-medium")}>
            {row.label}
          </span>
          {row.number ? (
            <span className="truncate font-mono text-muted-foreground">
              {row.number}
            </span>
          ) : null}
          {row.detail ? (
            <span className="truncate text-muted-foreground">
              {row.detail}
            </span>
          ) : null}
        </span>
      </button>
      {fixed || linked ? (
        disabled || fixed ? (
          <span
            className="inline-flex h-9 shrink-0 items-center gap-1 px-2 text-body-compact font-medium text-success-ink"
            title={fixed ?? undefined}
          >
            <CheckIcon className="size-4" aria-hidden />
            Linked
          </span>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed
            aria-label={`Unlink ${row.label} from the order`}
            className="relative shrink-0 px-2 text-body-compact font-medium text-success-ink after:absolute after:-inset-1 after:content-[''] hover:bg-accent-strong hover:text-success-ink"
            onClick={onToggle}
          >
            <CheckIcon data-icon="inline-start" aria-hidden />
            Linked
          </Button>
        )
      ) : disabled ? null : (
        /* Over the row's end, fading in from the row's fill so a shortened name runs
           under it rather than stopping short of it. */
        <div
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 flex items-center rounded-r-lg bg-linear-to-l from-accent from-75% to-transparent pl-6 opacity-0 transition-opacity",
            "group-hover/row:pointer-events-auto group-hover/row:opacity-100 has-focus-visible:pointer-events-auto has-focus-visible:opacity-100",
            "[@media(hover:none)]:pointer-events-auto [@media(hover:none)]:static [@media(hover:none)]:bg-none [@media(hover:none)]:pl-0 [@media(hover:none)]:opacity-100",
          )}
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={false}
            aria-label={`Link ${row.label} to the order`}
            className="px-2 text-body-compact font-medium hover:bg-accent-strong"
            onClick={onToggle}
          >
            <LinkIcon data-icon="inline-start" aria-hidden />
            Link
          </Button>
        </div>
      )}
    </li>
  );
}
