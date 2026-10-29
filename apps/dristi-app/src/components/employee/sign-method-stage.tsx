"use client";

import {
  SignatureFields,
  type SignatureChoice,
} from "@/components/employee/sign-signature-fields";
import { Button } from "@/components/ui/button";
import { IrreversibleNote } from "@/components/feedback";

/**
 * **Add signature — a stage of the window that was reading the paper, not a second
 * window.**
 *
 * The four single-document queues (orders, forms, process, bail bonds) each open one
 * overlay on one paper: the bench reads it, then says how it will sign it. Until now
 * those were two `Dialog` roots — the document closed itself, and the method choice
 * opened from its `onCloseAutoFocus` once Radix had finished the exit, so that the second
 * one arrived with an entrance of its own.
 *
 * That was the right complaint and the wrong cure. The jump it was avoiding was real: the
 * box went from the document's width and height to a narrow box in a single frame, with
 * no entrance at all. But the registrations overlay had already answered exactly that
 * inside one window — chrome that holds still, a stage that travels, and a frame that does
 * not resize under the reader — and the owner has since ruled the second modal out
 * altogether (2026-09-16: *"right now it abruptly changes to a new modal — that shouldn't
 * happen at all, everything should happen in one modal with all those
 * motion+interaction"*). So the overlay now keeps the size the document asked for and the
 * signature travels in from the right inside it.
 *
 * It stays **one** shared component, which is the reason the choice is identical wherever
 * one paper is being signed: a bench asked for its signature two different ways in one
 * morning is the drift this prevents. Only the noun, the sentence above the choice, the
 * warning under it and the download differ, and each queue passes its own.
 */

/** The act, in the order it moves through: the paper, then the signature on it. */
export const SIGN_STAGES = ["read", "sign"] as const;

export type SignStage = (typeof SIGN_STAGES)[number];

/**
 * Two stages, two scenes. Reading the paper and choosing a signature are different things
 * to look at, so each mounts and plays its own entrance — unlike a guarded act and its
 * outcome, which share one.
 */
export const SIGN_SCENES: Record<SignStage, string> = {
  read: "read",
  sign: "sign",
};

/**
 * The stage itself: what is about to be signed, how it will be signed, and what that
 * costs if it is wrong.
 *
 * A single column at reading width, centred in the canvas while there is room for it —
 * the queues' overlay is as tall as the document needed, and a form pinned to the top of
 * that much air reads as the leftovers of the stage before it. `my-auto` rather than
 * `justify-center` on the scroller: auto margins give way to overflow, so a stage taller
 * than the window still starts at the top and stays reachable.
 *
 * **No card under it**, which is a departure from the other staged overlays and a
 * measured one. Every part of this stage already carries its own edge — the info banner,
 * the `bg-card` choice pills, the bordered code boxes, the dashed drop target — so there
 * is no unbordered muted box for the Laws to object to. And the width does not survive
 * one: at 375px the panel is 343px, the canvas takes 16px a side and a card would take
 * 16px more, leaving 279px for a row of six 40px code boxes and five 8px gaps, which
 * needs 280px. The e-sign step would overflow its own window by a pixel.
 */
export function SignatureStage({
  noun,
  subject,
  warning,
  download,
  choice,
}: {
  /** What the paper is called — form, order, process, bail bond. */
  noun: string;
  subject: string;
  /**
   * What the act means, said at the moment of the act. Omitted where the queue has
   * already said it on the stage before this one.
   */
  warning?: string;
  /**
   * Offered where the paper is off-screen and there is one document to offer. Optional
   * when the caller never had the paper on screen — the order composer did not, and
   * offering a file of an unissued order would claim a court record. The queues still
   * pass it: their document is one stage behind.
   */
  download?: { prompt: string; onDownload: () => void };
  choice: SignatureChoice;
}) {
  return (
    <div className="mx-auto my-auto flex w-full max-w-xl flex-col gap-4">
      <SignatureFields
        choice={choice}
        noun={noun}
        subject={subject}
        download={download}
      />

      {warning ? (
        /* The irreversible line, with its lock, so it is read (skill `feedback-states`). */
        <IrreversibleNote className="mt-0">{warning}</IrreversibleNote>
      ) : null}
    </div>
  );
}

/**
 * What the footer offers on that stage, in the overlay's own chrome.
 *
 * Back returns to the paper — a stage change now, not a dialog swap — and is omitted
 * where the signature *is* the first stage: there is nothing behind it, and a Back that
 * only closed would compete with the close button for one job. Submit is the act, and
 * stays shut until the chosen method has what it needs.
 */
export function SignatureActions({
  choice,
  onBack,
  onSubmit,
}: {
  choice: SignatureChoice;
  onBack?: () => void;
  onSubmit: () => void;
}) {
  return (
    <>
      {onBack ? (
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
      ) : null}
      <Button type="button" disabled={!choice.canSubmit} onClick={onSubmit}>
        Submit
      </Button>
    </>
  );
}
