"use client";

import * as React from "react";
import { CircleCheckIcon, TriangleAlertIcon } from "lucide-react";

import {
  StagedOverlay,
  useStagedFlow,
} from "@/components/chrome/staged-overlay";
import { Identifier } from "@/components/chrome/identifier";
import { RESOLVE_IN_PLACE } from "@/components/chrome/motion";
import { DocumentPreview } from "@/components/cases/document-preview";
import {
  ReturnedOnField,
  ReturnRow,
  type ReturnMark,
} from "@/components/employee/record-returns-dialog";
import {
  SignatureActions,
  SignatureStage,
} from "@/components/employee/sign-method-stage";
import { useSignatureChoice } from "@/components/employee/sign-signature-fields";
import { ProcessStatusText } from "@/components/employee/sign-process-table";
import { useHeldRecord } from "@/components/employee/use-held-record";
import { Button } from "@/components/ui/button";
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionRow,
  DescriptionTerm,
} from "@/components/ui/description-list";
import { Dialog, DialogDescription } from "@/components/ui/dialog";
import { causeTitle, isoDay } from "@/lib/employee/hearings";
import { cn } from "@/lib/utils";
import {
  actTakes,
  buildProcessDocument,
  courtProcessTypeInline,
  courtProcessTypeLabel,
  downloadProcessDocument,
  formatProcessDate,
  landedLine,
  moveLine,
  processAct,
  refusedLine,
  processChannelLabel,
  processStatus,
  type CourtProcess,
  type ProcessAct,
  type ProcessActId,
  type ProcessDocument,
  type ProcessOutcome,
} from "@/lib/employee/sign-process";
import { useCourtLocalized } from "@/components/court/court-provider";
import { useCourtText } from "@/components/court/court-provider";

/** What the paper is called in the signature stage's copy. */
const NOUN = "process";

/** The overlay's stages: the paper with its facts, and the signature. */
const STAGES = ["read", "sign"] as const;
type Stage = (typeof STAGES)[number];
const SCENES: Record<Stage, string> = { read: "read", sign: "sign" };

/** What the overlay is doing: reading, recording a return, or asking about an act. */
type Mode = "read" | "record" | "act";

/** The single-row acts this overlay runs itself. Signing has its own stage. */
type QuickAct = Exclude<ProcessActId, "sign" | "record">;

/**
 * One process, read — and acted on, whatever its status asks for (owner, 2026-10-06).
 *
 * **Two columns.** The paper fills one side and scrolls on its own; the other holds what
 * the row *is* — its status, instrument, channel, case and days — above whatever the act
 * needs. The application-review overlays already read this way, so a court clerk moving
 * between queues meets one shape.
 *
 * **The row's own act is here.** The footer carries Download and the one thing this
 * status asks for: send a collected cover for signature, sign, mark a cover posted,
 * resend a refused send, or record what came back. Nothing has to be closed to act.
 *
 * - **Sign** keeps the signature stage — the narrow window asking how to sign.
 * - **Record return** puts the outcome controls above the facts.
 * - **Send for signature, Mark as posted, Resend** ask their question in the header and
 *   the one line saying where the row goes in the footer, beside Back and the act.
 *
 * Every act then shows its success where the question stood — what was done and where
 * the row is now — with Download and Done.
 *
 * **Nothing is signed, sent, posted or recorded** — see `lib/employee/sign-process.ts`.
 */
