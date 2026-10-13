"use client";

/**
 * The outgoing advocate's side of removal-by-consent (scenario 3b): the
 * request lands as a row of the case Overview's Pending-tasks card — the
 * same berth the bond lifecycle uses — and the respond dialog carries the
 * grounds, the document, and the one decision.
 *
 * A single screen, no stepper: reading a request and deciding it is one
 * act. Accepting steps you off the vakalatnama (the consent IS the
 * approval); rejecting sends the requester back towards the magistrate.
 * Both endings say so in the done stage.
 *
 * Fixture-driven, like the rest of the demo world: the pack below says
 * which cases carry a live request. The fixture pass at the end of the
 * phase extends it (and mirrors the request into the requester's view).
 */

import {
  PendingTaskRow,
  TaskNote,
} from "@/components/cases/case-overview-card";
import { useState, type ReactNode } from "react";
import {
  CheckCircle2Icon,
  DownloadIcon,
  InfoIcon,
  Maximize2Icon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionRow,
  DescriptionTerm,
} from "@/components/ui/description-list";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { FlowDialogContent } from "@/components/chrome/flow-dialog";
import { displayName } from "@/lib/cases/names";

type RemovalConsentFixture = {
  /** The advocate who raised the request. */
  requester: string;
  /** The party whose vakalatnama the viewer would come off. */
  party: string;
  grounds: string;
  document: string;
  /** The attached letter's substance, one paragraph per entry. */
  documentBody: string[];
  requestedOn: string;
};

/** Cases carrying a live removal request against the signed-in advocate. */
const REMOVAL_CONSENT_PACK: Record<string, RemovalConsentFixture> = {
  "c-1001": {
    requester: "Adv. Ramesh Menon",
    party: "Sunil Varghese",
    grounds:
      "The client has consolidated the brief with one counsel ahead of the evidence stage and has asked that co-counsel be relieved.",
    document: "Client_instruction_letter.pdf",
    documentBody: [
      "I write regarding my complaint pending before the Judicial First Class Magistrate I.",
      "With the evidence stage ahead, I wish to consolidate my brief with Adv. Ramesh Menon alone, and I request that my other counsel be relieved from the vakalatnama with my thanks for the work done so far.",
      "I make this request of my own accord and have discussed it with both counsel.",
    ],
    requestedOn: "30 Aug 2026",
  },
};

/**
 * The Overview card's consent row, resolved as a hook so the card can size
 * its count and skip rendering once the request is decided — the same
 * contract `useBondTaskVisible` + `BondTaskRow` keep.
 */
export function useRemovalConsentTask(
  caseId: string,
  onArchive?: () => void
): {
  visible: boolean;
  row: ReactNode;
} {
  const [resolved, setResolved] = useState(false);
  const fixture = REMOVAL_CONSENT_PACK[caseId];
  if (!fixture || resolved) return { visible: false, row: null };
  return {
    visible: true,
    row: (
      <RemovalConsentRow
        fixture={fixture}
        onResolved={() => setResolved(true)}
        onArchive={onArchive}
      />
    ),
  };
}

function RemovalConsentRow({
  fixture,
  onResolved,
  onArchive,
}: {
  fixture: RemovalConsentFixture;
  onResolved: () => void;
  onArchive?: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <PendingTaskRow
        title="Respond to a removal request"
        respond={{ onClick: () => setOpen(true) }}
        onArchive={onArchive}
      >
        <TaskNote>
          {displayName(fixture.requester)} asks that you come off {fixture.party}&apos;s
          vakalatnama.
        </TaskNote>
      </PendingTaskRow>

      <RemovalConsentDialog
        open={open}
        onOpenChange={setOpen}
        fixture={fixture}
        onResolved={onResolved}
      />
    </>
  );
}

type Decision = "accepted" | "rejected" | null;

