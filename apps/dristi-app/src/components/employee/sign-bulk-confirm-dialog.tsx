"use client";

import * as React from "react";

import {
  StagedOverlay,
  useStagedFlow,
} from "@/components/chrome/staged-overlay";
import { PANEL_CLASS } from "@/components/shell/panel";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionRow,
  DescriptionTerm,
} from "@/components/ui/description-list";
import { Dialog, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { IrreversibleNote, OutcomeHeader, OutcomeSummary } from "@/components/feedback";

/**
 * What the court is acting on in bulk.
 *
 * Four of the five plurals are a regular `-s`, so the copy builds those and the table
 * below holds only the one that is not.
 */
export type SignBulkNoun =
  | "form"
  | "order"
  | "bail bond"
  | "deposition"
  | "process";

const IRREGULAR_PLURALS: Partial<Record<SignBulkNoun, string>> = {
  process: "processes",
};

function pluralise(noun: SignBulkNoun): string {
  return IRREGULAR_PLURALS[noun] ?? `${noun}s`;
}

/**
 * The act, in the five places this dialog speaks it.
 *
 * Signing is the default and the reason the dialog exists. But the line that carries
 * court process has three acts on one screen — a collected cover sent for signature, a
 * signature, a dispatch — and all three want this same two-step shape, so the verb is a
 * parameter rather than three more copies of the component. A caller that passes nothing
 * gets the signature copy the four single-act queues have always had, word for word.
 *
 * Functions rather than strings because the dialog counts for itself: the success step
 * reports the selection the act consumed, which by then is no longer the caller's live
 * count (see `signed` in the body).
 */
export type SignBulkAct = {
  /** The question, over "this order" / "8 orders". */
  question: (subject: string) => string;
  /** What the act means, said at the moment of it. */
  meaning: (one: boolean) => string;
  /** The success heading, over "order" / "8 orders" — the bare noun, not the subject. */
  done: (phrase: string) => string;
  /** Where the rows went. */
  outcome: (one: boolean) => string;
  /** The button that commits it. */
  confirm: string;
};

/** What every queue said before there was a second act, and what they still say. */
function signatureAct(noun: SignBulkNoun): SignBulkAct {
  return {
    question: (subject) => `Sign ${subject}?`,
    meaning: (one) =>
      one
        ? `Your signature goes on the ${noun}. This cannot be reversed.`
        : `Your signature goes on every ${noun} selected. This cannot be reversed.`,
    done: (phrase) => `${capitalise(phrase)} signed`,
    outcome: (one) =>
      one
        ? "It has left the signing queue."
        : "They have left the signing queue.",
    confirm: "Sign",
  };
}

/**
 * The selection, as facts rather than as rows.
 *
 * Given per document and in list order so the dialog does the counting once, in one
 * place, instead of four screens each reducing the same shapes differently.
 */
export type SignBulkSelection = {
  /** Case number per document. */
  cases: string[];
  /**
   * Kind label per document — the process for a form, the type for an order.
   *
   * Omitted where the queue has no kind axis: every bail bond is a bail bond, and every
   * deposition is one witness's evidence, so a breakdown there would be the count
   * written twice.
   */
  kinds?: string[];
};

/** Where the act is: about to happen, and having happened. */
type Stage = "confirm" | "success";

/** Both stages, in the order the act moves through them. */
const ORDER = ["confirm", "success"] as const;

/**
 * **Two stages, one scene** — and the second fact is the whole of this rewrite.
 *
 * A scene is what the reader is looking at, and asking the bench to commit and telling
 * it what the commitment did are the *same* thing looked at twice: the same count, the
 * same breakdown, the same cases, in the same card, in the same place on the screen.
 * Only the strip across the top of that card changes — the sentence warning what the act
 * will do becomes the sentence reporting what it did, on the product's success fill.
 *
 * Stages that share a scene do not remount, and mounting is what plays an entrance, so
 * the settled stage never slides. That is the registrations overlay's rule, settled by
 * the owner on 2026-09-11 (approving *"takes two screens that feel like one act"*) and
 * carried here with it.
 */
const SCENE: Record<Stage, string> = { confirm: "act", success: "act" };

/**
 * Confirming a bulk act — the one dialog every court-side signing queue uses.
 *
 * The four single-act queues each grew their own version of this moment: two of them an
 * `AlertDialog` asking a one-line question, two of them a two-step `Dialog` that went on
 * to ask how the bench would sign. Four confirmations for one act, each phrased
 * differently, is four chances for the bench to read the same button as meaning
 * different things. This is that moment, once — and since the process line added three
 * acts on one screen, the verb is a parameter (`SignBulkAct`) while the shape is not.
 *
 * Two stages, and the second is the point of the dialog. Pressing Sign commits and
 * *stays* — the overlay settles into its outcome instead of vanishing and leaving the
 * bench to infer from a shorter list that anything happened. A single Done dismisses it.
 *
 * **And it now settles rather than swaps.** Until this pass the header, the body and the
 * footer all lived inside the step conditional, so one press replaced every pixel of the
 * window in a single frame with no movement at all — the abruptness the owner ruled out
 * for every court-side modal (2026-09-16: *"everything should happen in one modal with
 * all those motion+interaction"*). Three things were doing it, and the shared frame
 * (`StagedOverlay`) fixes all three: the chrome holds still on both stages, the window
 * keeps its height, and the outcome resolves in the card it was signed in.
 *
 * **What that cost, and why the confirmation is still the product's confirmation.** The
 * old ending was a detached solid success panel carrying its own heading and a 40px tick
 * chip, with the facts in a sunken well beneath — the shape the advocate side ends a
 * submission on (`cases/add-signature-dialog.tsx`), adopted on 2026-09-15 because a bulk
 * act and a submission must not end on two different kinds of object. That ruling stands
 * and the object holds: solid success fill, a tick, and the facts directly under it.
 * What changed is that the fill is the top band of the card those facts were already in
 * rather than a panel that replaces the window, the tick is the mark a band can carry
 * rather than a chip as tall as the band itself, and the heading is the header's —
 * because the header is still there, and two headings stating one outcome is one too
 * many. `bulk-reschedule-screen.tsx` made the same trade first; this is its sibling.
 *
 * A `Dialog` rather than an `AlertDialog`: the flow no longer ends on the decision, and
 * an alert has neither a second stage nor a close affordance.
 *
 * The bulk path asks for no signature method. Choosing between e-sign and an upload is a
 * question about *one* document the bench has read; the queues' single-document paths
 * still ask it, and this path — where nothing was opened — no longer does.
 *
 * `onConfirm` runs each screen's own demo act, which drops the rows from its queue.
 */
export function SignBulkConfirmDialog({
  noun,
  act,
  count,
  selection,
  open,
  onOpenChange,
  onConfirm,
  onDownload,
  triggerRef,
  onReturnFocus,
}: {
  noun: SignBulkNoun;
  /** The verb, where it is not a signature. Omitted, the dialog signs. */
  act?: SignBulkAct;
  /** How many rows the act will take. Read once per opening — see the body. */
  count: number;
  selection: SignBulkSelection;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Commit the demo act — the screen's own `sign` / `onSign` handler.
   *
   * It must **not** close the dialog: the settled stage is what the bench sees next, and
   * closing here would take it away before it rendered.
   */
  onConfirm: () => void;
  /**
   * Take the papers away, offered on the settled stage only.
   *
   * Optional, and the four single-act queues pass nothing — their footer is the single
   * Done it has always been. The process line passes it because that is the one screen
   * where the rows are worth having in hand the moment they are signed.
   *
   * **It must resolve the rows again, not close over the ones it was given.** By the time
   * this can be clicked the act has run: the rows have moved stage and been stamped, and
   * a copy captured before that would write "Pending the signature of the magistrate"
   * across ten papers the bench has just signed. The screen keeps the ids and reads them
   * back off its own list — see `SignProcessScreen`.
   */
  onDownload?: () => void;
  /**
   * The sticky-bar button this was opened from, to hand focus back to on the way out.
   *
   * Named rather than inferred: Radix's modal dialog restores focus to a
   * `DialogTrigger`, and these four are opened from a button that is not one, so left
   * alone it restores to nothing and the bench loses the keyboard mid-queue.
   */
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  /**
   * Where focus goes when that button cannot take it back — the screens' search field.
   *
   * Signing empties the selection, which disables the button, so a committed run has
   * nowhere to return to.
   */
  onReturnFocus: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Closed renders nothing, so the body unmounts and its stage and captured facts go
          with it. Re-opening therefore starts at the question with the current selection
          rather than inheriting the last run's. Radix still hands `onCloseAutoFocus` out
          of its own focus-scope cleanup on the way, so the keyboard is not dropped by
          this. */}
      {open ? (
        <SignBulkConfirmBody
          noun={noun}
          act={act ?? signatureAct(noun)}
          count={count}
          selection={selection}
          onClose={() => onOpenChange(false)}
          onConfirm={onConfirm}
          onDownload={onDownload}
          triggerRef={triggerRef}
          onReturnFocus={onReturnFocus}
        />
      ) : null}
    </Dialog>
  );
}

