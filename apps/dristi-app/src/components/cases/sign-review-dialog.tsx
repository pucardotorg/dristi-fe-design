"use client";

import { useMemo, useState } from "react";
import { FileTextIcon, FileXIcon, XIcon } from "lucide-react";

import { composedApplication } from "@/components/cases/application-record-dialog";
import { GeneratedApplicationDocument } from "@/components/cases/generated-application-dialog";
import {
  ComposedDocumentViewer,
  PdfViewer,
  isImageSrc,
  isPdfSrc,
  parsePdfSrc,
} from "@/components/cases/pdf-viewer";
import { ReplaceFileButton } from "@/components/cases/uploaded-doc-field";
import { FlowDialogContent } from "@/components/chrome/flow-dialog";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  filingNoun,
  type ApplicationRecord,
} from "@/lib/cases/application-record";
import type { CaseRecord } from "@/lib/cases/types";
import { cn } from "@/lib/utils";

/**
 * Sign all, read first (owner, Oct 8): before one signature covers several
 * applications, each can be read, and changed if something is wrong. The
 * record dialog's frame: the list where the record's facts sit, the chosen
 * application in the same viewer, the step in the same sunken footer band.
 */
export function SignReviewDialog({
  record,
  applications,
  onOpenChange,
  onSign,
  onEdit,
  onReplaceFile,
}: {
  record: CaseRecord;
  /** Empty when closed. */
  applications: ApplicationRecord[];
  onOpenChange: (open: boolean) => void;
  onSign: (applications: ApplicationRecord[]) => void;
  onEdit?: (application: ApplicationRecord) => void;
  /** For memos and affidavits, which have a file rather than a form. */
  onReplaceFile?: (application: ApplicationRecord, file: File) => void;
}) {
  /* What was open stays drawn while the dialog animates out; emptied, it
     flashed a blank panel. */
  const [shown, setShown] = useState(applications);
  if (applications.length > 0 && applications !== shown) setShown(applications);
  return (
    <Dialog open={applications.length > 0} onOpenChange={onOpenChange}>
      <FlowDialogContent
        showCloseButton={false}
        className="flex h-[calc(100dvh---spacing(12))] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
      >
        {shown.length > 0 ? (
          <ReviewBody
            key={shown.map((item) => item.id).join()}
            record={record}
            applications={shown}
            onSign={onSign}
            onEdit={onEdit}
            onReplaceFile={onReplaceFile}
          />
        ) : null}
      </FlowDialogContent>
    </Dialog>
  );
}