function RemovalConsentDialog({
  open,
  onOpenChange,
  fixture,
  onResolved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fixture: RemovalConsentFixture;
  onResolved: () => void;
}) {
  const [note, setNote] = useState("");
  const [decision, setDecision] = useState<Decision>(null);
  const [docOpen, setDocOpen] = useState(false);

  function close() {
    const decided = decision !== null;
    setNote("");
    setDecision(null);
    onOpenChange(false);
    if (decided) onResolved();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) onOpenChange(true);
        else close();
      }}
    >
      <FlowDialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        {decision ? (
          <>
            <DialogHeader className="shrink-0 px-6 py-5 pr-14 text-left">
              <div className="flex items-center gap-4">
                <span
                  className={
                    decision === "accepted"
                      ? "flex size-14 shrink-0 items-center justify-center rounded-full bg-success-muted text-success-muted-foreground"
                      : "flex size-14 shrink-0 items-center justify-center rounded-full bg-info-muted text-info-muted-foreground"
                  }
                >
                  {decision === "accepted" ? (
                    <CheckCircle2Icon className="size-7" aria-hidden />
                  ) : (
                    <InfoIcon className="size-7" aria-hidden />
                  )}
                </span>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <DialogTitle className="text-title-s font-semibold text-balance">
                    {decision === "accepted"
                      ? "Removal accepted"
                      : "Request rejected"}
                  </DialogTitle>
                  <DialogDescription>
                    {decision === "accepted"
                      ? `You come off ${fixture.party}'s vakalatnama and your access to this case ends.`
                      : `${fixture.requester} will be notified. They can still apply to the magistrate for an order.`}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <footer className="flex shrink-0 justify-end border-t border-hairline px-6 py-4">
              <Button type="button" onClick={close}>
                Done
              </Button>
            </footer>
          </>
        ) : (
          <>
            <DialogHeader className="shrink-0 gap-1.5 border-b border-hairline px-6 py-5 pr-14 text-left">
              <DialogTitle className="text-title-s font-semibold text-balance">
                Removal request
              </DialogTitle>
              <DialogDescription>
                {displayName(fixture.requester)} asks that you come off the vakalatnama for{" "}
                {fixture.party}.
              </DialogDescription>
            </DialogHeader>

            <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
              <DescriptionList>
                <ReviewRow term="Requested by">{fixture.requester}</ReviewRow>
                <ReviewRow term="Party">{fixture.party}</ReviewRow>
                <ReviewRow term="Requested on">
                  <span className="tabular-nums">{fixture.requestedOn}</span>
                </ReviewRow>
                <ReviewRow term="Grounds">
                  <span className="whitespace-pre-wrap">{fixture.grounds}</span>
                </ReviewRow>
                <ReviewRow term="Document">
                  <span className="flex min-w-0 items-center gap-1">
                    <span className="min-w-0 truncate">{fixture.document}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0 text-muted-foreground"
                      aria-label={`View ${fixture.document}`}
                      onClick={() => setDocOpen(true)}
                    >
                      <Maximize2Icon aria-hidden />
                    </Button>
                  </span>
                </ReviewRow>
              </DescriptionList>

              <Field>
                <FieldLabel htmlFor="consent-note">
                  Add a note (optional)
                </FieldLabel>
                <Textarea
                  id="consent-note"
                  className="min-h-20"
                  maxLength={300}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </Field>
            </div>

            {/* Both verbs together on the right: parked on the far left,
                Reject read as a Back button by muscle memory (owner, Sept 1). */}
            <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-hairline px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDecision("rejected")}
              >
                Reject
              </Button>
              <Button
                type="button"
                variant="destructive-solid"
                onClick={() => setDecision("accepted")}
              >
                Accept removal
              </Button>
            </footer>
          </>
        )}
      </FlowDialogContent>

      <ConsentDocumentDialog
        open={docOpen}
        onOpenChange={setDocOpen}
        fixture={fixture}
      />
    </Dialog>
  );
}

/**
 * Prototype preview: the attached letter's substance as a paper sheet, the
 * same facsimile the vakalatnama picker uses. The real portal renders the
 * stored PDF — same dialog, same trigger.
 */
function ConsentDocumentDialog({
  open,
  onOpenChange,
  fixture,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fixture: RemovalConsentFixture;
}) {
  const [downloadNotice, setDownloadNotice] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setDownloadNotice(false);
        onOpenChange(next);
      }}
    >
      <FlowDialogContent className="flex max-h-[90dvh] flex-col gap-4 overflow-hidden sm:max-w-lg">
        {/* Clear of the close control — flush against it, a save was one
            slip from a dismiss (owner, Sept 1). */}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-4 right-14 text-muted-foreground"
          aria-label={`Download ${fixture.document}`}
          onClick={() => setDownloadNotice(true)}
        >
          <DownloadIcon aria-hidden />
        </Button>
        <DialogHeader className="pr-20 text-left">
          <DialogTitle>Supporting document</DialogTitle>
          <DialogDescription>{fixture.document}</DialogDescription>
        </DialogHeader>
        {downloadNotice ? (
          <p className="text-caption text-muted-foreground">
            Downloads are not wired in this prototype.
          </p>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg bg-surface-sunken p-4">
          <div className="mx-auto flex max-w-sm flex-col gap-5 rounded-md border border-hairline bg-surface px-6 py-8">
            <div className="flex flex-col items-center gap-1 text-center">
              <p className="text-caption tracking-widest text-muted-foreground uppercase">
                Letter of instruction
              </p>
              <p className="text-body-compact font-semibold">{fixture.party}</p>
              <p className="text-caption text-muted-foreground tabular-nums">
                {fixture.requestedOn}
              </p>
            </div>
            <div className="flex flex-col gap-3">
              {fixture.documentBody.map((paragraph) => (
                <p key={paragraph} className="text-body-compact text-pretty">
                  {paragraph}
                </p>
              ))}
            </div>
            <div className="flex w-1/2 flex-col gap-1 self-end pt-4">
              <div className="h-px w-full bg-border" aria-hidden />
              <p className="text-caption text-muted-foreground">
                Signature of {fixture.party}
              </p>
            </div>
          </div>
        </div>
      </FlowDialogContent>
    </Dialog>
  );
}

function ReviewRow({
  term,
  children,
}: {
  term: string;
  children: ReactNode;
}) {
  return (
    <DescriptionRow className="grid-cols-1 sm:grid-cols-[minmax(7rem,10rem)_1fr]">
      <DescriptionTerm className="text-body-compact">{term}</DescriptionTerm>
      <DescriptionDetails className="text-body-compact">
        {children}
      </DescriptionDetails>
    </DescriptionRow>
  );
}
