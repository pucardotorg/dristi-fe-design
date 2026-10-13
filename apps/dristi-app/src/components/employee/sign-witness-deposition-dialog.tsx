"use client";

import * as React from "react";

import { StagedOverlay } from "@/components/chrome/staged-overlay";
import { DocumentPreview } from "@/components/cases/document-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription } from "@/components/ui/dialog";
import { causeTitle } from "@/lib/employee/hearings";
import {
  buildWitnessDepositionDocument,
  depositionTitle,
  downloadWitnessDepositionDocument,
  formatDepositionDate,
  type WitnessDeposition,
  type WitnessDepositionDocument,
} from "@/lib/employee/sign-witness-deposition";
import { Identifier } from "@/components/chrome/identifier";
import { useCourtLocalized } from "@/components/court/court-provider";

/**
 * One deposition, read and then signed — the single-sheet path off the evidence queue.
 *
 * The document *is* the task, so the dialog is the document: a `height="fill"`
 * `DocumentPreview` filling the stage of a tall `StagedOverlay`, the same layout
 * `SignOrderDialog`, `SignFormDialog` and `ReschedulingRequestDialog` already use to
 * read a court paper before acting on it. The reference draws this screen's overlay as
 * the sheet and nothing else, and it is right to: evidence is long, and the bench
 * signing it is certifying that this is what the witness said.
 *
 * One step rather than the two the forms queue needs. A form is signed by a *party*, so
 * that dialog has to ask how — e-sign, or upload the paper they signed. A deposition is
 * signed by the bench that is already logged in, so the act is one button under the
 * document it acts on, as it is for orders.
 *
 * Download is not repeated in the footer. The document's own frame carries Download and
 * Full view in its strip, and the same control twice in one dialog is one too many.
 *
 * **Signing signs nothing.** It drops the sheet from the demo queue and closes — see
 * `lib/employee/sign-witness-deposition.ts`. Nothing is written, published, sent or
 * filed, and no e-sign provider is called.
 */
export function SignWitnessDepositionDialog({
  deposition,
  onOpenChange,
  onSign,
  onReturnFocus,
}: {
  deposition: WitnessDeposition | null;
  onOpenChange: (deposition: WitnessDeposition | null) => void;
  onSign: (deposition: WitnessDeposition) => void;
  onReturnFocus: () => void;
}) {
  return (
    <Dialog
      open={deposition !== null}
      onOpenChange={(next) => {
        if (!next) onOpenChange(null);
      }}
    >
      {deposition ? (
        /* Keyed on the sheet so opening a second one renders that document from the top
           rather than inheriting the last one's scroll. */
        <SignWitnessDepositionBody
          key={deposition.id}
          deposition={deposition}
          onSign={onSign}
          onReturnFocus={onReturnFocus}
        />
      ) : null}
    </Dialog>
  );
}

