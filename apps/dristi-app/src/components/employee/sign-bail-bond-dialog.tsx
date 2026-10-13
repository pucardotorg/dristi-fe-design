"use client";

import * as React from "react";

import {
  StagedOverlay,
  useStagedFlow,
} from "@/components/chrome/staged-overlay";
import { DocumentPreview } from "@/components/cases/document-preview";
import {
  SIGN_SCENES,
  SIGN_STAGES,
  SignatureActions,
  SignatureStage,
  type SignStage,
} from "@/components/employee/sign-method-stage";
import { useSignatureChoice } from "@/components/employee/sign-signature-fields";
import { useHeldRecord } from "@/components/employee/use-held-record";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { causeTitle } from "@/lib/employee/hearings";
import {
  buildSignBailBondDocument,
  downloadSignBailBondDocument,
  formatSignBailBondDate,
  type SignBailBond,
  type SignBailBondDocument,
} from "@/lib/employee/sign-bail-bonds";
import { Identifier } from "@/components/chrome/identifier";
import { DialogDescription } from "@/components/ui/dialog";
import { useCourtLocalized } from "@/components/court/court-provider";
import { useCourtText } from "@/components/court/court-provider";

/** What the paper is called in the signature stage's copy. */
const NOUN = "bail bond";

/**
 * What the bench is about to sign, in one sentence.
 *
 * Named rather than counted, the way `signatureSubject` does it for forms — and here the
 * name is the litigant, because a case can carry two bonds and "2 bail bonds" would not
 * tell the bench which two. Only the single-bond path reaches this: the bulk path signs
 * without a signature step, so it has nothing to caption.
 */
function bondSubject(bond: SignBailBond): string {
  return `You are adding your signature to the bail bond of ${bond.litigant} in ${bond.caseNumber}.`;
}

/**
 * One bail bond, read and then signed or refused — the single-bond path off the queue.
 *
 * **One overlay, two stages** (owner, 2026-09-16). Reading is the wide stage: the
 * document *is* the task, so it is a `height="fill"` `DocumentPreview` on the canvas.
 * Signing is the narrow stage: a note saying what is about to be signed, the choice of
 * how, and Submit, in a reading-width column centred in the same window. It was two
 * `Dialog`s until now — see `sign-method-stage.tsx`.
 *
 * **The signature stage is a departure from the reference**, made on the owner's
 * instruction (2026-09-03). The reference took Proceed to sign straight to a Confirm sign
 * modal and asked nothing about how the signature gets on the paper. A bail bond is
 * executed by the accused and the surety before the bench attests it, so "upload the bond
 * they signed" is a real path in a way it is not for an order — which is why this queue
 * follows the forms queue here rather than the orders queue.
 *
 * **Reject** refuses the bond and it leaves the bench unsigned — no reason is asked for,
 * because the reference asks for none and a reasons taxonomy invented for a demo would be
 * inventing product. It sits on the reading stage, where the bench can still see what it
 * is refusing.
 *
 * **Submit signs nothing.** It moves the row's status in the demo queue and closes — see
 * `lib/employee/sign-bail-bonds.ts`. Nothing is written, published or sent, and no e-sign
 * provider is called.
 */
export function SignBailBondDialog({
  bond,
  onOpenChange,
  onSign,
  onReject,
  onReturnFocus,
}: {
  bond: SignBailBond | null;
  onOpenChange: (bond: SignBailBond | null) => void;
  onSign: (bond: SignBailBond) => void;
  onReject: (bond: SignBailBond) => void;
  onReturnFocus: () => void;
}) {
  const { held, opening } = useHeldRecord(bond);

  return (
    <Dialog
      open={bond !== null}
      onOpenChange={(open) => {
        if (!open) onOpenChange(null);
      }}
    >
      {/* Keyed on the opening: a fresh window starts on the bond with an empty signature,
          and the one that is leaving keeps the stage it was left on. */}
      {held ? (
        <SignBailBondBody
          key={opening}
          bond={held}
          onSign={onSign}
          onReject={onReject}
          onReturnFocus={onReturnFocus}
        />
      ) : null}
    </Dialog>
  );
}