function SignBulkConfirmBody({
  noun,
  act,
  count,
  selection,
  onClose,
  onConfirm,
  onDownload,
  triggerRef,
  onReturnFocus,
}: {
  noun: SignBulkNoun;
  act: SignBulkAct;
  count: number;
  selection: SignBulkSelection;
  onClose: () => void;
  onConfirm: () => void;
  onDownload?: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  onReturnFocus: () => void;
}) {
  /* The stage, the direction it travelled and where focus lands, from the shared frame.
     There is no direction to travel here — both stages share one scene — so what this
     contributes is the settling: no remount, no slide, and focus moved to the header
     line that has just rewritten itself. */
  const flow = useStagedFlow({ order: ORDER, scene: SCENE });
  const done = flow.stage === "success";

  /* What the settled stage reports, taken before the act consumes it. Signing clears the
     selection and drops the rows, so by the time that stage renders the live figures are
     zero — they have to be the ones that were committed, not the ones left behind. It is
     also why the card is worth keeping after the act: these rows have just left the queue
     that listed them, and this is the last place they can be read.

     Captured on the first render rather than at the press, because the same figures are
     what the question is asked over: the card states them once and cannot disagree with
     itself across the act. */
  const [signed] = React.useState(() => ({
    count,
    cases: new Set(selection.cases).size,
    kinds: selection.kinds ? tally(selection.kinds) : [],
  }));

  const one = signed.count === 1;
  const many = `${signed.count} ${pluralise(noun)}`;
  /* Two ways of naming the same rows: the question asks about "this order", the settled
     heading reports "Order signed". Both are built from the captured count, never the
     live one. */
  const subject = one ? `this ${noun}` : many;
  const phrase = one ? noun : many;

  return (
    <StagedOverlay
      className="sm:max-w-lg"
      /* The one line that rewrites itself, and therefore the line that carries the
         outcome: the question before the act, what the act did after it. The header
         stays up across both stages — dropping it so a success panel could carry its own
         heading was precisely the moment this overlay stopped looking like the overlay. */
      title={done ? act.done(phrase) : act.question(subject)}
      titleRef={flow.titleRef}
      /* No line under the title. What describes this window at both moments is the card
         below — the sentence in its band and the figures under it — and the dialog is
         pointed at that sentence directly (the band's `DialogDescription`) rather than at
         a second one written for the header to have something to say. */
      sceneKey={flow.sceneKey}
      motion={flow.motion}
      /* The window has no definite height and the card grows a line when the act's
         warning wraps, so without a floor the panel would shrink and re-centre itself
         under the bench at the exact moment this design is claiming that nothing moves.
         The floor takes that difference inside the canvas instead. */
      floor
      /* The settled stage takes the window over: mark, then title (owner, Oct 29). */
      outcome={done}
      onCloseAutoFocus={(event) => {
        /* Backing out returns the bench to the button it left; signing sends it to the
           search field, because signing is what disabled that button — and on the queues
           whose bar goes away with the last signable row, took it off the page. */
        event.preventDefault();
        const trigger = triggerRef.current;
        if (!done && trigger?.isConnected && !trigger.disabled) {
          trigger.focus();
          return;
        }
        onReturnFocus();
      }}
      footer={
        done ? (
          <>
            {/* The rows have just left the queue that listed them, and the bar that could
                have downloaded them went with the selection. One bordered action beside
                the strong one, the same pair the sticky bar makes — the count is the
                dialog's own captured one, so it agrees with the heading above it. */}
            {onDownload ? (
              <Button
                type="button"
                variant="outline"
                className="tabular-nums"
                onClick={onDownload}
              >
                Download {signed.count}{" "}
                {signed.count === 1 ? "document" : "documents"}
              </Button>
            ) : null}
            <Button type="button" onClick={onClose}>
              Done
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variant="outline" onClick={onClose}>
              Back
            </Button>
            <Button
              type="button"
              onClick={() => {
                onConfirm();
                /* The act does not travel: `go` leaves the direction alone when the
                   stage stays in the scene it is already in, so the card settles where
                   it stands instead of sliding in as though something had replaced it. */
                flow.go("success");
              }}
            >
              {act.confirm}
            </Button>
          </>
        )
      }
    >
      {/* Centred in the canvas while there is room for it, and pushed back to the top by
          its own content when there is not — `my-auto` gives way to overflow, which a
          `justify-center` on the scroller would not. */}
      {done ? (
        <>
          <OutcomeHeader
            titleFrom="dialog"
            focusTitle
            surface="card"
            title={act.done(phrase)}
            body={act.outcome(one)}
          />
          <div className="mx-auto flex w-full max-w-xl flex-col p-4 sm:p-6">
            <OutcomeSummary>
              <SignedFigures signed={signed} />
            </OutcomeSummary>
          </div>
        </>
      ) : (
        <div className="my-auto flex w-full flex-col">
          <ActCard act={act} one={one} signed={signed} />
        </div>
      )}
    </StagedOverlay>
  );
}

