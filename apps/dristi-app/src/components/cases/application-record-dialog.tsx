"use client";

import { useMemo, useState, type ReactNode } from "react";
import { CaseLink as Link } from "@/components/cases/case-reader";
import { DownloadIcon, FileTextIcon, FileXIcon, XIcon } from "lucide-react";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

import {
  ComposedDocumentViewer,
  PdfViewer,
  isImageSrc,
  isPdfSrc,
  parsePdfSrc,
} from "@/components/cases/pdf-viewer";
import { ReplaceFileButton } from "@/components/cases/uploaded-doc-field";
import { FlowDialogContent } from "@/components/chrome/flow-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  applicationSideLabel,
  type ApplicationRecord,
  type LinkedApplication,
} from "@/lib/cases/application-record";
import { orderHref } from "@/lib/cases/sections";
import {
  isSubmittedToCourt,
  objectionHref,
  othersTitle,
  resumeDraftHref,
} from "@/lib/cases/applications";
import { GeneratedApplicationDocument } from "@/components/cases/generated-application-dialog";
import {
  buildGeneratedApplication,
  downloadApplicationText,
} from "@/lib/cases/application-document";
import { applicationDraftFrom } from "@/lib/cases/application-draft";
import type { CaseRecord } from "@/lib/cases/types";
import { cn } from "@/lib/utils";

/**
 * Opening an application shows the application, its documents and the linked
 * order (APP-07). The record on the left is exactly §9.4; the document the
 * reader picked shows on the right.
 */
export function ApplicationRecordDialog({
  caseId,
  record,
  application,
  onOpenChange,
  onOpenLinked,
  onAct,
  onEdit,
  onReplaceFile,
  onObject,
}: {
  caseId: string;
  /** The case, to set the application out as the court would read it. */
  record: CaseRecord;
  application: ApplicationRecord | null;
  onOpenChange: (open: boolean) => void;
  /** Open another application in this dialog: an objection and what it objects to. */
  onOpenLinked?: (id: string) => void;
  /** Take the viewer's step on it (continue, sign, pay) from the record itself. */
  onAct?: (application: ApplicationRecord) => void;
  /** Reopen it in its form before signing: the signer reads it here first. */
  onEdit?: (application: ApplicationRecord) => void;
  /** A memo or affidavit has no form: before signing, its file is swapped. */
  onReplaceFile?: (application: ApplicationRecord, file: File) => void;
  /** File an objection to it, over the page the record was opened on. */
  onObject?: (applicationId: string) => void;
}) {
  /* What was open stays drawn while the dialog animates out (to a signing
     or payment step, or closed); emptied, it flashed a blank panel. */
  const [shown, setShown] = useState(application);
  if (application && application !== shown) setShown(application);
  return (
    <Dialog open={application !== null} onOpenChange={onOpenChange}>
      <FlowDialogContent
        outsideCloses
        showCloseButton={false}
        className="flex h-[calc(100dvh---spacing(12))] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
      >
        {shown ? (
          <RecordBody
            /* A replaced file is a new record to read: start on it. */
            key={`${shown.id}${shown.documents[0]?.src ?? ""}`}
            caseId={caseId}
            record={record}
            application={shown}
            onOpenLinked={onOpenLinked}
            onAct={onAct}
            onEdit={onEdit}
            onReplaceFile={onReplaceFile}
            onObject={onObject}
          />
        ) : null}
      </FlowDialogContent>
    </Dialog>
  );
}

