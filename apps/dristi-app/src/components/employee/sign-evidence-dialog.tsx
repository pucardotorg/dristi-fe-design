"use client";

import * as React from "react";

import {
  StagedOverlay,
  useStagedFlow,
} from "@/components/chrome/staged-overlay";

import { ReviewRow } from "@/components/cases/filing-form-shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DescriptionList } from "@/components/ui/description-list";
import { Dialog, DialogDescription } from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { causeTitle } from "@/lib/employee/hearings";
import {
  businessOfTheDay,
  evidenceDocumentLabel,
  evidenceNumber,
  exhibitSeries,
  markedThroughWitness,
  parseEvidenceSerial,
  takenSerials,
  witnessLabel,
  type EvidenceMarking,
  type SignEvidence,
} from "@/lib/employee/sign-evidence";
import { Identifier } from "@/components/chrome/identifier";
import { useCourtText } from "@/components/court/court-provider";

/**
 * One marking, read and then signed — the single-document path off the evidence queue.
 *
 * Two stages, and both are the reference's: the particulars of the marking with the day's
 * business under them, and — behind Edit details — the form that changes what the marking
 * says. The reference draws the second as a modal over the first; here it is a stage of
 * the same overlay, because two stacked dialogs put two focus traps on one decision and
 * the DS ships no nested-dialog pattern (ACCESSIBILITY §5). Nothing else about it changes:
 * the same four fields, the same locked prefix, the same Cancel and Proceed.
 *
 * It is `StagedOverlay` that holds them together. Each stage used to draw its own header
 * and its own footer, so answering Edit details replaced the whole window at once — which
 * is the abruptness the frame exists to end. Now the chrome renders once and stays put,
 * and the only thing that moves is the stage between it: forward to the form, back from
 * it.
 *
 * **There is no document here, and that is not an omission.** What waits for signature is
 * the court's endorsement of a document already on the case's own register — the
 * particulars *are* the record being signed. The two signing queues beside this one open a
 * facsimile because there the court wrote the paper; here it did not, and the reference
 * shows none either.
 *
 * **The only act is e-sign.** The forms queue asks how a party will sign — e-sign, or
 * upload the paper they signed — because a form is sworn by somebody who may be standing
 * in the court office. An exhibit is endorsed by the bench that is already logged in, and
 * the reference offers one button.
 *
 * **E-sign signs nothing.** It drops the row from the demo queue and closes — see
 * `lib/employee/sign-evidence.ts`. No signature is applied, no exhibit is endorsed,
 * nothing is written to the A-Diary and no e-sign provider is called.
 */
export function SignEvidenceDialog({
  row,
  rows,
  onOpenChange,
  onMarkingChange,
  onBusinessOfTheDayChange,
  onSign,
  onReturnFocus,
}: {
  row: SignEvidence | null;
  /** The whole queue — an exhibit number has to be checked against its case's others. */
  rows: SignEvidence[];
  onOpenChange: (row: SignEvidence | null) => void;
  onMarkingChange: (id: string, marking: EvidenceMarking) => void;
  onBusinessOfTheDayChange: (id: string, botd: string) => void;
  onSign: (row: SignEvidence) => void;
  onReturnFocus: () => void;
}) {
  return (
    <Dialog
      open={row !== null}
      onOpenChange={(next) => {
        if (!next) onOpenChange(null);
      }}
    >
      {row ? (
        /* Keyed on the marking so opening a second one starts on its particulars rather
           than inheriting the last one's step. */
        <SignEvidenceBody
          key={row.id}
          row={row}
          rows={rows}
          onMarkingChange={onMarkingChange}
          onBusinessOfTheDayChange={onBusinessOfTheDayChange}
          onSign={onSign}
          onReturnFocus={onReturnFocus}
        />
      ) : null}
    </Dialog>
  );
}

/**
 * The two stages, in the order the act moves through them — the direction of travel
 * falls out of the list rather than being decided at each call.
 */
const STAGES = ["details", "edit"] as const;

type Stage = (typeof STAGES)[number];

/** One scene each: the two stages show different things and therefore travel. */
const SCENE: Record<Stage, string> = { details: "details", edit: "edit" };

/** The one line that rewrites itself. */
const TITLE: Record<Stage, string> = {
  details: "Evidence details",
  edit: "Mark as evidence",
};

