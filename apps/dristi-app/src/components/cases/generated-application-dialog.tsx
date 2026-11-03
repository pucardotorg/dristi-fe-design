"use client";

import { Fragment, useMemo } from "react";
import { DownloadIcon, XIcon } from "lucide-react";

import {
  Fact,
  FactGroup,
} from "@/components/cases/application-record-dialog";
import { ReviewRow } from "@/components/cases/filing-form-shared";
import { RichTextValueView } from "@/components/cases/rich-text-field";
import { ComposedDocumentViewer } from "@/components/cases/pdf-viewer";
import { FlowDialogContent } from "@/components/chrome/flow-dialog";
import { Identifier } from "@/components/chrome/identifier";
import { Button } from "@/components/ui/button";
import { DescriptionList } from "@/components/ui/description-list";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  buildGeneratedApplication,
  datedThis,
  downloadGeneratedApplication,
  type GeneratedApplication,
} from "@/lib/cases/application-document";
import { type ApplicationDraft } from "@/lib/cases/application-draft";
import { submissionTypeLabel } from "@/lib/cases/applications";
import { formatCaseDate, type CaseRecord } from "@/lib/cases/types";
import { useCourtLocalized } from "@/components/court/court-provider";

/**
 * What Generate application produces, read before signing. The application
 * record's frame (PM and owner, Oct 8: the same pattern as opening an
 * application from the tab): the facts on the left, the application itself
 * as large as the dialog allows on the right, the one step in the sunken
 * footer band. Halves stack when the dialog is narrow.
 *
 * One CTA only: Add signature. The dialog's close returns to the form.
 */
export function GeneratedApplicationDialog({
  open,
  onOpenChange,
  draft,
  record,
  onAddSignature,
  signLabel = "Add signature",
  onReturnFocus,
  side,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: ApplicationDraft;
  record: CaseRecord;
  /** The side filing it, so "Filed for" names the right party. */
  side?: "complainant" | "accused";
  onAddSignature: () => void;
  onReturnFocus: () => void;
  /** The CTA's words. A clerk sends it to be signed rather than signing it. */
  signLabel?: string;
}) {
  const document = useMemo(
    () => buildGeneratedApplication(draft, record, side),
    [draft, record, side]
  );
  // Day precision, so recomputing per render never changes the text.
  const generatedOn = formatCaseDate(new Date().toISOString());

  if (!document || !draft.type) return null;
  const objection = draft.type === "objection";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FlowDialogContent
        ownBack
        showCloseButton={false}
        className="flex h-[calc(100dvh---spacing(12))] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
        // Radix's own restore lands on document.body here, so put focus back
        // on the button that opened the dialog explicitly.
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onReturnFocus();
        }}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-hairline py-3 pr-3 pl-6">
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-body-compact font-semibold text-pretty sm:truncate">
              {objection ? "Generated objection" : "Generated application"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Check the generated document before adding a signature.
            </DialogDescription>
          </div>
          {/* The plain-text copy: there is no rendered PDF behind it. */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Download"
                  onClick={() => downloadGeneratedApplication(draft, record, side)}
                >
                  <DownloadIcon aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Download</TooltipContent>
            </Tooltip>
          </TooltipProvider>
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
                <FactGroup>
                  <Fact label={objection ? "Filing" : "Application type"}>
                    {submissionTypeLabel(draft.type)}
                  </Fact>
                </FactGroup>
                <FactGroup columns={2}>
                  <Fact label="Case">
                    <Identifier value={record.caseNumber} label="case number" />
                  </Fact>
                  <Fact label="Generated on">
                    <span className="tabular-nums">{generatedOn}</span>
                  </Fact>
                  <Fact label="Filed for">{document.filedFor}</Fact>
                </FactGroup>
              </div>
            </div>

            <ComposedDocumentViewer
              title={document.title}
              className="min-h-64 min-w-0 flex-1 rounded-none"
            >
              <GeneratedApplicationDocument
                document={document}
                generatedOn={generatedOn}
              />
            </ComposedDocumentViewer>
          </div>
        </div>

        <footer className="flex shrink-0 flex-col border-t border-hairline bg-surface-sunken px-6 py-4 sm:flex-row sm:justify-end">
          <Button type="button" className="w-full sm:w-auto" onClick={onAddSignature}>
            {signLabel}
          </Button>
        </footer>
      </FlowDialogContent>
    </Dialog>
  );
}