export function SignProcessDialog({
  process,
  onOpenChange,
  onSign,
  onAct,
  onRecord,
  onReturnFocus,
}: {
  /** The live row — the screen passes it from the line, so the facts follow an act. */
  process: CourtProcess | null;
  onOpenChange: (process: CourtProcess | null) => void;
  onSign: (process: CourtProcess) => void;
  onAct: (act: QuickAct, process: CourtProcess) => void;
  onRecord: (process: CourtProcess, outcome: ProcessOutcome, on: string) => void;
  onReturnFocus: () => void;
}) {
  const { held, opening } = useHeldRecord(process);

  return (
    <Dialog
      open={process !== null}
      onOpenChange={(open) => {
        if (!open) onOpenChange(null);
      }}
    >
      {/* Keyed on the opening, not the row's state: an act changes the row, and the
          window has to stay put while it does. */}
      {held ? (
        <SignProcessBody
          key={opening}
          process={held}
          onClose={() => onOpenChange(null)}
          onSign={onSign}
          onAct={onAct}
          onRecord={onRecord}
          onReturnFocus={onReturnFocus}
        />
      ) : null}
    </Dialog>
  );
}

function SignProcessBody({
  process,
  onClose,
  onSign,
  onAct,
  onRecord,
  onReturnFocus,
}: {
  process: CourtProcess;
  onClose: () => void;
  onSign: (process: CourtProcess) => void;
  onAct: (act: QuickAct, process: CourtProcess) => void;
  onRecord: (process: CourtProcess, outcome: ProcessOutcome, on: string) => void;
  onReturnFocus: () => void;
}) {
  const courtText = useCourtText();
  const flow = useStagedFlow<Stage>({ order: STAGES, scene: SCENES });
  const choice = useSignatureChoice(NOUN);
  const document = React.useMemo(
    () => buildProcessDocument(process),
    [process],
  );
  const [mode, setMode] = React.useState<Mode>("read");
  /* The quick act being asked about in the footer, and the act that has just run. */
  const [asking, setAsking] = React.useState<ProcessAct | null>(null);
  const [settled, setSettled] = React.useState<ProcessAct | null>(null);
  const [returnedOn, setReturnedOn] = React.useState<Date | undefined>(
    () => new Date(),
  );
  const [mark, setMark] = React.useState<ReturnMark | undefined>(undefined);

  const stage = flow.stage;
  const status = processStatus(process.status);
  /* What this status asks for, if it is something this overlay can do. Recording takes
     only registered post — an electronic channel reports for itself. */
  const actId = status.act;
  const act = actId ? processAct(actId) : undefined;
  const available = act && actTakes(act, process) ? act : undefined;
  const inline = courtProcessTypeInline(process.type);
  const marked =
    mark?.served === true || (mark?.served === false && !!mark.reason);


  /** Back to reading — and, after an act, its success in the footer. */
  function settle(ran?: ProcessAct) {
    setAsking(null);
    setSettled(ran ?? null);
    setMode("read");
    if (flow.stage !== "read") flow.go("read");
  }

  function runRecord() {
    if (!marked || !returnedOn || !mark) return;
    onRecord(
      process,
      mark.served
        ? { served: true }
        : { served: false, reason: mark.reason ?? "Other" },
      isoDay(returnedOn),
    );
    settle(processAct("record"));
  }

  function primary() {
    if (!available) return null;
    switch (available.id) {
      case "sign":
        return (
          <Button type="button" onClick={() => flow.go("sign")}>
            Sign this process
          </Button>
        );
      case "record":
        return (
          <Button type="button" onClick={() => setMode("record")}>
            Record return
          </Button>
        );
      default:
        return (
          <Button
            type="button"
            onClick={() => {
              setAsking(available);
              setMode("act");
            }}
          >
            {available.confirm}
          </Button>
        );
    }
  }

  const download = (
    <Button
      type="button"
      variant="outline"
      onClick={() => downloadProcessDocument(process)}
    >
      Download
    </Button>
  );

  let footer: React.ReactNode;
  if (stage === "sign") {
    footer = (
      <SignatureActions
        choice={choice}
        onBack={() => flow.go("read")}
        onSubmit={() => {
          onSign(process);
          settle(processAct("sign"));
        }}
      />
    );
  } else if (mode === "act" && asking) {
    /* The court side's plain confirmation, asked beside the paper it is about: the
       question in the header, and here the one line saying where the row goes. */
    footer = (
      <>
        <p className="mr-auto self-center text-body-compact text-muted-foreground max-sm:order-last">
          {moveLine(asking.id, [process])}
        </p>
        <Button type="button" variant="outline" onClick={() => settle()}>
          Back
        </Button>
        <Button
          type="button"
          onClick={() => {
            onAct(asking.id as QuickAct, process);
            settle(asking);
          }}
        >
          {asking.confirm}
        </Button>
      </>
    );
  } else if (settled) {
    /* What the act did, where the question stood: the success ink and a tick, then
       where the row is now — read off the live row, because signing forks. A refused
       send says so in the warning ink instead. */
    const refused = process.status === "send-failed";
    const noun = settled.noun?.one ?? (settled.id === "record" ? "return" : "process");
    footer = (
      <>
        <p
          role="status"
          className={cn(
            "mr-auto flex items-start gap-2 self-center text-body-compact max-sm:order-last",
            refused ? "text-warning-ink" : "text-success-ink",
            RESOLVE_IN_PLACE,
          )}
        >
          {refused ? (
            <TriangleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
          ) : (
            <CircleCheckIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
          )}
          <span>
            <span className="font-medium">{settled.done(noun)}.</span>{" "}
            {refused ? refusedLine([process]) : landedLine([process])}
          </span>
        </p>
        {download}
        <Button type="button" onClick={onClose}>
          Done
        </Button>
      </>
    );
  } else if (mode === "record") {
    footer = (
      <>
        <Button type="button" variant="outline" onClick={() => setMode("read")}>
          Back
        </Button>
        <Button type="button" disabled={!marked || !returnedOn} onClick={runRecord}>
          Record return
        </Button>
      </>
    );
  } else {
    footer = (
      <>
        {download}
        {primary()}
      </>
    );
  }

  const title =
    stage === "sign"
      ? "Add signature"
      : mode === "act" && asking
        ? asking.question(`this ${asking.noun?.one ?? "process"}`)
        : document.title;

  return (
    <StagedOverlay
      /* The paper's width and a definite height at every width, held for every stage. */
      className="h-[85dvh] sm:max-w-4xl xl:max-w-6xl"
      title={title}
      titleRef={flow.titleRef}
      description={
        <DialogDescription className="text-body-compact text-muted-foreground">
          {causeTitle(process)} <span aria-hidden>· </span>
          <Identifier
            value={process.caseNumber}
            label="case number"
            copyable={false}
          />
        </DialogDescription>
      }
      sceneKey={flow.sceneKey}
      motion={flow.motion}
      padded={stage !== "read"}
      /* One white plane while reading — the facts are a sunken well and the paper a
         framed sheet, and a tinted stage would swallow the well's edge — and for the
         act, whose rows are drawn by their own hairline, not laid on a canvas. The
         signature stage keeps the canvas the shared signing stage is built for. */
      surface={stage === "read" ? "card" : "canvas"}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        onReturnFocus();
      }}
      footer={footer}
    >
      {stage === "read" ? (
        <div className="grid min-h-0 flex-1 grid-rows-[auto_auto] gap-6 overflow-y-auto p-6 md:grid-rows-[auto_minmax(0,1fr)] md:overflow-hidden xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] xl:grid-rows-1">
          {/* The facts column. It scrolls on its own beside the paper once they are side
              by side; stacked, the whole stage scrolls. */}
          <div className="flex flex-col gap-4 xl:min-h-0 xl:overflow-y-auto">
            {mode === "record" ? (
              /* What came back, beside the paper it came back on — above the facts,
                 because while recording it is the task in hand. */
              <section
                aria-label={`What the ${inline} came back as`}
                className="flex flex-col gap-4 rounded-lg border border-hairline bg-card p-4"
              >
                <ReturnedOnField value={returnedOn} onChange={setReturnedOn} />
                <ul>
                  <ReturnRow
                    process={process}
                    mark={mark}
                    onMark={(next) =>
                      setMark((current) => ({ ...current, ...next }))
                    }
                  />
                </ul>
              </section>
            ) : null}

            <ProcessFacts process={process} />
          </div>

          {/* The framed well — title and Full view in one ruled strip — that the
              registrations overlay settled on, rather than a band floating over the
              paper. Download lives in the footer with the act, so it is not repeated
              here. */}
          <DocumentPreview
            className="min-h-96 md:min-h-0"
            height="fill"
            variant="quiet"
            surface="card"
            title={document.title}
            source={{
              kind: "composed",
              content: <ProcessFacsimile document={document} />,
            }}
          />
        </div>
      ) : (
        <SignatureStage
          noun={NOUN}
          subject={`You are adding your signature to the ${inline} in ${courtText(process.caseNumber)}.`}
          warning="Signing this process cannot be reversed."
          download={{
            prompt: "Want to read it again?",
            onDownload: () => downloadProcessDocument(process),
          }}
          choice={choice}
        />
      )}
    </StagedOverlay>
  );
}