function ReviewBody({
  record,
  applications,
  onSign,
  onEdit,
  onReplaceFile,
}: {
  record: CaseRecord;
  applications: ApplicationRecord[];
  onSign: (applications: ApplicationRecord[]) => void;
  onEdit?: (application: ApplicationRecord) => void;
  onReplaceFile?: (application: ApplicationRecord, file: File) => void;
}) {
  const count = applications.length;
  const [openId, setOpenId] = useState(applications[0].id);
  const open =
    applications.find((item) => item.id === openId) ?? applications[0];
  const composed = useMemo(
    () => composedApplication(open, record),
    [open, record]
  );
  /* A document (an affidavit, a memo) has no page set out from its details:
     its own file shows, as in its record. Nor has it a form to reopen. */
  const file = composed
    ? undefined
    : open.documents.find(
        (doc) => doc.src && (isPdfSrc(doc.src) || isImageSrc(doc.src))
      );
  const pdf = file?.src && isPdfSrc(file.src) ? parsePdfSrc(file.src) : null;
  const image = file?.src && !pdf ? parsePdfSrc(file.src).url : null;
  const editable = open.source.kind === "application" && onEdit;
  const replaceable = open.source.kind === "document" && onReplaceFile;

  return (
    <>
      <div className="flex shrink-0 items-center gap-2 border-b border-hairline py-3 pr-3 pl-6">
        <div className="min-w-0 flex-1">
          <DialogTitle className="text-body-compact font-semibold text-pretty sm:truncate">
            Sign {count} {filingNoun(applications)}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Read each one, then sign them together.
          </DialogDescription>
        </div>
        <DialogClose asChild>
          <Button type="button" variant="ghost" size="icon-sm">
            <XIcon aria-hidden />
            <span className="sr-only">Close</span>
          </Button>
        </DialogClose>
      </div>

      {/* Side by side only when the dialog is wide enough, as the record. */}
      <div className="@container/review flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col @3xl/review:flex-row">
          <div className="flex max-h-72 shrink-0 flex-col gap-1.5 overflow-y-auto border-b border-hairline p-4 @3xl/review:max-h-none @3xl/review:w-80 @3xl/review:border-r @3xl/review:border-b-0">
            <h3 className="text-caption font-medium text-muted-foreground">
              {filingNoun(applications) === "documents" ? "Documents" : "Applications"}
            </h3>
            <ul className="-mx-2 flex flex-col gap-0.5">
              {applications.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={item.id === open.id}
                    onClick={() => setOpenId(item.id)}
                    className={cn(
                      "flex min-h-10 w-full items-start gap-2 rounded-lg px-2 py-2 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50",
                      item.id === open.id && "bg-accent-strong"
                    )}
                  >
                    <FileTextIcon
                      aria-hidden
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span
                        className={cn(
                          "text-body-compact text-foreground",
                          item.id === open.id && "font-medium"
                        )}
                      >
                        {item.name}
                      </span>
                      <span className="text-caption text-muted-foreground tabular-nums">
                        Created {item.createdShort}
                        {item.draftedBy ? ` · Drafted by ${item.draftedBy}` : null}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {composed ? (
            <ComposedDocumentViewer
              key={open.id}
              title={composed.document.title}
              className="min-h-64 min-w-0 flex-1 rounded-none"
            >
              <GeneratedApplicationDocument
                document={composed.document}
                generatedOn={composed.dated}
                signedBy={composed.signedBy}
              />
            </ComposedDocumentViewer>
          ) : image && file ? (
            <ComposedDocumentViewer
              key={file.src}
              title={file.label}
              className="min-h-64 min-w-0 flex-1 rounded-none"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- a local file's object URL */}
              <img src={image} alt={file.label} className="block w-full" />
            </ComposedDocumentViewer>
          ) : pdf && file ? (
            <PdfViewer
              key={file.src}
              src={pdf.url}
              title={file.label}
              pages={pdf.page ? { from: pdf.page, to: pdf.page } : undefined}
              className="min-h-64 flex-1 rounded-none"
            />
          ) : (
            /* The record's own designed gap for a missing file. */
            <div className="flex min-h-64 flex-1 items-center justify-center bg-surface-sunken p-6">
              <Empty className="flex-none">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FileXIcon aria-hidden />
                  </EmptyMedia>
                  <EmptyTitle className="text-body font-semibold">
                    {open.documents.length === 0
                      ? "Nothing to show for this one"
                      : "Its documents are not on file yet"}
                  </EmptyTitle>
                  <EmptyDescription>
                    {open.documents.length === 0
                      ? "No file is attached to it."
                      : "They open here once the files are uploaded."}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          )}
        </div>
      </div>

      {/* Only the actions: "Sign all 3" already says one signature covers
          them, and Edit says itself (owner, Oct 8: no restating copy). */}
      <footer className="flex shrink-0 flex-col border-t border-hairline bg-surface-sunken px-6 py-4 sm:flex-row sm:justify-end">
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          {editable ? (
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => onEdit(open)}
            >
              Edit<span className="sr-only"> {open.name}</span>
            </Button>
          ) : replaceable ? (
            <ReplaceFileButton
              className="w-full sm:w-auto"
              onFile={(picked) => onReplaceFile(open, picked)}
            />
          ) : null}
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={() => onSign(applications)}
          >
            Sign all {count}
          </Button>
        </div>
      </footer>
    </>
  );
}