function RecordBody({
  caseId,
  record,
  application,
  onOpenLinked,
  onAct,
  onEdit,
  onReplaceFile,
  onObject,
}: {
  caseId: string;
  record: CaseRecord;
  application: ApplicationRecord;
  onOpenLinked?: (id: string) => void;
  onAct?: (application: ApplicationRecord) => void;
  onEdit?: (application: ApplicationRecord) => void;
  onReplaceFile?: (application: ApplicationRecord, file: File) => void;
  onObject?: (applicationId: string) => void;
}) {
  /* An application draft reopens over this page (onAct); only a document
     draft still has its own page to go to. */
  const draftHref =
    application.source.kind === "application" && onAct
      ? null
      : resumeDraftHref(caseId, application.source);
  const viewable = application.documents.filter((doc) => doc.src);
  /* The application itself, set out from its details when its file is not
     on record (the demo has few): the page the filer saw before signing.
     The other side sees it only once the court has taken it up (ALC-17),
     which is when this record first reaches them. */
  const composed = useMemo(
    () => composedApplication(application, record),
    [application, record]
  );
  const [openSrc, setOpenSrc] = useState(
    viewable[0]?.src ?? (composed ? COMPOSED : undefined)
  );
  const showingComposed = openSrc === COMPOSED && composed !== null;
  const documents =
    composed && application.documents.length === 0
      ? [{ label: composed.label }]
      : application.documents;
  /* A replaced file comes in under a new src: show it, not the old one. */
  const open = viewable.find((doc) => doc.src === openSrc) ?? viewable[0];
  const pdf = open?.src && isPdfSrc(open.src) ? parsePdfSrc(open.src) : null;
  const image =
    open?.src && !pdf && isImageSrc(open.src) ? parsePdfSrc(open.src).url : null;

  return (
    <>
      <div className="flex shrink-0 items-center gap-2 border-b border-hairline py-3 pr-3 pl-6">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <DialogTitle className="text-body-compact font-semibold text-pretty sm:truncate">
            {application.name}
          </DialogTitle>
          <Badge variant={application.statusVariant}>
            {application.statusLabel}
          </Badge>
          <DialogDescription className="sr-only">
            Application record, documents and linked order
          </DialogDescription>
        </div>
        {/* Download whenever a document is open: a filed PDF, or the
            application set out from its details, which downloads the same
            text copy the form's preview gives (owner, Sept 24). */}
        {pdf || showingComposed ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                {pdf ? (
                  <Button variant="ghost" size="icon-sm" asChild>
                    <a href={pdf.url} download aria-label="Download">
                      <DownloadIcon aria-hidden />
                    </a>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Download"
                    onClick={() =>
                      composed &&
                      downloadApplicationText(composed.document, record)
                    }
                  >
                    <DownloadIcon aria-hidden />
                  </Button>
                )}
              </TooltipTrigger>
              <TooltipContent side="bottom">Download</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
        <DialogClose asChild>
          <Button type="button" variant="ghost" size="icon-sm">
            <XIcon aria-hidden />
            <span className="sr-only">Close</span>
          </Button>
        </DialogClose>
      </div>

      {/* Side by side only when the dialog itself is wide enough. Keyed to
          the screen, a tablet (the rail open beside the dialog) set the
          application out in a strip about 180px wide and cut it off. */}
      <div className="@container/record flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col @3xl/record:flex-row">
        <div className="flex max-h-72 shrink-0 flex-col gap-0 overflow-y-auto border-b border-hairline p-4 @3xl/record:max-h-none @3xl/record:w-80 @3xl/record:border-r @3xl/record:border-b-0">
          {/* Grouped so the panel can be skimmed (owner, Sept 24): what is
              happening first, then numbers, dates, people, objections and the
              order, each group parted by a hairline. Dates and people run two
              to a row; they are short. */}
          <div className="flex flex-col divide-y divide-hairline">
            {courtLine(application) ? (
              <p className="pb-3 text-body-compact text-foreground">
                {courtLine(application)}
                {isDecided(application.status) && application.linkedOrder ? (
                  <>
                    <span aria-hidden className="text-muted-foreground">
                      {" · "}
                    </span>
                    <Button variant="link" asChild className="h-auto px-0">
                      <Link
                        href={orderHref(caseId, application.linkedOrder.id)}
                      >
                        View order
                      </Link>
                    </Button>
                  </>
                ) : null}
              </p>
            ) : null}

            {hasNumberFacts(application) ? (
            <FactGroup>
              {application.source.kind === "document" ||
              application.source.type === "objection" ? null : (
                <Fact label="Application number">
                  {application.applicationNumber ? (
                    <span className="font-mono">
                      {application.applicationNumber}
                    </span>
                  ) : (
                    <Muted>
                      {application.status === "dismissed"
                        ? "Not allotted. Dismissed before the court took it up"
                        : "Allotted when the court takes it up"}
                    </Muted>
                  )}
                </Fact>
              )}
              {application.temporaryId ? (
                /* One name for it at every status, marked the way forms mark
                   "(optional)": it stands in until the court's number, and is
                   never cited in an order (owner, Sept 24). */
                <Fact
                  label={
                    <>
                      Filing ID{" "}
                      <span className="font-normal">(temporary)</span>
                    </>
                  }
                >
                  <span className="font-mono">{application.temporaryId}</span>
                </Fact>
              ) : null}
            </FactGroup>
            ) : null}

            <FactGroup columns={2}>
              <Fact label="Created on">
                <span className="tabular-nums">{application.createdShort}</span>
              </Fact>
              <Fact label="Submitted on">
                {application.submittedShort ? (
                  <span className="tabular-nums">
                    {application.submittedShort}
                  </span>
                ) : (
                  <Muted>Not yet</Muted>
                )}
              </Fact>
              {application.onboardedShort ? (
                <Fact label="Taken up on">
                  <span className="tabular-nums">
                    {application.onboardedShort}
                  </span>
                </Fact>
              ) : null}
              {application.expiresShort ? (
                <Fact label="Expires on">
                  <span className="tabular-nums">
                    {application.expiresShort}
                  </span>
                </Fact>
              ) : null}
              {application.decisionShort &&
              application.status === "pending-decision" ? (
                <Fact label="Decision on">
                  <span className="tabular-nums">
                    {application.decisionShort}
                  </span>
                </Fact>
              ) : null}
            </FactGroup>

            <FactGroup columns={2}>
              <Fact label="Raised by">{application.filedBy}</Fact>
              <Fact label="Side">{applicationSideLabel(application.side)}</Fact>
              {application.onBehalfOf ? (
                <Fact label="On behalf of">{application.onBehalfOf}</Fact>
              ) : null}
              {application.draftedBy ? (
                <Fact label="Drafted by">{application.draftedBy}</Fact>
              ) : null}
            </FactGroup>

            {application.objectionsInvited !== undefined ||
            application.objection ||
            application.objectionTo ? (
              <FactGroup>
                {application.objectionsInvited !== undefined ? (
                  <Fact label="Objections">
                    <span className="font-normal tabular-nums">
                      {application.objectionsInvited
                        ? application.objectionDue
                          ? `Invited. Due by the end of ${application.objectionDue}`
                          : "Invited"
                        : "Not invited"}
                    </span>
                  </Fact>
                ) : null}
                {application.objection ? (
                  <Fact label="Objection filed">
                    <LinkedRecord
                      linked={application.objection}
                      onOpen={onOpenLinked}
                    />
                  </Fact>
                ) : null}
                {application.objectionTo ? (
                  <Fact label="Objection to">
                    <LinkedRecord
                      linked={application.objectionTo}
                      onOpen={onOpenLinked}
                    />
                  </Fact>
                ) : null}
              </FactGroup>
            ) : null}

            <FactGroup>
              <Fact label="Linked order">
                {application.linkedOrder ? (
                  <Button
                    variant="link"
                    asChild
                    className="h-auto justify-start px-0 text-left whitespace-normal"
                  >
                    <Link href={orderHref(caseId, application.linkedOrder.id)}>
                      {application.linkedOrder.label}
                    </Link>
                  </Button>
                ) : (
                  <Muted>
                    {isDecided(application.status)
                      ? "Order not on file yet"
                      : "No order yet"}
                  </Muted>
                )}
              </Fact>
            </FactGroup>
          </div>

          <div className="flex flex-col gap-1.5 border-t border-hairline pt-3">
            <h3 className="text-caption font-medium text-muted-foreground">
              Documents
            </h3>
            {documents.length === 0 ? (
              <Muted>None attached</Muted>
            ) : (
              <ul className="-mx-2 flex flex-col gap-0.5">
                {documents.map((doc, index) => {
                  /* The application is always listed first; with no file of
                     its own, it opens set out from its details. */
                  const key =
                    "src" in doc && doc.src
                      ? doc.src
                      : index === 0 && composed
                        ? COMPOSED
                        : undefined;
                  return (
                  <li key={doc.label}>
                    {key ? (
                      <button
                        type="button"
                        aria-pressed={key === openSrc}
                        onClick={() => setOpenSrc(key)}
                        className={cn(
                          "flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-body-compact outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50",
                          key === openSrc && "bg-accent-strong font-medium"
                        )}
                      >
                        <FileTextIcon
                          aria-hidden
                          className="size-4 shrink-0 text-muted-foreground"
                        />
                        <span className="min-w-0">{doc.label}</span>
                      </button>
                    ) : (
                      <span className="flex min-h-10 items-center gap-2 px-2 text-body-compact text-muted-foreground">
                        <FileTextIcon aria-hidden className="size-4 shrink-0" />
                        <span className="min-w-0">{doc.label}</span>
                        <span className="ml-auto shrink-0 text-caption font-medium">
                          Not on file
                        </span>
                      </span>
                    )}
                  </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {showingComposed && composed ? (
          /* The PDF viewer's own frame (same well, margin, scrolling and
             zoom), with the download in the header as for a PDF (owner,
             Sept 24: one preview pattern). */
          <ComposedDocumentViewer
            key={application.id}
            title={composed.document.title}
            className="min-h-64 min-w-0 flex-1 rounded-none"
          >
            <GeneratedApplicationDocument
              document={composed.document}
              generatedOn={composed.dated}
              signedBy={composed.signedBy}
            />
          </ComposedDocumentViewer>
        ) : image && open ? (
          <ComposedDocumentViewer
            key={open.src}
            title={open.label}
            className="min-h-64 min-w-0 flex-1 rounded-none"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- a local file's object URL */}
            <img src={image} alt={open.label} className="block w-full" />
          </ComposedDocumentViewer>
        ) : pdf && open ? (
          <PdfViewer
            key={open.src}
            src={pdf.url}
            title={open.label}
            pages={pdf.page ? { from: pdf.page, to: pdf.page } : undefined}
            className="min-h-64 flex-1 rounded-none"
          />
        ) : (
          /* The same designed gap the order record shows when its PDF is
             missing: the pane says what is absent and whether the reader has
             anything to do, instead of a stray line of grey text. */
          <div className="flex min-h-64 flex-1 items-center justify-center bg-surface-sunken p-6">
            <Empty className="flex-none">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileXIcon aria-hidden />
                </EmptyMedia>
                <EmptyTitle className="text-body font-semibold">
                  {application.documents.length === 0
                    ? "No documents with this application"
                    : "These documents are not on file yet"}
                </EmptyTitle>
                <EmptyDescription>
                  {application.documents.length === 0
                    ? "Nothing is attached to it. The details of the application are alongside."
                    : "They are listed alongside, and open here once the files are uploaded."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        )}
      </div>
      </div>

      {/* The viewer's step, where they have one: read it, then act on it, in the
          filing dialogs' own footer band, primary at the far end (owner, Sept
          24). The table only opens; Needs attention stays the shortcut. */}
      {/* The other side's application the viewer may object to: the File
          objection task, from the record it is about. */}
      {!application.step && application.objectionInvite ? (
        <footer className="flex shrink-0 flex-col gap-3 border-t border-hairline bg-surface-sunken px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-body-compact text-muted-foreground tabular-nums">
            {application.objectionInvite.canFile
              ? "You can object to this until the end of"
              : "Your advocate can object to this until the end of"}{" "}
            {application.objectionInvite.due}.
          </p>
          {application.objectionInvite.canFile ? (
            onObject ? (
              <Button
                type="button"
                className="w-full sm:w-auto"
                onClick={() => onObject(application.id)}
              >
                File objection
              </Button>
            ) : (
              <Button asChild className="w-full sm:w-auto">
                <Link href={objectionHref(caseId, application.id)}>
                  File objection
                </Link>
              </Button>
            )
          ) : null}
        </footer>
      ) : null}
      {/* Only the step: the badge and the button say what it is, so no line
          restates it (owner, Oct 8). */}
      {application.step ? (
        <footer className="flex shrink-0 flex-col border-t border-hairline bg-surface-sunken px-6 py-4 sm:flex-row sm:justify-end">
          {application.step === "continue" && draftHref ? (
            <Button asChild className="w-full sm:w-auto">
              <Link href={draftHref}>Continue draft</Link>
            </Button>
          ) : application.step === "sign" &&
            application.source.kind === "document" &&
            onAct &&
            onReplaceFile ? (
            /* A memo or affidavit is its file: read it, swap it if it is the
               wrong one, then sign (owner, Oct 8). */
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <ReplaceFileButton
                className="w-full sm:w-auto"
                onFile={(file) => onReplaceFile(application, file)}
              />
              <Button
                type="button"
                className="w-full sm:w-auto"
                onClick={() => onAct(application)}
              >
                Add signature
              </Button>
            </div>
          ) : application.step === "sign" &&
            application.source.kind === "application" &&
            onAct &&
            onEdit ? (
            /* What is signed is read first, here, and can still be changed:
               a clerk's hand-off is ready, not locked (owner, Oct 8). Stacked
               on a phone with the signature on top, as the form's footer. */
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => onEdit(application)}
              >
                Edit
              </Button>
              <Button
                type="button"
                className="w-full sm:w-auto"
                onClick={() => onAct(application)}
              >
                Add signature
              </Button>
            </div>
          ) : onAct ? (
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={() => onAct(application)}
            >
              {application.step === "continue"
                ? "Continue draft"
                : application.step === "sign"
                  ? "Add signature"
                  : "Complete payment"}
            </Button>
          ) : null}
        </footer>
      ) : null}
    </>
  );
}

/** The composed application's place in the documents list. */
const COMPOSED = "composed-application";

/**
 * The application as the court reads it, set out from its details: the same
 * page the Raise application form generates before signing. Signed from
 * Pending payment on, by the advocate or party in person who raised it.
 * Null for a document submission (affidavit, memo), which has no such page.
 */
export function composedApplication(
  application: ApplicationRecord,
  record: CaseRecord
) {
  const { source } = application;
  if (source.kind !== "application") return null;
  const side = application.side === "court" ? "" : application.side;
  /* The title as filed. Reading a draft back leaves out a title the form's
     rule would reject ("PW-1"); a filed page shows what was filed. */
  const title = othersTitle(source);
  const document = buildGeneratedApplication(
    {
      ...applicationDraftFrom(source),
      filedForSide: side,
      ...(title ? { title } : {}),
    },
    record
  );
  if (!document) return null;
  const objection = source.type === "objection";
  const filed = isSubmittedToCourt(source.status);
  const signed = filed || source.status === "pending-payment";
  return {
    document,
    label: `${filed ? "Filed" : "Draft"} ${objection ? "objection" : "application"}`,
    dated: application.submitted ?? application.created,
    signedBy: signed ? application.filedBy : undefined,
  };
}

/** An objection or a document has no application number; unfiled, no ID either. */
function hasNumberFacts(application: ApplicationRecord): boolean {
  const numbered = !(
    application.source.kind === "document" ||
    application.source.type === "objection"
  );
  return numbered || Boolean(application.temporaryId);
}

function isDecided(status: ApplicationRecord["status"]): boolean {
  return status === "accepted" || status === "rejected" || status === "dismissed";
}

/**
 * Where the application stands with the court, in the reader's words. The
 * badge says the status; this says what it means and what comes next.
 */
function courtLine(application: ApplicationRecord): string | undefined {
  switch (application.status) {
    case "pending-review":
      return "Waiting for the court to take it up.";
    case "pending-decision":
      return application.decision
        ? `The court decides it on ${application.decision}.`
        : "Waiting for the court's decision.";
    /* Only the order says why (owner, Sept 24). The demo used to print a
       made-up gist of it here, which read as the court's reasons. */
    case "accepted":
    case "rejected":
    case "dismissed":
      return application.decision
        ? `By order of ${application.decision}`
        : "By order of the court";
    case "submitted":
      return application.objectionTo
        ? "Read with the application it objects to."
        : undefined;
    case "expired":
      return "Expired before it was submitted.";
    default:
      return undefined;
  }
}

/** Another application, one press away: its type, number and status. */
function LinkedRecord({
  linked,
  onOpen,
}: {
  linked: LinkedApplication;
  onOpen?: (id: string) => void;
}) {
  const label = linked.number
    ? `${linked.typeLabel} · ${linked.number}`
    : linked.typeLabel;
  return (
    <span className="flex flex-col items-start gap-1">
      {onOpen ? (
        <Button
          type="button"
          variant="link"
          className="h-auto justify-start px-0 text-left whitespace-normal"
          onClick={() => onOpen(linked.id)}
        >
          {label}
        </Button>
      ) : (
        <span>{label}</span>
      )}
      <Badge variant={linked.statusVariant}>{linked.statusLabel}</Badge>
    </span>
  );
}

/** One skimmable group of facts; the wrapper's hairline parts it from the next. */
export function FactGroup({
  columns = 1,
  children,
}: {
  columns?: 1 | 2;
  children: ReactNode;
}) {
  return (
    <dl
      className={cn(
        "grid gap-x-4 gap-y-3 py-3 first:pt-0",
        columns === 2 && "grid-cols-2"
      )}
    >
      {children}
    </dl>
  );
}

export function Fact({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-caption font-medium text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0 text-body-compact font-medium text-foreground">
        {children}
      </dd>
    </div>
  );
}

export function Muted({ children }: { children: ReactNode }) {
  return (
    <span className="text-body-compact font-normal text-muted-foreground">
      {children}
    </span>
  );
}