/**
 * The court-form document itself, in the court's application template:
 * heading, case lines, parties table, title, content, the dated line and the
 * signature block. Its own component because the generate step, the signing
 * review and the application record render the same paper — a second copy
 * would be a second document to keep in step with the draft.
 */
export function GeneratedApplicationDocument({
  document: storedDocument,
  generatedOn,
  signedBy,
}: {
  document: GeneratedApplication;
  /** The application's date, as `formatCaseDate` writes it. */
  generatedOn: string;
  /** Who signed it, once it is signed; the slot stays empty until then. */
  signedBy?: string;
}) {
  // Written in Kerala's terms; re-voiced here for the selected court.
  const document = useCourtLocalized(storedDocument);
  return (
    /*
      The `paper` family, not the app palette: this is a facsimile of a filed
      court document, and the DS fixes those colours in both themes on purpose
      (AGENTS.md — "a printed complaint is a convention the reader recognises,
      and it does not go warm or dark because the product's palette did").
      That makes the whole subtree fixed-light, so the DescriptionList inside
      is re-bound to the paper pair by slot.
    */
    <article className="flex flex-col gap-8 rounded-md bg-paper p-6 text-paper-foreground sm:p-8 [&_[data-slot=description-details]]:text-paper-foreground [&_[data-slot=description-term]]:text-paper-muted-foreground">
      <header className="flex flex-col gap-6 text-center">
        <p className="text-body font-semibold text-balance">{document.court}</p>
        <div className="flex flex-col gap-1">
          <p className="text-body font-semibold">
            Case No: <span className="tabular-nums">{document.caseNumber}</span>
          </p>
          <p className="text-body font-semibold">
            In the matter of: {document.matter}
          </p>
          <p className="text-body font-semibold">
            Date: <span className="tabular-nums">{generatedOn}</span>
          </p>
        </div>
      </header>

      <table className="w-full border-collapse text-body">
        <caption className="sr-only">Parties</caption>
        <tbody>
          {document.parties.map((group, groupIndex) => (
            <Fragment key={groupIndex}>
              {groupIndex > 0 ? (
                <tr aria-hidden>
                  <td colSpan={2} className="h-8 border border-paper-border" />
                </tr>
              ) : null}
              {group.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  <th
                    scope="row"
                    className="w-2/5 border border-paper-border px-3 py-2 text-left align-top font-normal"
                  >
                    {row.term}
                  </th>
                  <td className="border border-paper-border px-3 py-2 align-top">
                    {row.value}
                  </td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>

      <h3 className="text-center text-body font-semibold">{document.title}</h3>

      {document.entries.length ? (
        <DescriptionList>
          {document.entries.map((row, index) => (
            <ReviewRow key={index} term={row.term}>
              <span className="whitespace-pre-wrap">{row.value}</span>
            </ReviewRow>
          ))}
        </DescriptionList>
      ) : document.details.text.trim() ? null : (
        <p className="text-body text-paper-muted-foreground">Nothing entered.</p>
      )}

      {/* Application details is the body of the application, so it reads as
          the filer formatted it rather than as one more row. */}
      {document.details.text.trim() ? (
        <RichTextValueView value={document.details} className="text-body" />
      ) : null}

      <footer className="flex flex-col gap-6">
        <p className="self-end text-body">{datedThis(generatedOn)}</p>
        <div className="flex flex-col items-start gap-1">
          {/* Dashed = empty target, the same meaning UploadWell borrows. The
              slot fills once the application is signed. */}
          {signedBy ? (
            <div className="mb-2 flex h-16 w-56 max-w-full flex-col items-center justify-center rounded-lg border border-paper-border">
              <p className="text-body-compact font-semibold">{signedBy}</p>
              <p className="text-caption text-paper-muted-foreground">Signed</p>
            </div>
          ) : (
            <div className="mb-2 flex h-16 w-56 max-w-full items-center justify-center rounded-lg border border-dashed border-paper-border">
              <p className="text-body-compact text-paper-muted-foreground">
                Signature pending
              </p>
            </div>
          )}
          <p className="text-body">{document.signatory.signature}</p>
          <p className="text-body">{document.signatory.line}</p>
        </div>
      </footer>
    </article>
  );
}