function SignWitnessDepositionBody({
  deposition,
  onSign,
  onReturnFocus,
}: {
  deposition: WitnessDeposition;
  onSign: (deposition: WitnessDeposition) => void;
  onReturnFocus: () => void;
}) {
  const document = React.useMemo(
    () => buildWitnessDepositionDocument(deposition),
    [deposition],
  );
  const title = depositionTitle(deposition);

  return (
    <StagedOverlay
      /* The document is the task, so the overlay takes a definite height and the page
         takes all of it. No floor: `md:h-[85dvh]` already holds the frame still. */
      className="sm:max-w-4xl md:h-[85dvh]"
      /* The reference's own title: the paper, and which witness's it is. */
      title={title}
      /* The sheet's state — waiting for this bench's signature — in the DS's sentence
         case rather than the reference's shouted status. `warning` is the variant the
         sibling overlays already spend on a pending paper, so the court side reports a
         pending state one way. */
      titleAside={<Badge variant="warning">Pending signature</Badge>}
      description={
        <DialogDescription className="text-body-compact text-muted-foreground">
          {causeTitle(deposition)} <span aria-hidden>· </span>
          {/* No copy control inside the dialog's accessible description. */}
          <Identifier value={deposition.caseNumber} label="case number" copyable={false} />{" "}
          · Recorded{" "}
          {formatDepositionDate(deposition.depositionOn)}
        </DialogDescription>
      }
      /* One stage: reading the deposition is the whole act, and the signature leaves the
         overlay. The frame is still what it opens on — the rise, the chrome that holds
         still, the tinted stage and the footer in its own register — because that is how
         the queue beside it opens. */
      sceneKey="deposition"
      motion="forward"
      footer={
        <>
          {/* What the act means, and what this build does not do — said at the moment of
              the act rather than left for the bench to discover. */}
          <p className="text-caption text-muted-foreground sm:mr-auto sm:text-left">
            Signing publishes this deposition and cannot be reversed. Not part of
            this build — nothing is signed, published or sent.
          </p>
          {/* `sm:self-center` because the frame owns the footer's own classes and this
              row pairs a caption that wraps to two lines with a 40px control: without it
              the button hangs from the top of the tallest child. */}
          <Button
            type="button"
            className="sm:self-center"
            onClick={() => onSign(deposition)}
          >
            Sign and publish
          </Button>
        </>
      }
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        onReturnFocus();
      }}
    >
      {/* The framed well: a white sheet with a hairline and its two actions in a strip
          above the rule. On the tinted stage a sunken well is the stage's own tone and
          has no edge, and the dialog's title already names the paper — so the strip
          carries the name quietly and the page takes everything under it. */}
      <DocumentPreview
        variant="quiet"
        surface="card"
        className="min-h-96 shadow-raised md:min-h-0"
        height="fill"
        title={title}
        source={{
          kind: "composed",
          content: <DepositionFacsimile document={document} />,
        }}
        download={{
          onDownload: () => downloadWitnessDepositionDocument(deposition),
          label: `Download the ${title.toLowerCase()}`,
        }}
      />
    </StagedOverlay>
  );
}

/**
 * The deposition itself as paper — the same facsimile treatment the three other
 * court-side overlays use, bound to this sheet's own particulars.
 *
 * Two things are its own. The **particulars** block names who was in the box, and is
 * the part of a deposition that identifies the same witness if they are recalled. And
 * the evidence is **split into chief and cross-examination**, under headings, because
 * that division is what a deposition is read for: the answers a witness gave their own
 * side, and the answers they gave the other. Where there was no cross-examination the
 * heading stays and says why, rather than the section vanishing — a missing section on
 * a court paper reads as a document that failed to render.
 */
function DepositionFacsimile({
  document: storedDocument,
}: {
  document: WitnessDepositionDocument;
}) {
  const document = useCourtLocalized(storedDocument);
  return (
    <article className="flex flex-col gap-6 rounded-md bg-paper p-6 text-paper-foreground">
      <header className="flex flex-col gap-2 text-center">
        <h3 className="text-body font-semibold">{document.title}</h3>
        <p className="text-body-compact text-paper-muted-foreground">
          ({document.citation})
        </p>
        <p className="text-body font-semibold">{document.court}</p>
        <p className="text-body">{document.jurisdiction}</p>
        <p className="text-body font-semibold">
          Case no. {document.caseNumber}
        </p>
        <p className="text-body">{document.matter}</p>
      </header>

      <section className="flex flex-col gap-2">
        <h4 className="text-body font-semibold">{document.subject}</h4>
        <dl className="flex flex-col gap-1">
          {document.particulars.map(({ label, value }) => (
            <div key={label} className="flex flex-wrap gap-1">
              <dt className="text-body text-paper-muted-foreground">
                {label}:
              </dt>
              <dd className="text-body">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="flex flex-col gap-3">
        <h4 className="text-body font-semibold">Examination-in-chief</h4>
        <ol className="flex list-decimal flex-col gap-3 ps-6">
          {document.chief.map((paragraph, index) => (
            <li key={index} className="text-body">
              {paragraph}
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-3">
        <h4 className="text-body font-semibold">Cross-examination</h4>
        {document.cross.length > 0 ? (
          <ol className="flex list-decimal flex-col gap-3 ps-6">
            {document.cross.map((paragraph, index) => (
              <li key={index} className="text-body">
                {paragraph}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-body">{document.crossNote}</p>
        )}
      </section>

      <p className="text-body">{document.attestation}</p>

      <p className="text-body text-paper-muted-foreground">
        {document.signature}
      </p>
    </article>
  );
}