/** The captured selection, counted once. */
type Signed = {
  count: number;
  cases: number;
  kinds: { label: string; count: number }[];
};

/**
 * What the act is about to do, and — **in the same card, in the same place** — what it
 * did.
 *
 * One object across both stages. The figures under the band are identical before the act
 * and after it, because they are the same captured figures: the bench is looking at the
 * rows it ticked, and then at the rows it committed, which are the same rows. So nothing
 * is replaced, nothing collapses, and the only thing that changes is the band across the
 * top — the sentence saying what the act will do gives way to the sentence saying where
 * the rows went, on the product's success fill with the tick beside it.
 *
 * **The band is the product's success treatment at the size a band can carry it.** Solid
 * `bg-success` with its own ink and a tick, the facts directly beneath: the composition
 * the advocate submission and every signing queue end on (2026-09-15). What it is not
 * any more is a detached panel that replaces the window and carries its own heading —
 * the heading is the dialog's, because the frame stays up.
 *
 * Before the act the band is white over a rule rather than a tint: the tint it would
 * otherwise carry is the stage's own tone, which is how the top of a card ends up
 * dissolving into the canvas behind it.
 *
 * **The figures are the two the bench cannot get anywhere else at this moment**, having
 * opened none of these documents and covered the list it ticked them in. What kinds are
 * in the run, and how many *cases* they touch — a queue counts documents, and eight
 * documents can be six files.
 */
