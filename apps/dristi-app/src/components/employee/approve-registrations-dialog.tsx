"use client";

import * as React from "react";
import {
  ArrowRightIcon,
  ChevronDownIcon,
  CircleCheckIcon,
  CircleXIcon,
  ImageOffIcon,
} from "lucide-react";

import { DiscardQuestion, useDiscardGuard } from "@/components/chrome/discard-guard";
import {
  StagedOverlay,
  useStagedFlow,
} from "@/components/chrome/staged-overlay";
import {
  TABLE_CELL,
  TABLE_HEAD,
  TABLE_HEAD_ROW,
  tableBodyClass,
  tableRowClass,
} from "@/components/chrome/table-plate";
import { DocumentPreview } from "@/components/cases/document-preview";
import { ReviewRow } from "@/components/cases/filing-form-shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { DescriptionList } from "@/components/ui/description-list";
import {
  Dialog,
  DialogClose,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  accountTypeVariant,
  comparisonBlocks,
  identityRows,
  idCardName,
  idPhotoLabel,
  registrantNoun,
  rejectionRows,
  requestRows,
  roleLabel,
  type RegistrationRequest,
  type ComparisonBlock,
  type FactRow,
  type RowFormat,
  type WaitTone,
} from "@/lib/employee/approve-registrations";
import { cn } from "@/lib/utils";
import { Identifier } from "@/components/chrome/identifier";

/**
 * One registration request, verified and then approved or rejected — the whole decision,
 * without leaving the queue.
 *
 * Handover `REG-14` says the photograph of the Bar ID card exists **so the scrutiny
 * officer can verify** the typed claim, so the review body is built as that comparison
 * and nothing else: the values on the left, the card on the right, at the same time, one
 * saccade apart.
 *
 * **One overlay, five stages, no dialog on a dialog** (owner, 2026-09-10). Review →
 * Reject or Approve → a settled end state, each stage sliding in from the right and Back
 * sliding the previous one in from the left. Every stage past Review is a **focused**
 * step — one question, centred, nothing else on it — because a step that keeps the whole
 * review layout and drops a control into it does not read as a step at all (owner,
 * 2026-09-11, on the first build's reject stage).
 *
 * **Two shapes hold every fact here, and there is no third** (D19, D20).
 *
 * 1. `FactRow` — a term and its value, in a `DescriptionList`. Request metadata, the four
 *    submitted attributes, every rejection round.
 * 2. `ComparisonBlock` — a `Table` with a column per source. Anything where two values
 *    disagree.
 *
 * That division is the whole of the 2026-09-11 rebuild. The build before it decorated a
 * value with everything that could be said about it — two chips, a muted source line, a
 * struck-through previous value — and the owner read the result on the render as
 * *"an abomination of just information being thrown around with no particular
 * hierarchy"*. A comparison is not a decoration on a value; it is a table, and a table is
 * what tables are for. If you find yourself adding a fourth treatment inside a row, the
 * fact belongs in a table of its own.
 *
 * **Approve and Reject perform no act.** Both drop the row from the demo queue — see
 * `lib/employee/approve-registrations.ts`. No account is opened, no access is granted or
 * refused, no reason is sent and nobody is told, and the end states say so once.
 */
export function RegistrationDialog({
  request,
  next,
  onOpenChange,
  onApprove,
  onReject,
  onNext,
  onReturnFocus,
}: {
  request: RegistrationRequest | null;
  /**
   * The request the end state offers to open next — `nextInQueue` on the screen's own
   * list, so it respects the officer's search. `null` means the list is empty.
   */
  next: RegistrationRequest | null;
  onOpenChange: (request: RegistrationRequest | null) => void;
  /** Commit the demo act. Must **not** close the overlay: the end state renders after it. */
  onApprove: (request: RegistrationRequest) => void;
  /**
   * The reason comes back so the Rejected tab can show it (owner, 2026-10-07). It still
   * goes nowhere else: no notification channel is decided (`approve-registrations.md`
   * §12.1). **ENGINEERING SEAM:** when the registration service exists, it travels from here.
   */
  onReject: (request: RegistrationRequest, reason: string) => void;
  /** Open `next` in this same overlay. */
  onNext: (request: RegistrationRequest) => void;
  onReturnFocus: () => void;
}) {
  return (
    <Dialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open) onOpenChange(null);
      }}
    >
      {request ? (
        /* **Deliberately not keyed on the request.** It was, and that made "View next
           application" tear the whole `Dialog.Content` down and build it again — which
           replays Radix's own open animation, a 100ms zoom, in the middle of a session
           that never closed. The owner read exactly that as abrupt (2026-09-11). The body
           now survives the switch and resets itself instead (see `RequestBody`), so what
           changes is the record inside a window that stays put. */
        <RequestBody
          request={request}
          next={next}
          onApprove={onApprove}
          onReject={onReject}
          onNext={onNext}
          onReturnFocus={onReturnFocus}
          onClose={() => onOpenChange(null)}
        />
      ) : null}
    </Dialog>
  );
}

/* ─────────────────────────────── the stages ─────────────────────────────── */

/**
 * Where the request is in the overlay. The first three are the officer still deciding;
 * the last two are settled, and the only way out of them is Close or the next request.
 */
