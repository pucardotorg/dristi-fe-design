"use client";

import { useMemo } from "react";

import { ChromeDialogContent } from "@/components/chrome/app-chrome";
import { DocumentPreview } from "@/components/cases/document-preview";
import { ReviewRow } from "@/components/cases/filing-form-shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DescriptionList } from "@/components/ui/description-list";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  buildCopyApplicationDocument,
  copiesLine,
  copyApplicationFiler,
  downloadCopyApplicationDocument,
  formatCopyApplicationLongDate,
  type CopyApplication,
  type CopyApplicationDocument,
} from "@/lib/employee/approve-copy-application";
import { causeTitle } from "@/lib/employee/hearings";
import { Identifier } from "@/components/chrome/identifier";
import { useCourtLocalized } from "@/components/court/court-provider";

/**
 * One copy application, read and then allowed or refused — the single-application path
 * off the queue.
 *
 * The same overlay as `ReschedulingRequestDialog`, because it is the same job: an
 * application somebody filed, in front of a bench that has to say yes or no. The
 * particulars sit in a compact sunken well, and the application itself is what is being
 * reviewed — so from `xl` the two stand side by side, well on the left and a
 * `DocumentPreview` filling the full height of the column on the right. The bench reads
 * and decides here, it does not annotate.
 *
 * Stacked, the well ate the first fold and left the document a strip you had to open
 * Full view to read. Side by side it keeps around 700px of width and the whole height of
 * the overlay, which is a page of it on screen at once. The split waits for `xl` because
 * the rail takes 17rem off the page column first: below that width two columns leave
 * neither the particulars nor the document a usable measure, so they stack.
 *
 * Download does not sit in the footer. `DocumentPreview` owns a sticky header with
 * Download and Full view in it, and repeating Download below would be the same control
 * twice in one overlay — so the footer keeps only the two decisions the overlay exists to
 * take.
 *
 * **Accept and Reject perform no judicial act.** Both drop the row from the demo queue and
 * close — see `lib/employee/approve-copy-application.ts`. No copy is ordered or refused,
 * no fee is assessed, nothing is written and nobody is told.
 */
export function ApproveCopyApplicationDialog({
  application,
  onOpenChange,
  onAccept,
  onReject,
  onReturnFocus,
}: {
  application: CopyApplication | null;
  onOpenChange: (application: CopyApplication | null) => void;
  onAccept: (application: CopyApplication) => void;
  onReject: (application: CopyApplication) => void;
  onReturnFocus: () => void;
}) {
  return (
    <Dialog
      open={application !== null}
      onOpenChange={(next) => {
        if (!next) onOpenChange(null);
      }}
    >
      {application ? (
        /* Keyed on the application so opening a second one starts fresh rather than
           inheriting the last one's scroll position. */
        <ApplicationBody
          key={application.id}
          application={application}
          onAccept={onAccept}
          onReject={onReject}
          onReturnFocus={onReturnFocus}
        />
      ) : null}
    </Dialog>
  );
}