function SignEvidenceBody({
  row,
  rows,
  onMarkingChange,
  onBusinessOfTheDayChange,
  onSign,
  onReturnFocus,
}: {
  row: SignEvidence;
  rows: SignEvidence[];
  onMarkingChange: (id: string, marking: EvidenceMarking) => void;
  onBusinessOfTheDayChange: (id: string, botd: string) => void;
  onSign: (row: SignEvidence) => void;
  onReturnFocus: () => void;
}) {
  const courtText = useCourtText();
  const flow = useStagedFlow({ order: STAGES, scene: SCENE });

  /* The marking being typed, held here rather than inside the stage that types it: the
     footer is chrome, so Proceed lives outside the form it submits and has to know
     whether the form can be submitted. Cancel puts it back to what is recorded, which is
     what re-entering a remounted form used to do for free. */
  const [markedThrough, setMarkedThrough] = React.useState(row.markedThrough);
  const [serial, setSerial] = React.useState(String(row.serial));

  const witness =
    row.witnesses.find((entry) => entry.id === markedThrough) ??
    row.witnesses[0];
  const series = exhibitSeries(witness.series);
  const parsed = parseEvidenceSerial(serial);
  const taken = takenSerials(rows, row, series);

  /* One message at a time, and each says what to do rather than that something is
     wrong. The clash is the one a bench can actually hit: renumbering an exhibit onto a
     number this case has already given out. */
  const error =
    parsed === null
      ? "Enter the exhibit number as a whole number, like 1."
      : taken.has(parsed)
        ? `${series}${parsed} is already marked in ${courtText(row.caseNumber)}.`
        : undefined;

  const line = businessOfTheDay(row);
  const blank = line.trim() === "";

  function cancel() {
    setMarkedThrough(row.markedThrough);
    setSerial(String(row.serial));
    flow.go("details");
  }

  return (
    <StagedOverlay
      /* One column of particulars and one short form — neither wants more measure than
         this. No definite height, so the stage takes the floor instead: the form is
         taller than the particulars, and a centred dialog that shrinks between them
         moves the whole panel up the screen on the way back. */
      className="sm:max-w-lg"
      floor
      title={TITLE[flow.stage]}
      titleRef={flow.titleRef}
      /* The marking's own state — waiting for this bench's signature — and it is just as
         true while the bench is correcting the marking, so it stays put across both
         stages rather than blinking out of a header that is meant to hold still.
         `warning` is the variant the other court-side overlays already spend on a pending
         state, so the three report one thing the same way. */
      titleAside={<Badge variant="warning">Pending signature</Badge>}
      description={
        <DialogDescription className="text-body-compact text-muted-foreground">
          {causeTitle(row)} <span aria-hidden>· </span>
          {/* No copy control inside the dialog's accessible description. */}
          <Identifier value={row.caseNumber} label="case number" copyable={false} />
        </DialogDescription>
      }
      sceneKey={flow.sceneKey}
      motion={flow.motion}
      footer={
        flow.stage === "details" ? (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => flow.go("edit")}
            >
              Edit details
            </Button>
            <Button type="button" disabled={blank} onClick={() => onSign(row)}>
              E-sign
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variant="outline" onClick={cancel}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="mark-as-evidence"
              disabled={Boolean(error)}
            >
              Proceed
            </Button>
          </>
        )
      }
      /* Radix focuses the first tabbable thing it finds, which here is the day's business
         — the overlay opened with a teal ring around a field the bench has not asked to
         change yet, and that reads as an errored or selected state. The title takes it
         instead: it names what has just been opened, and it is where the frame lands
         focus on every stage change after this one, so the two agree. Focus still moves
         into the dialog and is still trapped there; only its landing place changed — the
         same fix the registrations and A-Diary overlays make for the same reason. */
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        flow.titleRef.current?.focus();
      }}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        onReturnFocus();
      }}
    >
      {flow.stage === "details" ? (
        <DetailsStage
          row={row}
          line={line}
          blank={blank}
          onBusinessOfTheDayChange={onBusinessOfTheDayChange}
        />
      ) : (
        <MarkAsEvidenceStage
          row={row}
          series={series}
          markedThrough={markedThrough}
          serial={serial}
          error={error}
          onMarkedThroughChange={setMarkedThrough}
          onSerialChange={setSerial}
          onProceed={() => {
            if (parsed === null || error) return;
            onMarkingChange(row.id, { markedThrough, serial: parsed });
            flow.go("details");
          }}
        />
      )}
    </StagedOverlay>
  );
}

/**
 * What the marking says — the stage the act opens on.
 *
 * The four particulars sit in a card on the stage: `DescriptionList` inside `Card` is the
 * DS's own recipe for one record's key-value fields (Laws, "Grouped content gets a
 * border"), and it is lifted rather than sunken because a sunken fill on the tinted stage
 * is the stage's own tone and the panel would have no edge at all.
 *
 * The day's business is not one of the particulars: it is the one thing on this overlay
 * the bench writes, so it is a real field in its own panel rather than a fifth row of
 * read-only text.
 *
 * A `Textarea` where the reference draws a single-line input: the day's business runs to
 * two lines (`lib/cases/orders.ts`), and a court that deploys in Malayalam or Tamil sets
 * longer strings in taller glyphs. A one-line field scrolls the sentence out of sight
 * instead of wrapping it (ACCESSIBILITY §10, §13).
 *
 * Emptying that field is the one thing here that stops the signature. The reference
 * validates nothing, but the line is what the day's record carries about this exhibit —
 * signing a blank one endorses an exhibit the register cannot describe. The court's draft
 * is always one step away, so the dead end is never a trap.
 */