type Stage = "review" | "reject" | "approve" | "rejected" | "approved";

/**
 * **The role is in the title, on every stage** (owner, 2026-09-11: *"it's not evident
 * enough that I'm looking at a clerk thing or an advocate thing. I had to literally hunt
 * for where this information is"*).
 *
 * The round before gave the role a mark — a tinted tile with a glyph beside a generic
 * title, and the word in the small line under it. It failed on the render for the reason
 * worth keeping: a signal placed *beside* the thing people read is a signal they have to
 * go and find. The title is the one line in the overlay every officer reads on every
 * stage, and every stage rewrites it, so the role goes **into** it — "Review clerk
 * registration", "Approve clerk registration?", "Clerk registration approved". It is read
 * as part of the question the officer is answering, at title size, before anything else
 * on the screen. No icon, no colour, and it works for a third registrant type by adding a
 * noun.
 */
const STAGE_TITLE: Record<Stage, (role: string) => string> = {
  review: (role) => `Review ${role} registration`,
  reject: (role) => `Reject ${role} registration?`,
  approve: (role) => `Approve ${role} registration?`,
  rejected: (role) => `${capitalise(role)} registration rejected`,
  approved: (role) => `${capitalise(role)} registration approved`,
};

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * The request's own state, said once, in the header.
 *
 * `Pending approval` until the act, then the decision — in the DS's own success and
 * destructive treatments, so a settled overlay reads as accepted or refused before a word
 * of it is read (owner, 2026-09-11). The words are on the chip, so the outcome is never
 * colour alone.
 */
const STAGE_BADGE: Record<
  Stage,
  { variant: "secondary" | "success" | "destructive"; label: string }
> = {
  /* Neutral while pending — a state, and states are the neutral pill on this screen now
     (owner, 2026-09-11). The decision itself keeps green and red: that is the outcome the
     owner asked to read as accepted or refused, not a status update. */
  review: { variant: "secondary", label: "Pending approval" },
  reject: { variant: "secondary", label: "Pending approval" },
  approve: { variant: "secondary", label: "Pending approval" },
  rejected: { variant: "destructive", label: "Rejected" },
  approved: { variant: "success", label: "Approved" },
};

/**
 * **What actually changes when a stage changes** — and the answer to the owner's note
 * that approving takes two screens that feel like one act (2026-09-11).
 *
 * There are five stages but only three *scenes*. Confirming and having confirmed are the
 * same scene: the card the officer is looking at does not go anywhere, does not slide, and
 * is not replaced — a strip resolves at the top of it and the footer changes. Nothing else
 * moves. The second screen is the first screen with a stamp on it, which is as close to
 * one step as a guarded act can honestly get.
 *
 * Only a real change of scene slides.
 */
const SCENE: Record<Stage, "review" | "approve" | "reject"> = {
  review: "review",
  approve: "approve",
  approved: "approve",
  reject: "reject",
  rejected: "reject",
};

/**
 * The act's shape, which is what `useStagedFlow` reads the direction off: later in the
 * list is forward, earlier is back. Reject and Approve are siblings rather than a
 * sequence — the officer reaches one or the other from Review and returns the same way —
 * so a settled stage sits directly behind the question that produced it.
 */
const ORDER = [
  "review",
  "reject",
  "rejected",
  "approve",
  "approved",
] as const satisfies readonly Stage[];