function ApplicationBody({
  application,
  onAccept,
  onReject,
  onReturnFocus,
}: {
  application: CopyApplication;
  onAccept: (application: CopyApplication) => void;
  onReject: (application: CopyApplication) => void;
  onReturnFocus: () => void;
}) {
  const document = useMemo(
    () => buildCopyApplicationDocument(application),
    [application],
  );

  return (
    <ChromeDialogContent
      className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl md:h-[85dvh] xl:max-w-6xl"
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        onReturnFocus();
      }}
    >
      <DialogHeader className="shrink-0 gap-2 p-6 pr-16">
        <div className="flex flex-wrap items-center gap-2">
          <DialogTitle className="text-title-s font-semibold">
            Review application
          </DialogTitle>
          {/* The application's own state — waiting on this bench — in the DS's sentence
              case rather than the reference's Title Case. `warning` is the variant the
              court-side review overlays already spend on a pending application, so all
              four report a pending state the same way. This is the one place the state is
              stated: the list behind it is entirely pending, so it says it once, here,
              instead of thirty times down a column. */}
          <Badge variant="warning">Pending approval</Badge>
        </div>
        <DialogDescription className="text-body-compact text-muted-foreground">
          {/* No copy control inside the dialog's accessible description. */}
          <Identifier
            value={application.applicationNumber}
            label="application number"
            copyable={false}
          />
          {" · "}
          {causeTitle(application)}
        </DialogDescription>
      </DialogHeader>
      <Separator />
      <div className="grid min-h-0 flex-1 grid-rows-[auto_auto] gap-6 overflow-y-auto p-6 md:grid-rows-[auto_minmax(0,1fr)] md:overflow-hidden xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] xl:grid-rows-1">
        {/* The particulars a bench checks before reading the application itself. The
            reference's three rows — type, submission date and filer — are thin for a
            copy application, where what is asked for and how much of it is the whole
            question, so the case and the record sought join them.

            The wrapper is the grid cell and the well is its content, so the well keeps
            its own height instead of stretching into a tall empty panel. Six rows fit
            the column at the heights a laptop actually has; on a short window, or once a
            label triples in translation, the cell scrolls rather than cropping the last
            fact away.

            Both of those are `xl:` on purpose. Stacked, the rows are `auto` inside a
            container of definite height, and `min-height: 0` is what lets a grid compress
            such a row below its content — the well then ran straight under the document
            below it. Off the split, the cell keeps its automatic minimum. */}
        <div className="xl:min-h-0 xl:overflow-y-auto">
          <div className="rounded-lg bg-surface-sunken p-4">
            <DescriptionList>
              <ReviewRow term="Application type">Copy application</ReviewRow>
              <ReviewRow term="Case number">
                <Identifier value={application.caseNumber} label="case number" />
              </ReviewRow>
              <ReviewRow term="Copy sought">
                {application.record.description}
                {", dated "}
                <span className="tabular-nums">
                  {formatCopyApplicationLongDate(application.record.dated)}
                </span>
              </ReviewRow>
              <ReviewRow term="Copies required">
                {copiesLine(application)}
              </ReviewRow>
              <ReviewRow term="Submission date">
                <span className="tabular-nums">
                  {formatCopyApplicationLongDate(application.raisedOn)}
                </span>
              </ReviewRow>
              <ReviewRow term="Application filer">
                {copyApplicationFiler(application)}
              </ReviewRow>
            </DescriptionList>
          </div>
        </div>
        <DocumentPreview
          className="min-h-96 md:min-h-0"
          height="fill"
          title={document.title}
          source={{
            kind: "composed",
            content: <ApplicationFacsimile document={document} />,
          }}
          download={{
            onDownload: () => downloadCopyApplicationDocument(application),
            label: `Download ${document.title}`,
          }}
        />
      </div>
      <DialogFooter className="mx-0 mb-0 shrink-0">
        <Button
          type="button"
          variant="destructive"
          onClick={() => onReject(application)}
        >
          Reject
        </Button>
        <Button type="button" onClick={() => onAccept(application)}>
          Accept
        </Button>
      </DialogFooter>
    </ChromeDialogContent>
  );
}

/**
 * The application itself as paper — the same facsimile treatment the other court-side
 * review overlays use, bound to this application's own particulars.
 */
function ApplicationFacsimile({
  document: storedDocument,
}: {
  document: CopyApplicationDocument;
}) {
  const document = useCourtLocalized(storedDocument);
  return (
    <article className="flex flex-col gap-6 rounded-md bg-paper p-6 text-paper-foreground [&_[data-slot=description-details]]:text-paper-foreground [&_[data-slot=description-term]]:text-paper-muted-foreground">
      <header className="flex flex-col gap-2 text-center">
        <p className="text-body font-semibold">{document.court}</p>
        <p className="text-body font-semibold">
          Copy application no. {document.applicationNumber}
        </p>
        <p className="text-body font-semibold">
          In case no. {document.caseNumber}
        </p>
        <p className="text-body-compact text-paper-muted-foreground">
          {document.matter}
        </p>
      </header>

      <h3 className="text-center text-body font-semibold">{document.title}</h3>

      <DescriptionList className="rounded-md border border-paper-border px-4">
        {document.facts.map((fact) => (
          <ReviewRow key={fact.term} term={fact.term}>
            {fact.value}
          </ReviewRow>
        ))}
      </DescriptionList>

      <ol className="flex list-decimal flex-col gap-3 ps-6">
        {document.paragraphs.map((paragraph, index) => (
          <li key={index} className="text-body whitespace-pre-wrap">
            {paragraph}
          </li>
        ))}
      </ol>

      <section className="flex flex-col gap-2">
        <h4 className="text-body font-semibold">Prayer</h4>
        <p className="text-body whitespace-pre-wrap">{document.prayer}</p>
      </section>

      <footer className="flex flex-col items-end gap-2">
        <p className="text-body font-semibold">{document.applicant.name}</p>
        <p className="text-body-compact text-paper-muted-foreground">
          {document.applicant.capacity}
        </p>
        <p className="text-body-compact text-paper-muted-foreground">
          Presented by {document.filedBy}
        </p>
        <p className="text-body-compact text-paper-muted-foreground">
          Dated this {document.dated}, at {document.place}
        </p>
      </footer>
    </article>
  );
}