function DetailsStage({
  row,
  line,
  blank,
  onBusinessOfTheDayChange,
}: {
  row: SignEvidence;
  line: string;
  blank: boolean;
  onBusinessOfTheDayChange: (id: string, botd: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Card size="sm" className="border-hairline shadow-raised">
        <CardContent>
          <DescriptionList>
            <ReviewRow term="Document title">
              {evidenceDocumentLabel(row.document)}
            </ReviewRow>
            <ReviewRow term="Uploaded by">{row.uploadedBy}</ReviewRow>
            <ReviewRow term="Evidence marked through">
              {witnessLabel(markedThroughWitness(row))}
            </ReviewRow>
            <ReviewRow term="Evidence number">
              <Identifier value={evidenceNumber(row)} label="evidence number" />
            </ReviewRow>
          </DescriptionList>
        </CardContent>
      </Card>

      <Card size="sm" className="border-hairline shadow-raised">
        <CardContent>
          <Field data-invalid={blank}>
            <FieldLabel className="text-body">Business of the day</FieldLabel>
            <Textarea
              rows={2}
              value={line}
              aria-invalid={blank || undefined}
              onChange={(event) =>
                onBusinessOfTheDayChange(row.id, event.target.value)
              }
            />
            {blank ? (
              <FieldError className="text-body-compact">
                Write what the court did with this document before signing it.
              </FieldError>
            ) : null}
          </Field>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * What the marking says, changed — the reference's Mark as evidence form, as the second
 * stage of the same overlay rather than a second overlay over it.
 *
 * The reference draws it as a modal over the first. Here it is a stage: two stacked
 * dialogs put two focus traps on one decision and the DS ships no nested-dialog pattern
 * (ACCESSIBILITY §5), and the header and footer stay exactly where they were while only
 * the form between them travels. Nothing else about it changes — the same four fields,
 * the same locked prefix, the same Cancel and Proceed.
 *
 * Two of its four fields cannot be changed here: the document's own title and who filed
 * it are facts about the filing, not about the court's marking of it. They stay in the
 * form because they say what is being marked, and they are `readOnly` rather than the
 * reference's `disabled` — a disabled control is out of the tab order and unreachable by
 * a voice user naming its label, and there is nothing to disable here, only nothing to
 * type (ACCESSIBILITY §4, §9).
 *
 * The exhibit's series letter is the third thing that cannot be typed, and the reference
 * locks it as a dropdown with one option. Here it is an `InputGroupAddon variant="field"` —
 * the DS's own cell for a value that qualifies what the user types, which is exactly what
 * a series letter does. A select that cannot be opened is a control that keyboard and
 * voice users can reach and not operate; the addon is not a control at all, and the field
 * description says what decides the letter.
 *
 * Proceed is in the frame's footer, so the form carries an `id` and the button points at
 * it — the same wiring the footer used when it was drawn inside this step.
 */
function MarkAsEvidenceStage({
  row,
  series,
  markedThrough,
  serial,
  error,
  onMarkedThroughChange,
  onSerialChange,
  onProceed,
}: {
  row: SignEvidence;
  series: string;
  markedThrough: string;
  serial: string;
  error: string | undefined;
  onMarkedThroughChange: (value: string) => void;
  onSerialChange: (value: string) => void;
  onProceed: () => void;
}) {
  return (
    <Card size="sm" className="border-hairline shadow-raised">
      <CardContent>
        <form
          id="mark-as-evidence"
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            onProceed();
          }}
        >
          <Field>
            <FieldLabel className="text-body">Document title</FieldLabel>
            <Input readOnly value={evidenceDocumentLabel(row.document)} />
          </Field>

          <Field>
            <FieldLabel className="text-body">Uploaded by</FieldLabel>
            <Input readOnly value={row.uploadedBy} />
          </Field>

          {/* `Label htmlFor` beside a `SelectTrigger id` rather than `Field`: the DS
              Select is a Radix trigger, not a form control `Field` can adopt, so the
              label points at the trigger's own id — the pattern every court-side filter
              row uses. */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="evidence-marked-through" className="w-fit text-body">
              Evidence marked through
            </Label>
            <Select value={markedThrough} onValueChange={onMarkedThroughChange}>
              <SelectTrigger id="evidence-marked-through" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {row.witnesses.map((entry) => (
                  <SelectItem key={entry.id} value={entry.id}>
                    {witnessLabel(entry)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Field data-invalid={Boolean(error)}>
            <FieldLabel className="text-body">Evidence number</FieldLabel>
            <InputGroup>
              <InputGroupAddon variant="field">
                <InputGroupText>{series}</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                inputMode="numeric"
                autoComplete="off"
                className="tabular-nums"
                value={serial}
                aria-invalid={Boolean(error) || undefined}
                onChange={(event) => onSerialChange(event.target.value)}
              />
            </InputGroup>
            <FieldDescription className="text-body-compact">
              The series follows the witness — P for the complainant&apos;s
              exhibits, D for the accused&apos;s, C for the court&apos;s own.
            </FieldDescription>
            {error ? (
              <FieldError className="text-body-compact">{error}</FieldError>
            ) : null}
          </Field>
        </form>
      </CardContent>
    </Card>
  );
}