function RequestBody({
  request,
  next,
  onApprove,
  onReject,
  onNext,
  onReturnFocus,
  onClose,
}: {
  request: RegistrationRequest;
  next: RegistrationRequest | null;
  onApprove: (request: RegistrationRequest) => void;
  onReject: (request: RegistrationRequest, reason: string) => void;
  onNext: (request: RegistrationRequest) => void;
  onReturnFocus: () => void;
  onClose: () => void;
}) {
  const [reason, setReason] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const reasonRef = React.useRef<HTMLTextAreaElement>(null);
  /* Where the overlay lands on open, and where a newly arrived request lands too — see
     `onOpenAutoFocus` below, and `landing` on the flow. */
  const factsRef = React.useRef<HTMLDivElement>(null);

  /**
   * The stage, the direction it travelled and the focus that follows it —
   * `chrome/staged-overlay.tsx`, which is where this overlay's own interaction went when
   * the owner asked for it on every court-side modal (2026-09-16).
   *
   * Everything it does here it used to do in this file. Reject lands on the textarea,
   * because writing the reason is the only thing that stage is for; every other stage
   * lands on the title, which has just changed to say what the stage is. A **different
   * request arriving** resets to Review, rises rather than slides — nothing progressed,
   * the record was replaced — and takes focus to the fact column, because the button that
   * opened this one went with the settled footer that just left.
   *
   * `onRecordChange` is the part that is still this file's business: a rejection reason
   * typed about somebody else must not survive onto the next request, and it is cleared
   * during render, so the new request is never painted carrying it.
   */
  const flow = useStagedFlow({
    order: ORDER,
    scene: SCENE,
    focus: { reject: reasonRef },
    record: request.id,
    landing: factsRef,
    onRecordChange: () => {
      setReason("");
      setTouched(false);
    },
  });
  const { stage, go } = flow;

  const empty = reason.trim() === "";
  const guard = useDiscardGuard(stage === "reject" && !empty, onClose);
  const badge = STAGE_BADGE[stage];
  const noun = registrantNoun(request.registrantKind);

  return (
    <StagedOverlay
      /* Wide, and with a *definite* height: the paper being examined is the task, and a
         reading surface that changed size between the record and the decision would be
         the same fault this frame exists to prevent. A definite height also means no
         `floor` — there would be nothing for one to do. */
      className="sm:max-w-5xl md:h-[85dvh]"
      /* Title, state, and the one string the advocate can quote — and nothing else
         (brief D16). The name is **not** here: it is a value under verification, and a
         screen that prints it as the record's title has asserted it before the officer
         looked at the card. It is the first row of Identity instead. */
      title={STAGE_TITLE[stage](noun)}
      titleRef={flow.titleRef}
      titleAside={<Badge variant={badge.variant}>{badge.label}</Badge>}
      /* No description (owner, 2026-10-07): the application number was the only thing
         here, and it is a backend reference the court never needs to read or quote. */
      /* Keyed on the request so the title, the state and the number fade in with the
         record they name — a header that swapped instantly over a body that animated was
         half the abruptness. This overlay is the one that walks from one record to the
         next without closing, which is why it is the one that needs this. */
      headerKey={request.id}
      /* The request as well as the scene: a different record has to remount the stage, or
         its `arrive` rise has nothing to play on. */
      sceneKey={`${request.id}:${flow.sceneKey}`}
      motion={flow.motion}
      /* The scenes are full-bleed columns that carry their own insets — a two-column
         reading surface cannot be inset by the frame without losing its own edges. */
      padded={false}
      /* Radix focuses the first tabbable thing it finds. With the preview's header band
         gone (D15) that is the evidence well itself — it is a scroll container, so it is
         focusable — and the overlay opened with a 3px teal ring around the whole right
         column, which reads as a selected or errored state rather than as a starting
         point. The fact column takes it instead: it is what the officer reads first, it
         is the other scroll region, and WAI-ARIA APG allows a container when a dialog
         holds this much content. Focus still moves into the dialog and is still trapped
         there; only its landing place changed. */
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        factsRef.current?.focus();
      }}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        onReturnFocus();
      }}
      {...guard.contentProps}
      footer={
        stage === "review" ? (
          <>
            {/* Soft destructive, not the solid. The DS reserves `destructive-solid` for a
                confirmed irreversible act, and a rejection here is reversible by design —
                `REG-23`: the advocate edits and resubmits, without limit. */}
            <Button
              type="button"
              variant="destructive"
              onClick={() => go("reject")}
            >
              Reject
            </Button>
            {/* The overlay's one teal button, on every stage that has one: the guarded
                act. Approval is where a credential is granted — the person can then act
                as an advocate on real §138 files — which is why there is no bulk path
                anywhere on this screen and why the photograph is opened one at a time. */}
            <Button type="button" onClick={() => go("approve")}>
              Approve
            </Button>
          </>
        ) : stage === "reject" ? (
          <>
            <Button type="button" variant="ghost" onClick={() => go("review")}>
              Back
            </Button>
            {/* "Confirm rejection", not "Reject" again: a second button with the same
                word as the one that got you here reads as nothing having happened
                (owner, 2026-09-11, on the approve pair). */}
            <Button
              type="button"
              variant="destructive"
              disabled={empty}
              onClick={() => {
                onReject(request, reason.trim());
                go("rejected");
              }}
            >
              Confirm rejection
            </Button>
          </>
        ) : stage === "approve" ? (
          <>
            <Button type="button" variant="ghost" onClick={() => go("review")}>
              Back
            </Button>
            <Button
              type="button"
              onClick={() => {
                onApprove(request);
                go("approved");
              }}
            >
              Confirm approval
            </Button>
          </>
        ) : (
          <>
            {/* What is left of the queue, in the footer beside the button that opens it —
                not inside the card that reports this request's outcome. They are two
                different subjects, and the owner read them clubbed together on the render
                as exactly that (2026-09-11). The next request is **not** named by its
                application number: a serial the officer has never seen tells them
                nothing, and the button already says what pressing it will do. */}
            {next === null ? (
              <p className="text-body-compact text-muted-foreground sm:mr-auto sm:self-center">
                No more requests are waiting.
              </p>
            ) : null}
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Close
              </Button>
            </DialogClose>
            {next ? (
              <Button type="button" onClick={() => onNext(next)}>
                View next application
                <ArrowRightIcon data-icon="inline-end" aria-hidden />
              </Button>
            ) : null}
          </>
        )
      }
    >
      {stage === "review" ? (
        <ReviewStage request={request} factsRef={factsRef} />
      ) : (
        <DecisionStage
          stage={stage}
          request={request}
          reason={reason}
          touched={touched}
          reasonRef={reasonRef}
          onChange={(value) => {
            setReason(value);
            setTouched(true);
          }}
        />
      )}
      <DiscardQuestion guard={guard} />
    </StagedOverlay>
  );
}

/* ───────────────────────────── stage: review ────────────────────────────── */

