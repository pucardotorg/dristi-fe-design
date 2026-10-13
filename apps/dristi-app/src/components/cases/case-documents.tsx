"use client";

import { useMemo, useState, type MouseEvent, type ReactNode } from "react";
import {
  ChevronDownIcon,
  CircleAlertIcon,
  FileSearchIcon,
  FileTextIcon,
} from "lucide-react";

import { DocumentRecordDialog } from "@/components/cases/document-record-dialog";
import { DownloadFilingButton } from "@/components/cases/download-filing-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  RegisterFilter,
  RegisterSearch,
} from "@/components/cases/register-controls";
import {
  TABLE_CELL,
  TABLE_HEAD,
  TABLE_HEAD_ROW,
  tableBodyClass,
  tableRowClass,
} from "@/components/chrome/table-plate";
import { PANEL_CLASS } from "@/components/shell/panel";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/ui/segmented-control";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DOCUMENTS_PAGE_SIZE,
  DOCUMENTS_PAGE_SIZES,
  DOCUMENT_GROUPS,
  DOCUMENT_TYPES,
  documentKind,
  documentSrc,
  documentKindTitle,
  documentPageWindow,
  documentSourceLabel,
  documentStatusLabel,
  documentStatusVariant,
  documentTypeLabel,
  documentsFile,
  documentFromFiling,
  documentNotSubmitted,
  documentPeopleFromFilings,
  evidenceStatusLabel,
  isDocumentKind,
  isDocumentsPageSize,
  personIdentity,
  selectDocuments,
  submittedByName,
  submittedBySideLabel,
  type CaseDocument,
  type DocumentKind,
  type DocumentPerson,
  type DocumentTypeId,
  type DocumentsFile,
  type DocumentsPageSize,
} from "@/lib/cases/documents";
import { formatCaseDate, type CaseRecord } from "@/lib/cases/types";
import { cn } from "@/lib/utils";
import { RegisterTrayCard, useOneOpen } from "@/components/cases/register-card";
import {
  REGISTER_CARDS_ONLY,
  REGISTER_CARDS_QUERY,
  REGISTER_FILTER_ROW,
  REGISTER_ROW_SEARCH,
  REGISTER_SWITCH,
  REGISTER_TABLE_ONLY,
  SHOW_MORE_STEP,
} from "@/components/cases/register-layout";
import { useMediaQuery } from "@/hooks/use-media-query";
import { displayName } from "@/lib/cases/names";
import { Identifier } from "@/components/chrome/identifier";
import { ApplicationRecordDialog } from "@/components/cases/application-record-dialog";
import {
  NeedsAction,
  SignAndPayDialogs,
  useFilingsRegister,
} from "@/components/cases/case-applications";
import { SignReviewDialog } from "@/components/cases/sign-review-dialog";
import { localFileSrc } from "@/components/cases/pdf-viewer";
import {
  groupActions,
  type ApplicationRecord,
} from "@/lib/cases/application-record";

type SubmitterOption = {
  value: string;
  label: string;
  role: string;
};

type TypeGroup = {
  value: string;
  label: string;
  items: { value: DocumentTypeId; label: string }[];
};

const headClass = TABLE_HEAD;
const cellClass = TABLE_CELL;
const filterBarClass =
  "flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end";
const filterFieldClass = "min-w-0 w-full md:w-72";

/**
 * Case-wide register of individual files. Panel title sits above
 * Documents / Bail bonds (default Tabs; active uses text-primary). Make
 * filings stays the teal fill (Laws). Type groups stay in the filter
 * inside Documents — bail bonds are a sibling population, not a type.
 */
export function CaseDocuments({ record }: { record: CaseRecord }) {
  const file = useMemo(() => {
    try {
      return documentsFile(record);
    } catch {
      return null;
    }
  }, [record]);
  /* Memos and affidavits filed on the case come from the filings record the
     Applications tab reads, so a step taken on either shows on both. */
  const { register } = useFilingsRegister(record);

  if (!file) return <DocumentsError />;
  return (
    <DocumentsReady
      record={record}
      file={file}
      filings={register?.documents ?? NO_FILINGS}
    />
  );
}

