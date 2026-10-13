"use client";

import { useState } from "react";
import { DownloadIcon, FileXIcon, XIcon } from "lucide-react";

import {
  Fact,
  FactGroup,
  Muted,
} from "@/components/cases/application-record-dialog";
import { PdfViewer, isPdfSrc, parsePdfSrc } from "@/components/cases/pdf-viewer";
import { FlowDialogContent } from "@/components/chrome/flow-dialog";
import { Identifier } from "@/components/chrome/identifier";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  documentSrc,
  documentSourceLabel,
  documentStatusLabel,
  documentStatusVariant,
  documentTypeLabel,
  evidenceStatusLabel,
  submittedByName,
  submittedByRole,
  type CaseDocument,
  type DocumentPerson,
  type DocumentsFile,
} from "@/lib/cases/documents";
import { displayName } from "@/lib/cases/names";
import { formatCaseDate } from "@/lib/cases/types";

/**
 * One filed document, in the application record's frame (owner, Oct 8: the
 * old dialog was oversized, put the document below the fold and gave
 * comments a third of the width). Header: title, status, download, close.
 * Left: the facts in skimmable groups, then comments. Right: the document,
 * as large as the dialog allows. Halves stack when the dialog is narrow.
 */
export function DocumentRecordDialog({
  file,
  peopleById,
  document,
  onOpenChange,
}: {
  file: DocumentsFile;
  peopleById: Map<string, DocumentPerson>;
  document: CaseDocument | null;
  onOpenChange: (document: CaseDocument | null) => void;
}) {
  /* What was open stays drawn while the dialog animates out. */
  const [shown, setShown] = useState(document);
  if (document && document !== shown) setShown(document);
  return (
    <Dialog
      open={document !== null}
      onOpenChange={(next) => {
        if (!next) onOpenChange(null);
      }}
    >
      <FlowDialogContent
        showCloseButton={false}
        className="flex h-[calc(100dvh---spacing(12))] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
      >
        {shown ? (
          <DocumentBody
            key={shown.id}
            file={file}
            document={shown}
            peopleById={peopleById}
          />
        ) : null}
      </FlowDialogContent>
    </Dialog>
  );
}