/**
 * The facts on the left, the evidence on the right, and below `md` the facts first —
 * they are what you read before you look at anything. Each column scrolls on its own once
 * there is a viewport to split, so a request on its fifth round does not push the
 * photograph off the bottom of the overlay.
 *
 * **The split is 3:2, not 1:1** (2026-09-11). The left column now holds comparison
 * tables — two values side by side, and one of them can be a name with four given names
 * in it — while the right holds one landscape card scan that stops gaining from width
 * long before the tables do. An even split is what had the owner reading the fact column
 * as cramped.
 *
 * `grid-rows-[auto_auto]` below `md` and a single `minmax(0,1fr)` row above it — the
 * recipe `ApproveCopyApplicationDialog` and `ApplicationReviewDialog` already use. Both
 * halves are load-bearing: stacked, the facts row must be `auto` or the left column
 * collapses to a 0px base behind the card's `min-h-96`; side by side, the row must be
 * `minmax(0,1fr)` to give the two columns the definite height that `md:overflow-y-auto`
 * and `height="fill"` resolve against.
 */
function ReviewStage({
  request,
  factsRef,
}: {
  request: RegistrationRequest;
  factsRef: React.RefObject<HTMLDivElement | null>;
}) {
  const rounds = rejectionRows(request);
  const changed = comparisonBlocks(request).find(
    (block) => block.id === "changed",
  );

  return (
    <div className="grid min-h-0 flex-1 grid-rows-[auto_auto] gap-6 overflow-y-auto p-6 md:grid-cols-[3fr_2fr] md:grid-rows-[minmax(0,1fr)] md:overflow-hidden">
      <div
        ref={factsRef}
        tabIndex={-1}
        className="flex min-w-0 flex-col gap-6 outline-none md:min-h-0 md:overflow-y-auto"
      >
        {/* Two groups and, on a request that has been sent back, a third. */}
        <FactGroup label="Request" rows={requestRows(request)} />
        {/* **Under Request, and open.** On a profile update, what changed is the request —
            the owner's ruling after a round with it folded into a disclosure: *"that's a
            separate thing altogether… I don't think this is too important to see hidden
            away in a drop-down"* (2026-09-11). */}
        {changed ? <ComparisonSection block={changed} /> : null}
        <FactGroup label="Identity" rows={identityRows(request)} />

        {rounds.length > 0 ? <EarlierRejections rounds={rounds} /> : null}
      </div>

      <EvidenceColumn request={request} />
    </div>
  );
}

/**
 * The evidence, and the fifth submitted value (brief D15). `REG-14` collects this
 * photograph for one purpose, so it takes the rest of the overlay's height rather than
 * sitting under the facts as a thumbnail — and it takes it **without a header band**.
 * Download and Full view are 40×40 icons on the well, which is `DocumentPreview`'s own
 * doing and not a second well hand-rolled here.
 *
 * `surface="card"`: on the tinted stage a sunken well is the stage's own tone with no
 * edge, so the photograph sits on a white sheet with a hairline instead — the same object
 * as the cards beside it, because it is the fifth attribute.
 */
function EvidenceColumn({ request }: { request: RegistrationRequest }) {
  const noun = registrantNoun(request.registrantKind);
  return (
    <DocumentPreview
      variant="quiet"
      surface="card"
      className="min-h-96 md:min-h-0"
      height="fill"
      title={idPhotoLabel(request.registrantKind)}
      source={{
        kind: "composed",
        content: (
          <IdCardPhoto
            src={request.photo.src}
            alt={`Photograph of the ${idCardName(request.registrantKind)} uploaded by ${request.fullName}`}
            noun={noun}
          />
        ),
      }}
      download={{
        href: request.photo.src,
        filename: request.photo.filename,
        label: `Download ${idPhotoLabel(request.registrantKind)}`,
      }}
    />
  );
}

/* ──────────────────────────── the decision ──────────────────────────────── */

/**
 * The act, and having acted — **one card, in one place**.
 *
 * Owner, 2026-09-11: *"the two approval screens or rejection screens feel redundant to me.
 * Is there any way to optimize it better, where it's not two steps but feels like one
 * step? Maybe masking it with motion."* And, of the settled state: *"it looks a little dull
 * and sad"*, and of the rejection: *"too alarming with the red big header, bold text and
 * everything. Tone it down, don't make it dramatic. Just clean, minimal, crafted."*
 *
 * Both notes are answered by the same move: **the confirmation and the outcome are the
 * same object.** The card is built once for the scene (`SCENE`) and survives the act, so
 * pressing Confirm does not replace a screen with another screen. What happens is that the
 * strip across its top resolves — from a neutral "You are approving" to a tinted "Account
 * created" — the body settles from a control into a record, and the card takes the raised
 * shadow it had only borrowed on hover. Nothing translates, nothing unmounts, and the
 * officer's eye never has to find its place again.
 *
 * The strip is also where the drama went. A settled state used to open with a 48px disc
 * and a title-size line in destructive ink, centred: an interstitial for a decision this
 * officer takes forty times a day. The status now lives in a 16px mark and one line of
 * body text on a pale tint — the DS's muted treatment, doing what a muted treatment is
 * for. The semantics the owner asked for the round before (green for approved, red for
 * rejected) are all still there; only their volume changed.
 */