const NO_FILINGS: ApplicationRecord[] = [];

export function DocumentsLoading() {
  return (
    <DocumentsPanel
      busy
      switcher={<Skeleton className="h-10 w-64 rounded-lg" />}
    >
      <span className="sr-only" role="status">
        Loading documents
      </span>
      <div className={filterBarClass}>
        <Skeleton className={cn("h-10 w-full", filterFieldClass)} />
        <Skeleton className={cn("h-10 w-full", filterFieldClass)} />
      </div>
      <Separator />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    </DocumentsPanel>
  );
}

function DocumentsError() {
  return (
    <DocumentsPanel>
      <Alert variant="destructive">
        <CircleAlertIcon aria-hidden />
        <AlertTitle>
          Documents could not be loaded
        </AlertTitle>
        <AlertDescription>
          Refresh the page to try again.
        </AlertDescription>
      </Alert>
    </DocumentsPanel>
  );
}

function DocumentsReady({
  record,
  file,
  filings: filed,
}: {
  record: CaseRecord;
  file: DocumentsFile;
  /** Memos and affidavits filed through the document submission flow. */
  filings: ApplicationRecord[];
}) {
  const [kind, setKind] = useState<DocumentKind>("documents");
  const [typeIds, setTypeIds] = useState<string[]>([]);
  const [submitterIds, setSubmitterIds] = useState<string[]>([]);
  const [filingQuery, setFilingQuery] = useState("");
  const [pageSize, setPageSize] = useState<DocumentsPageSize>(
    DOCUMENTS_PAGE_SIZE
  );
  const [page, setPage] = useState(1);
  const cards = useMediaQuery(REGISTER_CARDS_QUERY);
  const [visible, setVisible] = useState(SHOW_MORE_STEP);
  const [recordOpen, setRecordOpen] = useState<CaseDocument | null>(null);

  /* A memo or affidavit not yet signed can take a new file (owner, Oct 8).
     Held for this visit, like every demo step. */
  const [replaced, setReplaced] = useState<Record<string, { label: string; src: string }>>({});
  const filings = useMemo(
    () =>
      filed.map((item) =>
        replaced[item.id] ? { ...item, documents: [replaced[item.id]] } : item
      ),
    [filed, replaced]
  );
  function replaceFile(item: ApplicationRecord, picked: File) {
    setReplaced((all) => ({
      ...all,
      [item.id]: { label: picked.name, src: localFileSrc(picked) },
    }));
  }

  /* The filed memos and affidavits are rows like any other; theirs open the
     filing itself, with its step (PM, Oct 8). */
  const documents = useMemo(
    () => [...filings.map(documentFromFiling), ...file.documents],
    [filings, file.documents]
  );
  const peopleById = new Map(
    [...documentPeopleFromFilings(filings), ...file.people].map((person) => [
      person.id,
      person,
    ])
  );
  const [filingOpen, setFilingOpen] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<ApplicationRecord[]>([]);
  const [signing, setSigning] = useState<ApplicationRecord[]>([]);
  const [paying, setPaying] = useState<ApplicationRecord[]>([]);
  const actions = groupActions(filings);
  /* The review reads the batch as it is now, replaced files and all. */
  const reviewingNow = useMemo(
    () =>
      reviewing.map(
        (item) => filings.find((entry) => entry.id === item.id) ?? item
      ),
    [reviewing, filings]
  );
  const openFiling = filings.find((item) => item.id === filingOpen) ?? null;

  function openRecord(document: CaseDocument) {
    if (filings.some((item) => item.id === document.id)) setFilingOpen(document.id);
    else setRecordOpen(document);
  }

  /** As on Applications: one to sign opens what is signed; several open the
   *  review; payment goes straight to the fee. */
  function act(items: ApplicationRecord[]) {
    const [lead] = items;
    if (lead.step === "pay") setPaying(items);
    else if (lead.step === "sign") {
      if (items.length === 1) setFilingOpen(lead.id);
      else setReviewing(items);
    }
  }

  const kindDocuments = documents.filter(
    (document) => documentKind(document.type) === kind
  );
  const submitterOptions = uniqueSubmitters(kindDocuments, peopleById);

  const typeGroups: TypeGroup[] = DOCUMENT_GROUPS.filter((group) =>
    kind === "bail-bonds"
      ? group.id === "bail-bonds"
      : group.id !== "bail-bonds"
  )
    .map((group) => ({
      value: group.id,
      label: group.label,
      items: DOCUMENT_TYPES.filter((item) => item.groupId === group.id).map(
        (item) => ({
          value: item.id,
          label: item.label,
        })
      ),
    }))
    .filter((group) => group.items.length > 0);

  const selection = selectDocuments({
    /* The filters take any number of values, so they narrow the list here
       and the selector only handles kind, search and paging. */
    documents: documents.filter(
      (document) =>
        (typeIds.length === 0 || typeIds.includes(document.type)) &&
        (submitterIds.length === 0 ||
          submitterIds.includes(document.submittedById))
    ),
    kind,
    typeId: null,
    submittedById: null,
    filingQuery,
    // Under a finger the list grows by "Show more" and has no pages (owner,
    // Sept 21); the table keeps its pager.
    pageSize: cards ? visible : pageSize,
    page: cards ? 1 : page,
  });

  const filtered =
    typeIds.length > 0 || submitterIds.length > 0 || filingQuery.trim() !== "";
  const showTypeFilter = kind === "documents";

  function resetPage() {
    setPage(1);
    setVisible(SHOW_MORE_STEP);
  }

  function clearFilters() {
    setTypeIds([]);
    setSubmitterIds([]);
    setFilingQuery("");
    resetPage();
  }

  function pageLink(nextPage: number) {
    return {
      href: "#",
      onClick: (event: MouseEvent<HTMLAnchorElement>) => {
        event.preventDefault();
        setPage(nextPage);
      },
    };
  }

  const switcher = (
    <KindTabs
      kind={kind}
      documentsCount={selection.documentsCount}
      bailBondsCount={selection.bailBondsCount}
      onKindChange={(next) => {
        setKind(next);
        setTypeIds([]);
        setSubmitterIds([]);
        resetPage();
      }}
    />
  );

  /* Sits at the switcher row's right corner — the register-wide search the
     legacy screens keep beside Type, reduced to the one field the filter bar
     does not already cover. */
  const search = (
    <RegisterSearch
      label="Search by filing ID"
      value={filingQuery}
      onChange={(next) => {
        setFilingQuery(next);
        resetPage();
      }}
    />
  );

  if (documents.length === 0) {
    return (
      <DocumentsPanel switcher={switcher}>
        <DocumentsEmpty
          icon={FileTextIcon}
          title={emptyTitle(kind, false)}
          description={emptyDescription(kind, false)}
        />
      </DocumentsPanel>
    );
  }

  return (
    <>
      <DocumentsPanel switcher={switcher}>
        {kind === "documents" && actions.length > 0 ? (
          <NeedsAction
            caseId={record.id}
            entries={actions}
            onAct={act}
            onOpen={setFilingOpen}
          />
        ) : null}
        {/* As on Applications: the controls sit on the table they narrow, a
            step clear of Needs attention, the search at the row's far end
            (owner, Oct 8). */}
        <div
          className={cn(
            REGISTER_FILTER_ROW,
            kind === "documents" && actions.length > 0 && "mt-4"
          )}
        >
          {showTypeFilter ? (
            <RegisterFilter
              label="Type"
              values={typeIds}
              onChange={(next) => {
                setTypeIds(next);
                resetPage();
              }}
              options={typeGroups.flatMap((group) => group.items)}
            />
          ) : null}
          <RegisterFilter
            label="Submitted by"
            values={submitterIds}
            onChange={(next) => {
              setSubmitterIds(next);
              resetPage();
            }}
            options={submitterOptions}
          />
          {filtered ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearFilters}
            >
              Clear filters
            </Button>
          ) : null}
          <div className={REGISTER_ROW_SEARCH}>{search}</div>
        </div>

        {selection.total === 0 ? (
          <DocumentsEmpty
            icon={filtered ? FileSearchIcon : FileTextIcon}
            title={emptyTitle(kind, filtered)}
            description={emptyDescription(kind, filtered)}
          />
        ) : (
          <div className="flex flex-col gap-4">
            {/* The count sits as far from the filters as from the table. */}
            <div className="flex flex-wrap items-center gap-2">
              <p
                aria-live="polite"
                className="text-caption font-medium tabular-nums text-muted-foreground"
              >
                {matchingCountLabel(kind, selection.total, filtered)}
              </p>
            </div>

            <div className="overflow-x-auto">
              <div className={REGISTER_TABLE_ONLY}>
                <DocumentsTable
                  caption={documentKindTitle(kind)}
                  rows={selection.rows}
                  peopleById={peopleById}
                  onOpenRecord={openRecord}
                />
              </div>
              {/* No inset of its own: the panel already pads it, and a second
                  16px left the cards floating in a box (owner, Sept 21). */}
              <div className={REGISTER_CARDS_ONLY}>
                <DocumentsItemList
                  rows={selection.rows}
                  peopleById={peopleById}
                  onOpenRecord={openRecord}
                />
              </div>
            </div>

            {selection.total > selection.rows.length ? (
              <Button
                type="button"
                variant="outline"
                className={cn("w-full", REGISTER_CARDS_ONLY)}
                onClick={() => setVisible((count) => count + SHOW_MORE_STEP)}
              >
                Show more
                <ChevronDownIcon data-icon="inline-end" aria-hidden />
              </Button>
            ) : null}

            <div
              className={cn(
                "flex-col gap-3 md:flex-row md:items-center md:justify-between",
                REGISTER_TABLE_ONLY,
                "md:pointer-fine:flex md:landscape:flex"
              )}
            >
              <div className="flex flex-wrap items-center gap-4">
                {selection.pageCount > 1 ? (
                  <p className="text-body-compact text-muted-foreground">
                    Showing {selection.from}–{selection.to}
                  </p>
                ) : null}
                <DocumentsPageSizeSelect
                  value={pageSize}
                  onChange={(size) => {
                    setPageSize(size);
                    resetPage();
                  }}
                />
              </div>
              {selection.pageCount > 1 ? (
                <Pagination className="mx-0 w-auto justify-start md:justify-end">
                  <PaginationContent>
                    {selection.page > 1 ? (
                      <PaginationItem>
                        <PaginationPrevious
                          {...pageLink(selection.page - 1)}
                        />
                      </PaginationItem>
                    ) : null}
                    {documentPageWindow(
                      selection.page,
                      selection.pageCount
                    ).map((entry, index) => (
                      <PaginationItem key={`${entry}-${index}`}>
                        {entry === "gap" ? (
                          <PaginationEllipsis />
                        ) : (
                          <PaginationLink
                            {...pageLink(entry)}
                            isActive={entry === selection.page}
                            aria-label={`Go to page ${entry}`}
                          >
                            {entry}
                          </PaginationLink>
                        )}
                      </PaginationItem>
                    ))}
                    {selection.page < selection.pageCount ? (
                      <PaginationItem>
                        <PaginationNext {...pageLink(selection.page + 1)} />
                      </PaginationItem>
                    ) : null}
                  </PaginationContent>
                </Pagination>
              ) : null}
            </div>
          </div>
        )}
      </DocumentsPanel>
      <DocumentRecordDialog
        file={file}
        peopleById={peopleById}
        document={recordOpen}
        onOpenChange={setRecordOpen}
      />
      <ApplicationRecordDialog
        caseId={record.id}
        record={record}
        application={openFiling}
        onOpenChange={(open) => {
          if (!open) setFilingOpen(null);
        }}
        onAct={(item) => {
          setFilingOpen(null);
          if (item.step === "sign") setSigning([item]);
          else act([item]);
        }}
        onReplaceFile={replaceFile}
      />
      <SignReviewDialog
        record={record}
        applications={reviewingNow}
        onOpenChange={(open) => {
          if (!open) setReviewing([]);
        }}
        onSign={(items) => {
          setReviewing([]);
          setSigning(items);
        }}
        onReplaceFile={replaceFile}
      />
      <SignAndPayDialogs
        caseId={record.id}
        items={filings}
        signing={signing}
        onSigningChange={setSigning}
        paying={paying}
        onPayingChange={setPaying}
        onBack={(batch) => {
          if (batch.length === 1) setFilingOpen(batch[0].id);
          else setReviewing(batch);
        }}
      />
    </>
  );
}