function SignBailBondBody({
  bond,
  onSign,
  onReject,
  onReturnFocus,
}: {
  bond: SignBailBond;
  onSign: (bond: SignBailBond) => void;
  onReject: (bond: SignBailBond) => void;
  onReturnFocus: () => void;
}) {
  const courtText = useCourtText();
  const flow = useStagedFlow<SignStage>({
    order: SIGN_STAGES,
    scene: SIGN_SCENES,
  });
  const choice = useSignatureChoice(NOUN);
  const document = React.useMemo(
    () => buildSignBailBondDocument(bond),
    [bond],
  );
  const reading = flow.stage === "read";

  return (
    <StagedOverlay
      /* The width and the height the *document* needs, held for both stages — see
         `SignOrderDialog` for why the height is definite at every width. */
      className="h-[85dvh] sm:max-w-4xl"
      /* The reference titles this overlay with the cause and the paper — "… vs … - Bail
         Bond" — and that is the right pair: the bond has no name of its own. */
      title={reading ? `${causeTitle(bond)} — Bail bond` : "Add signature"}
      titleRef={flow.titleRef}
      /* The litigant leads the supporting line rather than the case number, because with
         two bonds to a case the litigant is the only thing that says which of them is
         open. It stands on both stages: it is what the signature is being put to. */
      description={
        <DialogDescription className="text-body-compact text-muted-foreground">
          Executed by {bond.litigant} <span aria-hidden>· </span>
          {/* No copy control inside the dialog's accessible description. */}
          <Identifier value={bond.caseNumber} label="case number" copyable={false} />{" "}
          · Added {formatSignBailBondDate(bond.addedOn)}
        </DialogDescription>
      }
      sceneKey={flow.sceneKey}
      motion={flow.motion}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        onReturnFocus();
      }}
      footer={
        reading ? (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => onReject(bond)}
            >
              Reject
            </Button>
            <Button type="button" onClick={() => flow.go("sign")}>
              Proceed to sign
            </Button>
          </>
        ) : (
          <SignatureActions
            choice={choice}
            onBack={() => flow.go("read")}
            onSubmit={() => onSign(bond)}
          />
        )
      }
    >
      {reading ? (
        <DocumentPreview
          /* The stage canvas is a flex column, so the preview only takes the height the
             window can spare if it says so: a flex item's height is never stretched for
             it. The grid callers get this from a `minmax(0,1fr)` row; here it is
             `flex-1`, and `min-h-0` lets it shrink rather than pushing the footer. */
          className="min-h-0 flex-1"
          height="fill"
          title={document.title}
          source={{
            kind: "composed",
            content: <BailBondFacsimile document={document} />,
          }}
          download={{
            onDownload: () => downloadSignBailBondDocument(bond),
            label: `Download the bail bond of ${bond.litigant}`,
          }}
        />
      ) : (
        <SignatureStage
          noun={NOUN}
          subject={courtText(bondSubject(bond))}
          warning="Signing publishes this bond and cannot be reversed."
          download={{
            prompt: "Want to read the bond again?",
            onDownload: () => downloadSignBailBondDocument(bond),
          }}
          choice={choice}
        />
      )}
    </StagedOverlay>
  );
}

/**
 * The bond itself as paper — the same facsimile treatment the other court-side overlays
 * use, laid out the way the reference lays this one out.
 *
 * The reference's own order: the case number on its own line, the court as the document's
 * heading, then the register line and the cause, then the bond. The court heading is the
 * one line that steps up a size — it is the paper's own heading, and the paper is its own
 * surface — while everything under it stays body copy, which keeps the facsimile to the
 * two weights ui-craft §1.3 allows.
 */
function BailBondFacsimile({ document: storedDocument }: { document: SignBailBondDocument }) {
  const document = useCourtLocalized(storedDocument);
  return (
    <article className="flex flex-col gap-6 rounded-md bg-paper p-6 text-paper-foreground">
      <header className="flex flex-col gap-4">
        <p className="text-center text-body tabular-nums">
          Case Number: {document.caseNumber}
        </p>
        <h3 className="text-center text-title-s font-semibold">
          {document.court}
        </h3>
        <div className="flex flex-col gap-1">
          <p className="text-body tabular-nums">{document.register}</p>
          <p className="text-body">{document.matter}</p>
        </div>
      </header>

      <h4 className="text-center text-body font-semibold">{document.title}</h4>

      <div className="flex flex-col gap-3">
        {document.recital.map((paragraph, index) => (
          <p key={index} className="text-body">
            {paragraph}
          </p>
        ))}
      </div>

      <ol className="flex list-decimal flex-col gap-3 ps-6">
        {document.undertakings.map((clause, index) => (
          <li key={index} className="text-body">
            {clause}
          </li>
        ))}
      </ol>

      <p className="text-body">Dated this the {document.dated}.</p>

      {/* Who put their hand to it. A description list rather than prose, because the
          reference's paper signs itself in a block and a bench checking a bond checks the
          surety by name. */}
      <dl className="flex flex-col gap-2">
        {document.signatories.map((entry) => (
          <div key={entry.role} className="flex flex-wrap gap-2">
            <dt className="text-body text-paper-muted-foreground">
              {entry.role}:
            </dt>
            <dd className="text-body">{entry.name}</dd>
          </div>
        ))}
      </dl>

      <p className="text-body text-paper-muted-foreground">
        {document.signature}
      </p>
    </article>
  );
}