function DecisionStage({
  stage,
  request,
  reason,
  touched,
  reasonRef,
  onChange,
}: {
  stage: Exclude<Stage, "review">;
  request: RegistrationRequest;
  reason: string;
  touched: boolean;
  reasonRef: React.RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
}) {
  const rejecting = stage === "reject" || stage === "rejected";
  const settled = stage === "approved" || stage === "rejected";
  const empty = reason.trim() === "";
  const id = `reject-${request.id}`;
  /* Name and number are the card's own heading; whatever else the flow collected is the
     list under the rule. It stays after the act rather than being trimmed away — a card
     that loses two rows the moment you press the button is a card that was replaced. */
  const [, , ...rest] = identityRows(request);

  return (
    <FocusedStage>
      <StageCard flush>
        <StatusStrip stage={stage} rejecting={rejecting} settled={settled} />

        <div className="flex flex-col items-start gap-1 px-4 py-4">
          {/* **The pill above the name, not beside the number** — where the act overlay on
              Register cases puts its state, and for the same reason: a tag that starts
              wherever the line above it ended reads as untidy rather than as a label
              (owner, 2026-09-12). It is still the one coloured pill in this flow, learned
              on the queue and recognised here, on the stage where what is being granted
              matters most. */}
          <Badge variant={accountTypeVariant(request.registrantKind)}>
            {roleLabel(request.registrantKind)}
          </Badge>
          <p
            lang={request.fullNameLang}
            className="text-title-s font-semibold text-balance"
          >
            {request.fullName}
          </p>
          {/* The number under the name: it means nothing until you know which register it
              belongs to, and the pill above has just said. */}
          <Identifier
            value={request.registrationNumber}
            label="registration number"
            className="self-start text-body-compact text-muted-foreground"
          />
        </div>
        {/* **The card the decision turns on, at a size that can carry it.** Twice sized up
            and twice read as decoration — *"too small to be useful right now… if we intend
            to show it to anchor scrutiny officers' confirm approval or confirm rejection,
            it needs to be bigger"* (owner, 2026-09-11). Beside the name it could only ever
            be a stamp, because the name needs the width. So it leaves the name's row and
            takes the card's: a band 160px tall, full width, the whole card visible. The
            officer confirming is looking at the person's Bar ID card while they do it,
            which is the one thing on this stage that is evidence rather than a label. */}
        <CardPhoto request={request} />

        {rejecting ? (
          <div className="border-t border-hairline px-4 py-4">
            {settled ? (
              /* The box does not leave — it fills in. What was a control becomes a well of
                 the same footprint holding the same words, which is what keeps the card
                 from collapsing 120px at the moment the design is claiming that nothing
                 moves (measured on the render). No label above it: the strip already says
                 the reason was sent, so the well beneath is not ambiguous, and a caption
                 here is the scaffolding the previous round removed. */
              <div className="min-h-32 rounded-lg bg-surface-sunken p-3 text-body-compact whitespace-pre-line text-pretty animate-in fade-in-0 duration-500 motion-reduce:animate-none">
                {reason}
              </div>
            ) : (
              <Field data-invalid={touched && empty}>
                {/* **The icon carries the act; the type stays out of it** (owner,
                    2026-09-11: *"instead of making it big, it should remain as a normal
                    14-pixel token, but it should have an icon in it to bring attention"*).
                    Two rounds ago this was a title-size line in destructive ink and read
                    as an alarm; one round ago it lost the mark with the size and read as
                    an ordinary form field. A 16px mark in destructive ink beside a
                    body-compact label is the measured version: the stage is legibly a
                    rejection, and nothing is shouting. */}
                <FieldLabel
                  htmlFor={id}
                  className="gap-1.5 text-body-compact font-medium"
                >
                  <CircleXIcon
                    aria-hidden
                    className="size-4 shrink-0 text-destructive-ink"
                  />
                  Why are you rejecting this?
                </FieldLabel>
                <Textarea
                  id={id}
                  ref={reasonRef}
                  className="min-h-32 text-body"
                  placeholder={`e.g. The name on the ${idCardName(request.registrantKind)} is different from the name you typed. Please check and submit again.`}
                  value={reason}
                  onChange={(event) => onChange(event.target.value)}
                />
                {/* The gate, only once it has been tripped. Red on a box nobody has
                    attempted yet reads as a scolding, and a line stating the rule before
                    it is broken is exposition. */}
                {touched && empty ? (
                  <FieldError>Write a reason first.</FieldError>
                ) : null}
              </Field>
            )}
          </div>
        ) : rest.length > 0 ? (
          <div className="border-t border-hairline px-4">
            <DescriptionList>
              {rest.map((row) => (
                <FactRowView key={row.id} row={row} />
              ))}
            </DescriptionList>
          </div>
        ) : null}
      </StageCard>

          </FocusedStage>
  );
}

/**
 * The Bar ID card, as a band across the decision card.
 *
 * A sunken well between two rules — the Laws' nested media well, inside a panel — with the
 * scan contained rather than cropped, so a tall card and a wide one both show whole.
 *
 * It removes itself when the file will not open rather than leaving an empty band in the
 * middle of the card — the review stage is where a missing photograph is explained in
 * words, and this is not the place to raise it a second time.
 *
 * It carries real alt text now. At 48px it was ornament and hid itself from assistive
 * technology; at this size it is the evidence the stage is built around.
 */