/**
 * What the row is, as facts: status first, because it is what the clerk opened the row
 * to act on; then the instrument and how it goes out; then the days, only those it has.
 * A sunken well, the application-review overlays' treatment.
 */
function ProcessFacts({ process }: { process: CourtProcess }) {
  const rows: [string, React.ReactNode][] = [
    ["Status", <ProcessStatusText key="s" process={process} inline />],
    ["Process type", courtProcessTypeLabel(process.type)],
    ["Delivery channel", processChannelLabel(process.channel)],
    [
      "Case number",
      <Identifier key="c" value={process.caseNumber} label="case number" />,
    ],
    ["Hearing date", formatProcessDate(process.hearingDate)],
    ["Payment made", formatProcessDate(process.paidOn)],
  ];
  if (process.issuedOn) rows.push(["Issued", formatProcessDate(process.issuedOn)]);
  if (process.signedOn) rows.push(["Signed", formatProcessDate(process.signedOn)]);
  if (process.sentOn) rows.push(["Sent", formatProcessDate(process.sentOn)]);
  if (process.returnedOn) {
    rows.push(["Came back", formatProcessDate(process.returnedOn)]);
  }

  return (
    <div className="rounded-lg bg-surface-sunken px-4">
      <DescriptionList>
        {rows.map(([term, value]) => (
          <DescriptionRow
            key={term}
            className="grid-cols-[minmax(7rem,9rem)_1fr] border-hairline"
          >
            <DescriptionTerm className="text-body-compact">{term}</DescriptionTerm>
            <DescriptionDetails className="min-w-0 text-body-compact tabular-nums">
              {value}
            </DescriptionDetails>
          </DescriptionRow>
        ))}
      </DescriptionList>
    </div>
  );
}

/**
 * The process itself as paper — the same facsimile treatment the other court-side
 * overlays use, bound to this row's own particulars. The addressee sits under the title:
 * a process commands a named person, and who it commands is written on its face first.
 */
function ProcessFacsimile({ document: storedDocument }: { document: ProcessDocument }) {
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

      <div className="flex flex-col gap-2">
        <h3 className="text-center text-body font-semibold">
          {document.title}
        </h3>
        <p className="text-body">{document.addressee}</p>
      </div>

      <ol className="flex list-decimal flex-col gap-3 ps-6">
        {document.paragraphs.map((paragraph, index) => (
          <li key={index} className="text-body">
            {paragraph}
          </li>
        ))}
      </ol>

      <div className="flex flex-col gap-2">
        <p className="text-body">{document.channel}</p>
        <p className="text-body">Dated this the {document.dated}.</p>
      </div>

      <p className="text-body text-paper-muted-foreground">
        {document.signature}
      </p>
    </article>
  );
}