function DocumentBody({
  file,
  document,
  peopleById,
}: {
  file: DocumentsFile;
  document: CaseDocument;
  peopleById: Map<string, DocumentPerson>;
}) {
  const src = documentSrc(document);
  const pdf = src && isPdfSrc(src) ? parsePdfSrc(src) : null;
  const role = submittedByRole(document, peopleById);
  // Status-driven, not kind-driven: depositions and pleas reach Pending
  // review too.
  const pendingReview = document.submissionStatus === "pending-review";

  return (
    <>
      <div className="flex shrink-0 items-center gap-2 border-b border-hairline py-3 pr-3 pl-6">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <DialogTitle className="text-body-compact font-semibold text-pretty sm:truncate">
            {document.title}
          </DialogTitle>
          <Badge variant={documentStatusVariant(document.submissionStatus)}>
            {documentStatusLabel(document.submissionStatus)}
          </Badge>
          <DialogDescription className="sr-only">
            {documentTypeLabel(document.type)} filed on {file.caseNumber}
          </DialogDescription>
        </div>
        {src ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" asChild>
                  <a
                    href={pdf ? pdf.url : src}
                    download={downloadName(document) ?? true}
                    aria-label={
                      pendingReview
                        ? `Download ${document.title}, not yet signed by the magistrate`
                        : `Download ${document.title}`
                    }
                  >
                    <DownloadIcon aria-hidden />
                  </a>
                </Button>
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

      <div className="@container/record flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col @3xl/record:flex-row">
          <div className="flex max-h-72 shrink-0 flex-col overflow-y-auto border-b border-hairline p-4 @3xl/record:max-h-none @3xl/record:w-80 @3xl/record:border-r @3xl/record:border-b-0">
            <div className="flex flex-col divide-y divide-hairline">
              {pendingReview ? (
                <p className="pb-3 text-body-compact text-foreground">
                  Signed by the parties. Waiting for the magistrate to sign.
                </p>
              ) : null}

              <FactGroup>
                <Fact label="Filing ID">
                  {document.filingId ? (
                    /* Copyable like every other identifier here (owner,
                       Oct 8), and only as wide as itself. */
                    <span className="flex">
                      <Identifier value={document.filingId} label="filing ID" />
                    </span>
                  ) : (
                    <Muted>Allotted when submitted</Muted>
                  )}
                </Fact>
              </FactGroup>

              <FactGroup columns={2}>
                <Fact label="Document type">
                  {documentTypeLabel(document.type)}
                </Fact>
                <Fact label="Source">{documentSourceLabel(document.source)}</Fact>
                <Fact label="Submitted on">
                  <span className="tabular-nums">
                    {formatCaseDate(document.submittedOn)}
                  </span>
                </Fact>
                <Fact label="Submitted by">
                  <span className="flex flex-col gap-0.5">
                    <span>{displayName(submittedByName(document, peopleById))}</span>
                    {role ? (
                      <span className="text-caption font-normal text-muted-foreground">
                        {role}
                      </span>
                    ) : null}
                  </span>
                </Fact>
              </FactGroup>

              {document.evidenceNumber || document.evidenceStatus ? (
                <FactGroup columns={2}>
                  {document.evidenceNumber ? (
                    <Fact label="Evidence no.">
                      <span className="font-mono">{document.evidenceNumber}</span>
                    </Fact>
                  ) : null}
                  {document.evidenceStatus ? (
                    <Fact label="Evidence status">
                      {evidenceStatusLabel(document.evidenceStatus)}
                    </Fact>
                  ) : null}
                </FactGroup>
              ) : null}

              {document.linkedApplication || document.linkedHearing ? (
                <FactGroup>
                  {document.linkedApplication ? (
                    <Fact label="Filed with">
                      <span className="flex flex-col items-start gap-0.5">
                        <Identifier
                          value={document.linkedApplication.id}
                          label="application id"
                        />
                        <span className="text-caption font-normal text-muted-foreground">
                          {document.linkedApplication.label}
                        </span>
                      </span>
                    </Fact>
                  ) : null}
                  {document.linkedHearing ? (
                    <Fact label="Hearing">
                      <span className="flex flex-col items-start gap-0.5">
                        <Identifier
                          value={document.linkedHearing.id}
                          label="hearing id"
                        />
                        <span className="text-caption font-normal text-muted-foreground">
                          {document.linkedHearing.label}
                        </span>
                      </span>
                    </Fact>
                  ) : null}
                </FactGroup>
              ) : null}
            </div>

            <Comments fieldId={`document-comment-${document.id}`} />
          </div>

          {pdf ? (
            <PdfViewer
              key={src}
              src={pdf.url}
              title={document.title}
              pages={pdf.page ? { from: pdf.page, to: pdf.page } : undefined}
              className="min-h-64 flex-1 rounded-none"
            />
          ) : (
            <div className="flex min-h-64 flex-1 items-center justify-center bg-surface-sunken p-6">
              <Empty className="flex-none">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FileXIcon aria-hidden />
                  </EmptyMedia>
                  <EmptyTitle className="text-body font-semibold">
                    No file attached
                  </EmptyTitle>
                  <EmptyDescription>
                    This record has no file on it yet.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * Comments on this one file, kept in the dialog and never filed. A section
 * of the facts panel, below the facts, rather than a pane of its own: the
 * document keeps the width.
 */
function Comments({ fieldId }: { fieldId: string }) {
  const [comments, setComments] = useState<{ id: string; body: string }[]>([]);
  const [draft, setDraft] = useState("");
  const scopeId = `${fieldId}-scope`;

  function post() {
    const body = draft.trim();
    if (!body) return;
    setComments((current) => [...current, { id: crypto.randomUUID(), body }]);
    setDraft("");
  }

  return (
    <section className="flex flex-col gap-2 border-t border-hairline pt-3">
      {/* The visible heading is the field's label: never placeholder-only. */}
      <div className="flex flex-col gap-0.5">
        {/* A section of its own, not one more fact: titled in the ink and
            weight of a heading, not a fact's muted label (owner, Oct 8). */}
        <FieldLabel
          htmlFor={fieldId}
          className="text-body-compact font-semibold text-foreground"
        >
          Comments
        </FieldLabel>
        <p id={scopeId} className="text-caption text-muted-foreground">
          On this file only. Not a filing.
        </p>
      </div>
      {comments.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {comments.map((comment) => (
            <li
              key={comment.id}
              className="rounded-lg bg-surface-sunken px-3 py-2 text-body-compact whitespace-pre-wrap text-foreground"
            >
              {comment.body}
            </li>
          ))}
        </ul>
      ) : null}
      <Field>
        <Textarea
          id={fieldId}
          placeholder="Write a comment"
          rows={2}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          aria-describedby={scopeId}
        />
      </Field>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-end"
        disabled={!draft.trim()}
        onClick={post}
      >
        Post
      </Button>
    </section>
  );
}

/**
 * A Pending review filing carries the parties' signatures but not the
 * magistrate's, so it is not yet operative. Once the file is on disk every
 * piece of dialog UI is gone; the filename is the only carrier left, so it
 * states the caveat. Other statuses keep the source filename.
 */
function downloadName(document: CaseDocument): string | undefined {
  if (document.submissionStatus !== "pending-review" || !document.href) {
    return undefined;
  }
  const segment = document.href.split("/").pop() ?? "";
  const dot = segment.lastIndexOf(".");
  const extension = dot > 0 ? segment.slice(dot) : "";
  return `${document.id}-unsigned-by-court${extension}`;
}