function CardPhoto({ request }: { request: RegistrationRequest }) {
  const [failed, setFailed] = React.useState(false);
  if (failed) return null;

  return (
    <div className="border-t border-hairline bg-surface-sunken p-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- a served court document,
          not a site asset: it has no build-time dimensions and must not be re-encoded. */}
      <img
        src={request.photo.src}
        alt={`${idPhotoLabel(request.registrantKind)} uploaded by ${request.fullName}`}
        onError={() => setFailed(true)}
        className="mx-auto block h-40 w-auto max-w-full rounded-md object-contain"
      />
    </div>
  );
}

/**
 * The one thing that changes when the act is performed.
 *
 * Before: a sunken strip naming what is about to happen. After: the same strip in the
 * status's own muted pair, with a 16px mark and one line saying what did. Keyed on the
 * stage so the swap re-mounts and plays its entrance — a fade and a millimetre of rise,
 * which is the whole of the "motion" the owner asked for and as much as a court screen
 * should spend on a decision taken forty times a day.
 */
function StatusStrip({
  stage,
  rejecting,
  settled,
}: {
  stage: Exclude<Stage, "review">;
  rejecting: boolean;
  settled: boolean;
}) {
  const approved = stage === "approved";

  return (
    <div
      key={stage}
      className={cn(
        "flex items-center gap-2 px-4 py-2.5 text-body-compact animate-in fade-in-0 duration-500 motion-reduce:animate-none",
        settled
          ? "slide-in-from-top-1"
          : /* White, with a rule under it, rather than a sunken fill: the fill it used to
               carry is the stage's own tone, so the card began in the page. The rule is
               what separates it from the name below, and the card's shadow is what
               separates the whole thing from the stage. */
            "border-b border-hairline text-muted-foreground",
        approved && "bg-success-muted text-success-muted-foreground",
        stage === "rejected" &&
          "bg-destructive-muted text-destructive-muted-foreground",
      )}
    >
      {settled ? (
        <>
          {approved ? (
            <CircleCheckIcon aria-hidden className="size-4 shrink-0" />
          ) : (
            <CircleXIcon aria-hidden className="size-4 shrink-0" />
          )}
          {/* `role="status"` gets the outcome spoken: focus lands on the header title,
              which announces itself and nothing below it. */}
          {/* **What happened to the account, not what happened to the reason** (owner,
              2026-09-11: *"the actual action here was the account didn't get created…
              reason sent to advocate is just a byproduct"*). The two strings are now a
              pair — created / rejected — so the strip reports the same kind of fact
              whichever way the decision went, and the reason sitting in the well below
              needs no sentence to explain that it was sent. */}
          <span role="status" className="font-medium">
            {approved ? "Account created" : "Account rejected"}
          </span>
        </>
      ) : (
        <span className="font-medium">
          {rejecting ? "You are rejecting" : "You are approving"}
        </span>
      )}
    </div>
  );
}

/* ──────────────────────────── the two shapes ────────────────────────────── */

/**
 * A stage that asks one thing: a single centred column, vertically centred once there is
 * room for it.
 *
 * Every stage past Review takes this, so progressing through the overlay is visibly a
 * progression — the two-column review layout belongs to reading, and reading is done.
 */
function FocusedStage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto p-6">
      <div className="flex w-full max-w-xl flex-col gap-6 md:my-auto">
        {children}
      </div>
    </div>
  );
}

/**
 * A white card on the tinted stage — the one container every group composes from.
 *
 * The DS `Card`, sized `sm` so its padding is the 16px a row wants, with the app's panel
 * edge (`border-hairline`) in place of the primitive's full `border-border`: on a tinted
 * stage the fill difference already separates the card, and the hairline is a soft edge
 * rather than a stroke (ui-craft §4). It lifts on hover and on focus-within the way the
 * product's other cards do (`companion-rail.tsx`), with `transition-shadow` so only the
 * thing that changes animates.
 */
function StageCard({
  className,
  flush = false,
  children,
}: {
  className?: string;
  /** The card's own padding is off; the children draw their own rules edge to edge. */
  flush?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card
      size="sm"
      className={cn(
        /* **Lifted at rest, always.** The pre-act strip is `surface-sunken` and the stage
           under it is `muted` — measured 1.01:1 against each other, so the top of the card
           dissolved into the page and the owner read the header as unreadable
           (2026-09-11). A panel on a tinted stage is exactly what ui-craft §1 lifts with
           a shadow rather than separating with a stroke; the shadow was previously
           rationed to hover, which is a state a card on a decision screen is mostly not
           in. */
        "border-hairline shadow-raised",
        flush && "gap-0 py-0",
      )}
    >
      {flush ? (
        children
      ) : (
        <CardContent className={cn("flex flex-col gap-4", className)}>
          {children}
        </CardContent>
      )}
    </Card>
  );
}

/**
 * A group's name, above whatever the group holds.
 *
 * The label is scaffolding and reads as scaffolding — `text-caption` muted — so the
 * values inside are what the eye lands on.
 */
function GroupHeading({ label }: { label: string }) {
  return (
    <h3 className="text-caption font-semibold text-muted-foreground">
      {label}
    </h3>
  );
}

