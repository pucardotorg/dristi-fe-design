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
import {
  signatureSubject,
  useSignatureChoice,
} from "@/components/employee/sign-signature-fields";
import { useHeldRecord } from "@/components/employee/use-held-record";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { causeTitle } from "@/lib/employee/hearings";
import {
  buildSignFormDocument,
  downloadSignFormDocument,
  signFormProcessLabel,
  type SignForm,
  type SignFormDocument,
} from "@/lib/employee/sign-forms";
import { Identifier } from "@/components/chrome/identifier";
import { DialogDescription } from "@/components/ui/dialog";
import { useCourtLocalized } from "@/components/court/court-provider";
import { useCourtText } from "@/components/court/court-provider";

/**
 * One form, read and then signed — the single-document path off the signing queue.
 *
 * **One overlay, two stages** (owner, 2026-09-16). Reading is the wide stage: the
 * document *is* the task, so it is a `height="fill"` `DocumentPreview` on the canvas, the
 * same layout `ReschedulingRequestDialog` uses to review an application. Signing is the
 * narrow stage: a note saying what is about to be signed, the choice of how, and Submit,
 * in a reading-width column centred in the same window. It was two `Dialog`s until now —
 * see `sign-method-stage.tsx` for what that was avoiding and why it is no longer the way
 * to avoid it.
 *
 * Download does not sit in the footer as the reference draws it. `DocumentPreview` owns
 * a sticky header with Download and Full view in it, and repeating Download below would
 * be the same control twice in one dialog — so the footer keeps only the act the dialog
 * exists to complete. The signing stage has no preview, so Download comes back there,
 * which is where the reference puts it too.
 *
 * **Submit signs nothing.** It drops the row from the demo queue and closes — see
 * `lib/employee/sign-forms.ts`. Nothing is written, sent, or filed, and no e-sign
 * provider is called.
 */
export function SignFormDialog({
  form,
  onOpenChange,
  onSign,
  onReturnFocus,
}: {
  form: SignForm | null;
  onOpenChange: (form: SignForm | null) => void;
  onSign: (form: SignForm) => void;
  onReturnFocus: () => void;
}) {
  const { held, opening } = useHeldRecord(form);

  return (
    <Dialog
      open={form !== null}
      onOpenChange={(open) => {
        if (!open) onOpenChange(null);
      }}
    >
      {/* Keyed on the opening: a fresh window starts on the document with an empty
          signature, and the one that is leaving keeps the stage it was left on. */}
      {held ? (
        <SignFormBody
          key={opening}
          form={held}
          onSign={onSign}
          onReturnFocus={onReturnFocus}
        />
      ) : null}
    </Dialog>
  );
}

function SignFormBody({
  form,
  onSign,
  onReturnFocus,
}: {
  form: SignForm;
  onSign: (form: SignForm) => void;
  onReturnFocus: () => void;
}) {
  const courtText = useCourtText();
  const flow = useStagedFlow<SignStage>({
    order: SIGN_STAGES,
    scene: SIGN_SCENES,
  });
  const choice = useSignatureChoice();
  const document = React.useMemo(() => buildSignFormDocument(form), [form]);
  const reading = flow.stage === "read";

  return (
    <StagedOverlay
      /* The width and the height the *document* needs, held for both stages — see
         `SignOrderDialog` for why the height is definite at every width. */
      className="h-[85dvh] sm:max-w-4xl"
      title={reading ? signFormProcessLabel(form.process) : "Add signature"}
      titleRef={flow.titleRef}
      /* The form's own state — waiting for this bench's signature — in the DS's sentence
         case rather than the reference's `PENDING_REVIEW`. `warning` is the variant
         `ReschedulingRequestDialog` already spends on a pending application, so the two
         court-side review overlays report a pending state the same way. It stands on both
         stages, because nothing has been signed until Submit. */
      titleAside={<Badge variant="warning">Pending signature</Badge>}
      description={
        <DialogDescription className="text-body-compact text-muted-foreground">
          {causeTitle(form)} <span aria-hidden>· </span>
          {/* No copy control inside the dialog's accessible description. */}
          <Identifier value={form.caseNumber} label="case number" copyable={false} />
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
          <Button type="button" onClick={() => flow.go("sign")}>
            Proceed to sign
          </Button>
        ) : (
          <SignatureActions
            choice={choice}
            onBack={() => flow.go("read")}
            onSubmit={() => onSign(form)}
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
            content: <FormFacsimile document={document} />,
          }}
          download={{
            onDownload: () => downloadSignFormDocument(form),
            label: `Download ${document.title}`,
          }}
        />
      ) : (
        <SignatureStage
          noun="form"
          subject={courtText(signatureSubject([form]))}
          download={{
            prompt: "Want to read the form again?",
            onDownload: () => downloadSignFormDocument(form),
          }}
          choice={choice}
        />
      )}
    </StagedOverlay>
  );
}

/**
 * The form itself as paper — the same facsimile treatment the rescheduling review
 * overlay uses, bound to this form's own particulars.
 */
function FormFacsimile({ document: storedDocument }: { document: SignFormDocument }) {
  const document = useCourtLocalized(storedDocument);
  return (
    <article className="flex flex-col gap-6 rounded-md bg-paper p-6 text-paper-foreground">
      <header className="flex flex-col gap-2 text-center">
        <p className="text-body font-semibold">{document.court}</p>
        <p className="text-body font-semibold">
          Case no. {document.caseNumber}
        </p>
        <p className="text-body font-semibold">{document.matter}</p>
      </header>

      <h3 className="text-center text-body font-semibold">{document.title}</h3>

      <ol className="flex list-decimal flex-col gap-3 ps-6">
        {document.paragraphs.map((paragraph, index) => (
          <li key={index} className="text-body">
            {paragraph}
          </li>
        ))}
      </ol>

      <p className="text-body">{document.closing}</p>
      <p className="text-body">Dated this the {document.dated}.</p>

      <section className="flex flex-col gap-1">
        <h4 className="text-body font-semibold">Deponent</h4>
        <p className="text-body">{document.deponent.name}</p>
        <p className="text-body-compact text-paper-muted-foreground">
          {document.deponent.capacity}
        </p>
      </section>

      <p className="text-body">{document.attestation}</p>

      {document.advocate ? (
        <section className="flex flex-col gap-1">
          <h4 className="text-body font-semibold">Advocate</h4>
          <p className="text-body">{document.advocate}</p>
        </section>
      ) : null}
    </article>
  );
}
