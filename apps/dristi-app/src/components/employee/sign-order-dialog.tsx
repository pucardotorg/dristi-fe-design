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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { causeTitle } from "@/lib/employee/hearings";
import {
  buildSignOrderDocument,
  downloadSignOrderDocument,
  formatSignOrderDate,
  signOrderStatusLabel,
  signOrderTypeLabel,
  type SignOrder,
  type SignOrderDocument,
} from "@/lib/employee/sign-orders";
import { Identifier } from "@/components/chrome/identifier";
import { DialogDescription } from "@/components/ui/dialog";
import { useCourtLocalized } from "@/components/court/court-provider";
import { useCourtText } from "@/components/court/court-provider";

/** What the paper is called in the signature stage's copy. */
const NOUN = "order";

/**
 * What the bench is about to sign, in one sentence.
 *
 * Named rather than counted, the way `signatureSubject` does it for forms — and here the
 * name is the title, because a case can carry four orders and "the order in ST/606/2026"
 * would not tell the bench which of them. Only the single-order path reaches this.
 */
function orderSubject(order: SignOrder): string {
  return `You are adding your signature to the ${signOrderTypeLabel(order.type)} order in ${order.caseNumber}.`;
}

/**
 * One order, read and then signed — the single-order path off the signing queue.
 *
 * **One overlay, two stages** (owner, 2026-09-16). Reading is the wide stage: the
 * document *is* the task, so it is a `height="fill"` `DocumentPreview` on the canvas.
 * Signing is the narrow stage: what is about to be signed, the choice of how, and Submit,
 * in a reading-width column centred in the same window. The window itself does not move —
 * same width, same height, the header and footer standing still while the stage travels
 * in from the right and back from the left.
 *
 * It was two `Dialog`s until now, closed and opened in sequence so the second played an
 * entrance. See `sign-method-stage.tsx` for why that was the right complaint and the
 * wrong cure.
 *
 * **The signature stage is owner-requested (2026-09-06).** The original build took Sign
 * and publish as the act itself, because an order is signed by the bench already logged
 * in and the 1.0 reference asked nothing about how. The owner now wants the same choice
 * the forms and bail-bond queues ask, reached from that same button — so the footer still
 * says Sign and publish, and the stage it opens is where the signature is chosen.
 *
 * A signed order opens here too, read-only. It is the only way to see what was signed
 * without leaving the screen, and offering it costs nothing but the button.
 *
 * **Submit signs nothing.** It marks the row signed in the demo queue and closes — see
 * `lib/employee/sign-orders.ts`. Nothing is written, published, sent or filed, and no
 * e-sign provider is called.
 */
export function SignOrderDialog({
  order,
  onOpenChange,
  onSign,
  onReturnFocus,
}: {
  order: SignOrder | null;
  onOpenChange: (order: SignOrder | null) => void;
  onSign: (order: SignOrder) => void;
  onReturnFocus: () => void;
}) {
  const { held, opening } = useHeldRecord(order);

  return (
    <Dialog
      open={order !== null}
      onOpenChange={(open) => {
        if (!open) onOpenChange(null);
      }}
    >
      {/* Keyed on the opening, not on the order: a fresh window starts on the document
          with an empty signature, and the one that is leaving keeps the stage the bench
          left it on for the length of its exit. */}
      {held ? (
        <SignOrderBody
          key={opening}
          order={held}
          onSign={onSign}
          onReturnFocus={onReturnFocus}
        />
      ) : null}
    </Dialog>
  );
}

function SignOrderBody({
  order,
  onSign,
  onReturnFocus,
}: {
  order: SignOrder;
  onSign: (order: SignOrder) => void;
  onReturnFocus: () => void;
}) {
  const courtText = useCourtText();
  const flow = useStagedFlow<SignStage>({
    order: SIGN_STAGES,
    scene: SIGN_SCENES,
  });
  const choice = useSignatureChoice(NOUN);
  const document = React.useMemo(() => buildSignOrderDocument(order), [order]);
  const pending = order.status === "pending-signature";
  const reading = flow.stage === "read";

  return (
    <StagedOverlay
      /* The width and the height the *document* needs, held for both stages. A definite
         height at every width rather than `md:` and up: the facsimile is longer than any
         phone, so the reading stage stands at 85dvh there too, and a signature stage that
         sized itself would shrink the panel and slide it up the screen — the one thing
         the frame exists to prevent. With a definite height the canvas needs no floor. */
      className="h-[85dvh] sm:max-w-4xl"
      title={reading ? signOrderTypeLabel(order.type) : "Add signature"}
      titleRef={flow.titleRef}
      titleAside={
        <Badge variant={pending ? "warning" : "success"}>
          {signOrderStatusLabel(order.status)}
        </Badge>
      }
      /* The record's own line, on both stages. It is the order that does not change when
         the stage does, and saying it again under "Add signature" is what keeps the
         signature attached to the paper the bench just read. */
      description={
        <DialogDescription className="text-body-compact text-muted-foreground">
          {causeTitle(order)} <span aria-hidden>· </span>
          {/* No copy control inside the dialog's accessible description. */}
          <Identifier value={order.caseNumber} label="case number" copyable={false} />{" "}
          ·{" "}
          {pending
            ? `Added ${formatSignOrderDate(order.addedOn)}`
            : `Signed ${formatSignOrderDate(order.signedOn ?? order.addedOn)}`}
        </DialogDescription>
      }
      sceneKey={flow.sceneKey}
      motion={flow.motion}
      /* The row that opened this overlay is gone by the time it closes — signing takes it
         out of the queue — so the screen says where focus goes rather than Radix. */
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        onReturnFocus();
      }}
      footer={
        reading ? (
          pending ? (
            <Button type="button" onClick={() => flow.go("sign")}>
              Sign and publish
            </Button>
          ) : null
        ) : (
          <SignatureActions
            choice={choice}
            onBack={() => flow.go("read")}
            onSubmit={() => onSign(order)}
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
            content: <OrderFacsimile document={document} />,
          }}
          download={{
            onDownload: () => downloadSignOrderDocument(order),
            label: `Download the ${document.title.toLowerCase()} order`,
          }}
        />
      ) : (
        <SignatureStage
          noun={NOUN}
          subject={courtText(orderSubject(order))}
          warning="Signing publishes this order and cannot be reversed."
          download={{
            prompt: "Want to read the order again?",
            onDownload: () => downloadSignOrderDocument(order),
          }}
          choice={choice}
        />
      )}
    </StagedOverlay>
  );
}

/**
 * The order itself as paper — the same facsimile treatment the two other court-side
 * overlays use, bound to this order's own particulars.
 */
function OrderFacsimile({ document: storedDocument }: { document: SignOrderDocument }) {
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

      <p className="text-body">Dated this the {document.dated}.</p>

      <p className="text-body text-paper-muted-foreground">
        {document.signature}
      </p>
    </article>
  );
}