/**
 * Shape one: terms and values, in a card.
 *
 * `DescriptionList` because that is the DS's named role for it — the Laws say
 * "Description list inside Card for a single record's key-value fields" — and because a
 * two-column table with no header is a description list wearing a table's markup.
 */
function FactGroup({ label, rows }: { label: string; rows: FactRow[] }) {
  return (
    <section className="flex flex-col gap-2">
      <GroupHeading label={label} />
      <StageCard className="gap-0">
        <DescriptionList>
          {rows.map((row) => (
            <FactRowView key={row.id} row={row} />
          ))}
        </DescriptionList>
      </StageCard>
    </section>
  );
}

/** Plain at rest; the exception gets the ink. The queue cell's own map (brief D6). */
const toneClass: Record<WaitTone, string> = {
  plain: "",
  warning: "text-warning-ink",
  destructive: "text-destructive-ink",
};

/**
 * How a value is set.
 *
 * `email` gets `break-all` alone among the four: an address has no space in it, so normal
 * wrapping has nowhere to break and the value runs out of the card's right edge. A name
 * wraps on its spaces and a Bar ID is short, so neither needs this and neither should
 * have it — a mid-syllable break in a Malayalam name is a worse read than a wrapped line.
 */
const formatClass: Record<RowFormat, string> = {
  text: "",
  code: "font-mono tabular-nums",
  figure: "tabular-nums",
  email: "break-all",
};

/**
 * One fact.
 *
 * A term, a value, and — on a rejection round — the date it belongs to. Nothing else
 * attaches here; a comparison is a `ComparisonTable`, which is the whole point of
 * having two shapes instead of one row that grows a treatment per scenario.
 */
function FactRowView({ row }: { row: FactRow }) {
  const value = row.pill ? (
    /* A category, shown as the same pill everywhere it appears — the queue's Account type
       column included. */
    <Badge variant={row.pill}>{row.value}</Badge>
  ) : row.format === "code" ? (
    /* The one identifier among these facts — the registration number, which the officer
       reads against the card. It takes the product's one identifier treatment rather
       than a local mono class. */
    <Identifier
      value={row.value}
      label={row.term.toLowerCase()}
      className={cn("min-w-0", row.tone && toneClass[row.tone])}
    />
  ) : (
    <span
      lang={row.valueLang}
      className={cn(
        "block min-w-0 whitespace-pre-line",
        formatClass[row.format],
        row.tone && toneClass[row.tone],
      )}
    >
      {row.value}
    </span>
  );

  return (
    /* Hairline, not the DS row default: `border-border` between rows inside a card would
       be the loudest mark in the overlay (ui-craft §1.1). */
    <ReviewRow term={row.term} className="border-hairline">
      {value}
      {row.note ? (
        <span className="mt-1 block text-caption tabular-nums text-muted-foreground">
          {row.note}
        </span>
      ) : null}
    </ReviewRow>
  );
}

/**
 * Shape two: two values side by side, under headers naming where each came from.
 *
 * This is what the struck-through "Was …" line and the "Bar Council of Kerala: …" line
 * became. A strikethrough says a value is gone without saying what replaced it, and it
 * puts both values in one cell of one column — the owner's objection, exactly: *"it
 * should clearly show what was before and after… all in a clean tabular format so it's
 * scannable"* (2026-09-11).
 *
 * It is the **product's own table treatment** (`chrome/table-plate`), the one the queue
 * behind this overlay wears, so an officer who scans the list and then opens a request
 * reads the same grid twice. That was the other half of the note — *"everywhere I am
 * seeing a new unique way of this being implemented… UI should be scalable"* — and the
 * answer to it is not a new component but the shared one.
 *
 * `hover: false`: nothing in these rows is live, and a fill that lights under the pointer
 * promises an act the row does not perform (`table-plate`).
 */
/**
 * A comparison that is a section of its own: a heading naming the group, a card, a table
 * whose first column names each attribute. Used where several attributes change at once —
 * a profile update touches three of them in the demo data — so a column per source is
 * what makes it scannable (D20).
 */
function ComparisonSection({ block }: { block: ComparisonBlock }) {
  return (
    <section className="flex flex-col gap-2">
      <GroupHeading label={block.label} />
      <StageCard>
        <ComparisonTable block={block} />
      </StageCard>
    </section>
  );
}