function ActCard({
  act,
  one,
  signed,
}: {
  act: SignBulkAct;
  /** Whether the run is a single document, which is what the copy branches on. */
  one: boolean;
  signed: Signed;
}) {
  /* "This cannot be reversed." on its own line with a lock, so it is read, not skimmed. */
  const meaning = act.meaning(one);
  const [lead, irreversible] = meaning.endsWith(IRREVERSIBLE)
    ? [meaning.slice(0, -IRREVERSIBLE.length).trimEnd(), IRREVERSIBLE.trim()]
    : [meaning, null];
  return (
    /* Flush: the band and the rows draw their own rules edge to edge, so the card's own
       padding is off and `overflow-hidden` is what keeps the band inside the radius. */
    <Card size="sm" className={cn(PANEL_CLASS, "gap-0 overflow-hidden py-0")}>
      <div className="border-b border-hairline px-4 py-3">
        {/* The dialog's description, in the card rather than in the header. */}
        <DialogDescription className="text-body text-pretty text-muted-foreground">
          <span className="block">{lead}</span>
          {irreversible ? <IrreversibleNote>{irreversible}</IrreversibleNote> : null}
        </DialogDescription>
      </div>
      <div className="px-4">
        <SignedFigures signed={signed} />
      </div>
    </Card>
  );
}

const IRREVERSIBLE = " This cannot be reversed.";

/** What kinds are in the run and how many cases it touches: the same figures before the
    act and after it. */
function SignedFigures({ signed }: { signed: Signed }) {
  return (
    <DescriptionList>
      {signed.kinds.map((kind) => (
        <DescriptionRow
          key={kind.label}
          className="grid-cols-[1fr_auto] items-center border-hairline"
        >
          <DescriptionTerm className="text-body">{kind.label}</DescriptionTerm>
          <DescriptionDetails className="text-body tabular-nums">
            {kind.count}
          </DescriptionDetails>
        </DescriptionRow>
      ))}
      <DescriptionRow className="grid-cols-[1fr_auto] items-center border-hairline">
        <DescriptionTerm className="text-body">Cases</DescriptionTerm>
        <DescriptionDetails className="text-body tabular-nums">
          {signed.cases === 1 ? "1 case" : `${signed.cases} cases`}
        </DescriptionDetails>
      </DescriptionRow>
    </DescriptionList>
  );
}

/** Sentence case, so the noun only rises to a capital when it opens the line. */
function capitalise(noun: string): string {
  return noun.charAt(0).toUpperCase() + noun.slice(1);
}

/** How many of each kind, in the order the kinds first appear down the list. */
function tally(labels: string[]): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  return [...counts].map(([label, count]) => ({ label, count }));
}