function matchingCountLabel(
  kind: DocumentKind,
  total: number,
  filtered: boolean
): string {
  const noun =
    kind === "bail-bonds"
      ? total === 1
        ? "bail bond"
        : "bail bonds"
      : total === 1
        ? "document"
        : "documents";
  if (!filtered) return `${total} ${noun}`;
  return total === 1
    ? `1 ${noun} matches the filters`
    : `${total} ${noun} match the filters`;
}

function emptyTitle(kind: DocumentKind, filtered: boolean): string {
  if (filtered) {
    return kind === "bail-bonds"
      ? "No bail bonds matching filters"
      : "No documents matching filters";
  }
  return kind === "bail-bonds"
    ? "No bail bonds recorded"
    : "No documents recorded";
}

function emptyDescription(kind: DocumentKind, filtered: boolean): string {
  if (filtered) {
    return kind === "bail-bonds"
      ? "No bail bonds match the selected filters."
      : "No documents match the selected filters.";
  }
  return kind === "bail-bonds"
    ? "Bail bonds recorded for this case will appear here."
    : "Use Make filings to submit documents.";
}

function uniqueSubmitters(
  documents: CaseDocument[],
  peopleById: Map<string, DocumentPerson>
): SubmitterOption[] {
  const seen = new Set<string>();
  const options: SubmitterOption[] = [];
  for (const document of documents) {
    if (seen.has(document.submittedById)) continue;
    seen.add(document.submittedById);
    const person = peopleById.get(document.submittedById);
    options.push({
      value: document.submittedById,
      label: person ? personIdentity(person) : document.submittedById,
      role: person?.role ?? "",
    });
  }
  return options.sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * One bounded documents region. Hover fill is cancelled — this panel is
 * not the action (Laws; same resting Card as Hearings).
 */
function DocumentsPanel({
  children,
  switcher,
  search,
  busy = false,
}: {
  children: ReactNode;
  switcher?: ReactNode;
  /** Filing-id search, seated at the switcher row's right corner. */
  search?: ReactNode;
  busy?: boolean;
}) {
  return (
    <section className="min-w-0" aria-busy={busy || undefined}>
      <Card className={cn(PANEL_CLASS, "gap-4 hover:bg-card")}>
        <CardHeader>
          <div className="flex flex-col gap-3">
            <h2 className="text-body font-semibold">Documents</h2>
            {search ? (
              <div className="flex flex-col gap-3 md:pointer-fine:flex-row md:pointer-fine:items-center md:pointer-fine:justify-between md:landscape:flex-row md:landscape:items-center md:landscape:justify-between">
                {switcher}
                {search}
              </div>
            ) : (
              switcher
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">{children}</CardContent>
      </Card>
    </section>
  );
}

function KindTabs({
  kind,
  documentsCount,
  bailBondsCount,
  onKindChange,
}: {
  kind: DocumentKind;
  documentsCount: number;
  bailBondsCount: number;
  onKindChange: (kind: DocumentKind) => void;
}) {
  return (
    <SegmentedControl
      type="single"
      size="compact"
      className={REGISTER_SWITCH}
      value={kind}
      onValueChange={(next) => {
        if (isDocumentKind(next)) onKindChange(next);
      }}
      aria-label="Document group"
    >
      {/* The count is part of the label, in plain muted text, rather than a
          badge inside a control. */}
      <SegmentedControlItem
        value="documents"
        aria-label={`Documents, ${documentsCount}`}
      >
        <span className="flex items-center gap-1.5">
          Documents
          <span className="font-normal tabular-nums text-muted-foreground">
            {documentsCount}
          </span>
        </span>
      </SegmentedControlItem>
      <SegmentedControlItem
        value="bail-bonds"
        aria-label={`Bail bonds, ${bailBondsCount}`}
      >
        <span className="flex items-center gap-1.5">
          Bail bonds
          <span className="font-normal tabular-nums text-muted-foreground">
            {bailBondsCount}
          </span>
        </span>
      </SegmentedControlItem>
    </SegmentedControl>
  );
}

function DocumentsPageSizeSelect({
  value,
  onChange,
}: {
  value: DocumentsPageSize;
  onChange: (pageSize: DocumentsPageSize) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label
        htmlFor="documents-page-size"
        className="text-body-compact font-normal text-muted-foreground"
      >
        Per page
      </Label>
      <Select
        value={String(value)}
        onValueChange={(next) => {
          const size = Number.parseInt(next, 10);
          if (isDocumentsPageSize(size)) onChange(size);
        }}
      >
        <SelectTrigger id="documents-page-size" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DOCUMENTS_PAGE_SIZES.map((size) => (
            <SelectItem key={size} value={String(size)}>
              {size}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function DocumentsTable({
  caption,
  rows,
  peopleById,
  onOpenRecord,
}: {
  caption: string;
  rows: CaseDocument[];
  peopleById: Map<string, DocumentPerson>;
  onOpenRecord: (document: CaseDocument) => void;
}) {
  return (
    <Table>
      <TableCaption className="sr-only">{caption}</TableCaption>
      <TableHeader>
        <TableRow className={TABLE_HEAD_ROW}>
          <TableHead className={cn(headClass, "min-w-56")}>Document</TableHead>
          <TableHead className={cn(headClass, "min-w-40")}>
            Document type
          </TableHead>
          <TableHead className={cn(headClass, "w-40")}>Submitted by</TableHead>
          <TableHead className={cn(headClass, "w-36")}>Submitted on</TableHead>
          <TableHead className={cn(headClass, "w-44")}>
            Submission status
          </TableHead>
          <TableHead className={cn(headClass, "w-36")}>Evidence</TableHead>
          <TableHead className={cn(headClass, "w-32")}>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className={tableBodyClass()}>
        {rows.map((document) => (
          <TableRow
            key={document.id}
            className={cn(tableRowClass(), "cursor-pointer")}
            onClick={() => onOpenRecord(document)}
          >
            <TableCell className={cn(cellClass, "min-w-0 whitespace-normal")}>
              <p className="font-medium text-foreground">{document.title}</p>
              {/* A step below the title, at a note's weight (owner, Oct 8:
                  the two lines ran together). */}
              <p className="mt-1 text-caption font-normal text-muted-foreground">
                {documentSourceLabel(document.source)}
                {/* The id the register's search matches — shown so a found
                    row identifies itself. A filing not yet submitted has
                    none. */}
                {document.filingId ? (
                  <>
                    <span aria-hidden> · </span>
                    <Identifier value={document.filingId} label="filing number" />
                  </>
                ) : null}
              </p>
            </TableCell>
            <TableCell className={cn(cellClass, "min-w-0 whitespace-normal")}>
              {documentTypeLabel(document.type)}
            </TableCell>
            <TableCell className={cn(cellClass, "min-w-0 whitespace-normal")}>
              <SubmittedByCell document={document} peopleById={peopleById} />
            </TableCell>
            <TableCell className={cn(cellClass, "whitespace-nowrap")}>
              <SubmittedOn document={document} />
            </TableCell>
            <TableCell className={cn(cellClass, "min-w-0 overflow-hidden")}>
              <Badge
                variant={documentStatusVariant(document.submissionStatus)}
                className="h-auto max-w-full min-h-6 whitespace-normal"
              >
                {documentStatusLabel(document.submissionStatus)}
              </Badge>
            </TableCell>
            <TableCell className={cn(cellClass, "whitespace-nowrap")}>
              <EvidenceValue document={document} />
            </TableCell>
            <TableCell className={cellClass}>
              {/* The row itself opens the record; the one column action is the
                  download. Icon-only with the label on hover/focus, per the
                  Aug 31 correction round (legacy's three-dot menu held only
                  Download). */}
              <DownloadFilingButton
                label={`Download filing: ${document.title}`}
                tooltip="Download filing"
                href={documentSrc(document)}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** The filing date, or, for a memo or affidavit the filer has yet to sign
 *  or pay for, that it has not gone in. */
function SubmittedOn({ document }: { document: CaseDocument }) {
  return documentNotSubmitted(document) ? (
    <span className="text-muted-foreground">Not submitted</span>
  ) : (
    <>{formatCaseDate(document.submittedOn)}</>
  );
}

function SubmittedByCell({
  document,
  peopleById,
}: {
  document: CaseDocument;
  peopleById: Map<string, DocumentPerson>;
}) {
  const side = submittedBySideLabel(document, peopleById);
  const advocate = displayName(submittedByName(document, peopleById));

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="justify-start px-2 text-body-compact"
          aria-label={`${side}, ${advocate}`}
        >
          {side}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{advocate}</TooltipContent>
    </Tooltip>
  );
}

/**
 * The title is the control; the card is only its hit area, covered via
 * `after:` the way case rows do it. Wrapping the whole card in a button
 * would flatten status, evidence, date and submitter into one label and
 * nest block elements inside a button. Focus lands on the title but the
 * ring is drawn on the card, so what is about to open is what is outlined.
 */
function DocumentsItemList({
  rows,
  peopleById,
  onOpenRecord,
}: {
  rows: CaseDocument[];
  peopleById: Map<string, DocumentPerson>;
  onOpenRecord: (document: CaseDocument) => void;
}) {
  const tray = useOneOpen<string>();
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((document) => (
        <li key={document.id}>
          <RegisterTrayCard
            title={document.title}
            open={tray.isOpen(document.id)}
            onOpenChange={tray.toggle(document.id)}
            actions={
              <Button type="button" onClick={() => onOpenRecord(document)}>
                View document
              </Button>
            }
          >
            <p className="-mt-2 text-caption text-muted-foreground">
              {/* Under the title's stretched hit area, so the face only. */}
              {document.filingId ? (
                <>
                  <Identifier value={document.filingId} label="filing number" copyable={false} />
                  <span aria-hidden> · </span>
                </>
              ) : null}
              {documentSourceLabel(document.source)}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={documentStatusVariant(document.submissionStatus)}>
                {documentStatusLabel(document.submissionStatus)}
              </Badge>
              {document.evidenceStatus ? <EvidenceValue document={document} /> : null}
            </div>
            {/* Under the hairline, the filing facts: type and date, then who. */}
            <div className="flex flex-col gap-0.5 border-t border-hairline pt-3">
              <p className="text-body-compact text-foreground">
                {documentTypeLabel(document.type)}
                <span className="text-muted-foreground">
                  <span aria-hidden> · </span>
                  <span className="tabular-nums">
                    <SubmittedOn document={document} />
                  </span>
                </span>
              </p>
              <p className="text-caption text-muted-foreground">
                {submittedBySideLabel(document, peopleById)}
                <span aria-hidden> · </span>
                {displayName(submittedByName(document, peopleById))}
              </p>
            </div>
          </RegisterTrayCard>
        </li>
      ))}
    </ul>
  );
}

function EvidenceValue({ document }: { document: CaseDocument }) {
  if (!document.evidenceStatus) {
    return <span className="text-muted-foreground">—</span>;
  }

  const label = evidenceStatusLabel(document.evidenceStatus);
  const evidenceNumber =
    document.evidenceStatus === "marked" ? document.evidenceNumber : null;

  return (
    <Badge
      variant={document.evidenceStatus === "marked" ? "secondary" : "outline"}
      aria-label={
        evidenceNumber ? `${label}, evidence number ${evidenceNumber}` : label
      }
    >
      {label}
      {evidenceNumber ? (
        <>
          <span aria-hidden>·</span>
          {/* The badge carries its own `aria-label`, so nothing inside it is
              announced and a control here would be unreachable by name. */}
          <Identifier value={evidenceNumber} label="evidence number" copyable={false} />
        </>
      ) : null}
    </Badge>
  );
}

function DocumentsEmpty({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof FileTextIcon;
  title: string;
  description?: string;
}) {
  return (
    <Empty className="border border-dashed border-border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon aria-hidden />
        </EmptyMedia>
        <EmptyTitle className="text-body font-semibold">{title}</EmptyTitle>
        {description ? (
          <EmptyDescription>{description}</EmptyDescription>
        ) : null}
      </EmptyHeader>
    </Empty>
  );
}