function ComparisonTable({ block }: { block: ComparisonBlock }) {
  const span = block.columns.length + 1;

  return (
    <>
      {/* Two values plus a term do not fit 375px, and the `Card` clips what overflows
          it — measured on the render, the second value was cut off the right edge
          and unreachable. So the table scrolls inside its own container, the way the
          queue's does, and the page never scrolls sideways. */}
      <div className="min-w-0 overflow-x-auto">
        <Table className="w-full border-separate border-spacing-0 text-body-compact">
          <TableHeader>
            {/* The card insets this table, so the header strip is a well and rounds
                itself rather than running edge to edge (`TABLE_HEAD_ROW`, ui-craft §4). */}
            <TableRow className={TABLE_HEAD_ROW}>
              <TableHead className={cn(TABLE_HEAD, "w-28")}>
                {/* The corner cell of a comparison table names nothing — the row's own
                    term is the label. Named for a screen reader, which reads a header
                    cell for every column it announces. */}
                <span className="sr-only">Detail</span>
              </TableHead>
              {block.columns.map((column) => (
                <TableHead
                  key={column}
                  className={cn(TABLE_HEAD, "whitespace-nowrap")}
                >
                  {column}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody className={tableBodyClass({ hover: false })}>
            {/* `border-separate` has no per-edge row gap, so the gap under the header
                well is one inert row held out of the accessibility tree. */}
            <tr aria-hidden="true">
              <td colSpan={span} className="h-2 p-0" />
            </tr>
            {block.rows.map((row) => (
              <TableRow
                key={row.id}
                className={tableRowClass({ hover: false })}
              >
                <TableCell
                  className={cn(TABLE_CELL, "align-top text-muted-foreground")}
                >
                  {row.term}
                </TableCell>
                {row.values.map((value, index) => (
                  <TableCell
                    key={block.columns[index]}
                    lang={value.lang}
                    className={cn(
                      TABLE_CELL,
                      "align-top",
                      formatClass[value.format],
                      value.absent && "text-muted-foreground",
                    )}
                  >
                    {value.text}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

/**
 * Every round this request has already been refused — newest first, all of them the same
 * row (brief D7).
 *
 * The newest is always visible, because the question a resubmission asks is "did they fix
 * what I said last time". The rest collapse, so the group cannot grow without bound on a
 * request that has come back five times (`REG-23` sets no limit). The `Collapsible`
 * governs how many are visible; it does not change how any of them look.
 *
 * There is no per-round "Rejected" chip: every round in this group was a rejection — an
 * approved request leaves the queue — so the chip would mark the norm. The group's name
 * carries it.
 */
function EarlierRejections({ rounds }: { rounds: FactRow[] }) {
  const [newest, ...older] = rounds;

  return (
    <section className="flex flex-col gap-2">
      <GroupHeading label="Earlier rejections" />
      <StageCard className="gap-0">
        <DescriptionList>
          <FactRowView row={newest} />
        </DescriptionList>
        {older.length > 0 ? (
          <Collapsible>
            {/* Styled off `TaskDetailPanel`'s history disclosure — the same job: a muted
                caption that darkens on hover, one chevron that turns, and the DS focus
                ring. `min-h-10` keeps the DS's 40px floor on a target an officer reaches
                on a tablet. */}
            <CollapsibleTrigger className="group/earlier flex min-h-10 w-fit items-center gap-1.5 rounded-lg text-left text-caption text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-focus-ring">
              {older.length === 1
                ? "1 earlier round"
                : `${older.length} earlier rounds`}
              <ChevronDownIcon
                aria-hidden
                className="size-4 shrink-0 transition-transform group-data-[state=open]/earlier:rotate-180"
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <DescriptionList>
                {older.map((row) => (
                  <FactRowView key={row.id} row={row} />
                ))}
              </DescriptionList>
            </CollapsibleContent>
          </Collapsible>
        ) : null}
      </StageCard>
    </section>
  );
}

/**
 * The photograph itself.
 *
 * It is an `<img>` inside `DocumentPreview`'s composed well rather than the well's `src`
 * branch, which renders an `<iframe>`. An iframe reports neither load nor failure, and
 * both states are ones this screen has to answer: a card photograph is a file coming down
 * a court's connection, so it is sometimes slow, and sometimes it is not there.
 *
 * A failure says so in words and keeps Download reachable. **It does not block the
 * decision**: the officer may hold the card another way, and an empty box that left them
 * to infer what happened would be worse than a sentence.
 */
function IdCardPhoto({
  src,
  alt,
  noun,
}: {
  src: string;
  alt: string;
  noun: string;
}) {
  const [status, setStatus] = React.useState<"loading" | "ready" | "failed">(
    "loading",
  );

  return (
    /* `flex-1` so the card scan takes the height the frame gives it rather than sitting
       small in the middle of a tall white column — the other half of the owner's note
       about the evidence section looking empty (2026-09-11). */
    <div className="flex min-h-64 flex-1 flex-col justify-center">
      {status === "failed" ? (
        <div className="m-auto flex flex-col items-center gap-3 py-8 text-center">
          <ImageOffIcon className="size-10 text-muted-foreground" aria-hidden />
          <p className="text-body font-medium">
            This photo could not be opened
          </p>
          <p className="text-body-compact text-muted-foreground">
            Try downloading it. You can still decide this request — or reject it
            and ask the {noun} to upload the card again.
          </p>
        </div>
      ) : null}
      {/* The well keeps its height while the file is on its way. A well that collapses
          and then jumps to full height moves the decision under the officer's cursor. */}
      {status === "loading" ? (
        <Skeleton className="h-64 w-full rounded-md" />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element -- a served court document,
          not a site asset: it has no build-time dimensions and must not be re-encoded. */}
      <img
        src={src}
        alt={alt}
        onLoad={() => setStatus("ready")}
        onError={() => setStatus("failed")}
        className={cn(
          "m-auto block h-auto max-h-full w-auto max-w-full rounded-md object-contain",
          status !== "ready" && "hidden",
        )}
      />
    </div>
  );
}
