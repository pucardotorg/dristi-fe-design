"use client";

import * as React from "react";

import { StagedOverlay } from "@/components/chrome/staged-overlay";

import { DocumentPreview } from "@/components/cases/document-preview";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogDescription } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { causeTitle } from "@/lib/employee/hearings";
import {
  buildADiaryDocument,
  downloadADiaryDocument,
  formatADiaryDate,
  type ADiaryDocument,
  type ADiaryEntry,
} from "@/lib/employee/sign-a-diary";
import { Identifier } from "@/components/chrome/identifier";
import { useCourtLocalized } from "@/components/court/court-provider";
import { useCourtText } from "@/components/court/court-provider";

/**
 * One day's entry, read, corrected, and then signed.
 *
 * The reference titles this overlay "View Document", and it is the one place the
 * reference undersells its own screen: the bench does not come here to view the diary,
 * it comes here to *make* it. Three things happen in this dialog and they are in the
 * order the register is made — read the day's record, correct the words, sign it — so
 * the overlay is laid out as those three and titled for the entry rather than for the
 * furniture. Sentence case is a DS Law in any case, so "View Document" could not have
 * survived unchanged (deviation logged in the build report).
 *
 * **The correction and the paper sit side by side** (owner, 2026-09-14). Stacked — the
 * document above, the editor below — the overlay had to divide one 85dvh column three
 * ways, and the document got what the editor and the footer left it: a court paper
 * arrived at the bench as a 300px slot you scrolled a heading at a time. Beside each
 * other, the two share the stage's full height, and the paper is read in one go.
 *
 * The split is 2:3 with the document on the right, for the same reason
 * `ApproveRegistrationsDialog` splits 3:2 the other way: width goes to whichever column
 * keeps gaining from it. There the facts were tables and the evidence one landscape
 * scan; here the editor is one field that stops needing width at a comfortable measure,
 * and the document is a portrait page with an appearance table in it. Each column
 * scrolls on its own above `lg`; below it the stage is one scroll with the whole paper
 * laid out in it, because a narrow window cannot hold a panel, a document and a footer
 * at once — and a court paper squeezed into half of one reads worse than a stacked one.
 *
 * The two acts, each beside the thing it acts on: **Save** belongs to the business of
 * the day and sits in that panel; **Sign** is what the dialog exists for and sits in the
 * footer, the one teal action in view.
 *
 * **The paper is the order the court passed that day** (owner, 2026-09-15), not a second
 * rendering of the register line. A diary entry is signed against the day it records, and
 * what that day produced is an order — so the frame holds an order sheet, built on the one
 * the order composer prints. See `ADiaryOrderFacsimile`.
 *
 * **The paper shows what is saved, not what is being typed.** The order's operative
 * passage is the recorded business and the editor holds the draft, so Save is a visible
 * act — the document changes under it — rather than a button whose effect has already
 * happened. The two can be one field because an order sheet's composed passage *is* the
 * business of the day.
 *
 * **Signing takes the field as it stands.** A bench that corrected the wording and went
 * straight for the signature meant to sign the correction, not to lose it, so Sign
 * records the draft with the signature and the note beside it says so. There is no
 * confirmation step and no dead end: the alternative — refusing to sign while an edit is
 * unsaved — is a disabled primary the bench has to decode.
 *
 * Download is not repeated below. `DocumentPreview` carries Download and Full view in
 * its own frame, and the same control twice in one dialog is one too many — the
 * reference's own "Download Document" link is that frame (deviation logged).
 *
 * The preview is the quiet framed variant: a title strip with the two actions in it and
 * the page under the rule. Its default header would name the document and restate the
 * date a few pixels under the dialog's own heading and sub-line, which is one heading
 * too many and one date twice.
 *
 * **Nothing here signs, records or files anything.** Save replaces a string in the demo
 * register and Sign drops the entry from it — see `lib/employee/sign-a-diary.ts`.
 */
export function SignADiaryDialog({
  entry,
  onOpenChange,
  onSave,
  onSign,
  onReturnFocus,
}: {
  entry: ADiaryEntry | null;
  onOpenChange: (entry: ADiaryEntry | null) => void;
  /** Record the corrected business of the day, leaving the entry unsigned. */
  onSave: (entry: ADiaryEntry, business: string) => void;
  /** Sign the entry, recording the business as it stands in the editor. */
  onSign: (entry: ADiaryEntry, business: string) => void;
  onReturnFocus: () => void;
}) {
  return (
    <Dialog
      open={entry !== null}
      onOpenChange={(next) => {
        if (!next) onOpenChange(null);
      }}
    >
      {entry ? (
        /* Keyed on the entry so opening a second one renders that document from the top
           with its own business in the editor, rather than inheriting the last one's
           scroll and draft. */
        <SignADiaryBody
          key={entry.id}
          entry={entry}
          onSave={onSave}
          onSign={onSign}
          onReturnFocus={onReturnFocus}
        />
      ) : null}
    </Dialog>
  );
}

function SignADiaryBody({
  entry,
  onSave,
  onSign,
  onReturnFocus,
}: {
  entry: ADiaryEntry;
  onSave: (entry: ADiaryEntry, business: string) => void;
  onSign: (entry: ADiaryEntry, business: string) => void;
  onReturnFocus: () => void;
}) {
  const courtText = useCourtText();
  const document = React.useMemo(() => buildADiaryDocument(entry), [entry]);
  /* The draft. It starts as what is recorded and is compared against the entry rather
     than against its own first value, so a Save leaves the editor clean without a second
     piece of state to keep in step. */
  const [draft, setDraft] = React.useState(entry.business);
  const [saved, setSaved] = React.useState("");
  const titleRef = React.useRef<HTMLHeadingElement | null>(null);

  const text = draft.trim();
  const blank = text === "";
  const dirty = text !== entry.business;

  function save() {
    if (blank || !dirty) return;
    onSave(entry, text);
    setSaved("Business of the day saved on this screen. Nothing was filed.");
  }

  return (
    <StagedOverlay
      /* Below `lg` the stage scrolls as one column, because a narrow window cannot hold
         a panel, a document and a footer at once and clipping the act is worse than a
         scroll. From `lg` the dialog takes a fixed height and the two columns scroll
         inside it, each on its own — a definite height, so the frame needs no floor
         under it.

         **`lg`, not the `md` the other two-column overlays split at.** Measured at 768px
         the document column comes out about 420px wide, and a court paper reflowed that
         narrow grows to 1173px tall against roughly 315px of well — the split makes the
         document *less* readable than stacking it, which is the whole thing this layout
         is for. A photograph does not do that, which is why `ApproveRegistrationsDialog`
         can split earlier than this one can. */
      className="sm:max-w-5xl lg:h-[85dvh]"
      title="A-Diary entry"
      titleRef={titleRef}
      description={
        <DialogDescription className="text-body-compact text-muted-foreground">
          {causeTitle(entry)} <span aria-hidden>· </span>
          {/* No copy control inside the dialog's accessible description. */}
          <Identifier value={entry.caseNumber} label="case number" copyable={false} />{" "}
          · Dated{" "}
          <span className="tabular-nums">{formatADiaryDate(entry.dated)}</span>
        </DialogDescription>
      }
      /* One stage: reading the day's record, correcting it and signing it all happen in
         front of the same two columns, so nothing travels. The frame is still what it
         opens on — the rise, the chrome that holds still, the tinted stage and the
         `bg-card` footer are how every court-side modal opens. */
      sceneKey="entry"
      motion="forward"
      /* A full-height two-column surface that manages its own insets and its own
         scrolling, so the frame's padding stays off it. */
      padded={false}
      footer={
        <>
          {/* What the act means — said at the moment of the act rather than left for the
              bench to discover. */}
          <p className="text-caption text-muted-foreground sm:mr-auto sm:text-left">
            {dirty && !blank
              ? "Signing records the business of the day as it stands in the editor, including the correction you have not saved."
              : "Signing puts your signature on the day's record and cannot be reversed."}
          </p>
          {/* `sm:self-center` because the frame owns the footer's own classes and this
              row pairs a caption that wraps with a 40px control. */}
          <Button
            type="button"
            className="sm:self-center"
            disabled={blank}
            onClick={() => onSign(entry, text)}
          >
            Sign the entry
          </Button>
        </>
      }
      /* Radix focuses the first tabbable thing it finds, and side by side that is the
         editor — so the overlay opened with a 3px teal ring around a mostly empty box
         taking up the whole left column, which reads as an errored field and puts a
         second teal mark in view against the one the footer spends on Sign. The title
         takes it instead: it announces the entry and the matter, which is what the bench
         has just opened, and the reading comes before the correction in any case. Focus
         still moves into the dialog and is still trapped there; only its landing place
         changed — the same fix `ApproveRegistrationsDialog` makes for the same reason. */
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        titleRef.current?.focus();
      }}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        onReturnFocus();
      }}
    >
      {/* The two columns, on the stage the frame tints. Stacked rows are `max-content`; side by side there is one `minmax(0,1fr)` row.
          Both are load-bearing, and the stacked one is not the `auto` its neighbours use.
          A grid whose own height is definite — this one is `flex-1` in a dialog that
          fixes its height — sizes `auto` rows from their *minimum* contribution once the
          content will not fit, and both of these columns have a minimum far below what
          they hold: the panel clips its own overflow, so its minimum is the label alone,
          and the document frame's is the 384px floor under it. Measured stacked at 390px,
          that resolved to rows of 50px and 384px, which is a panel showing a heading and
          nothing else and a court paper cut off mid-table with no way to scroll it.
          `max-content` sizes each row to what it actually holds and lets the stage
          scroll, which is the one scroll a narrow window should have here. Side by side the row
          must be `minmax(0,1fr)` instead, to give both columns the definite height that
          `lg:overflow-y-auto` and `height="fill"` resolve against. */}
      <div className="grid min-h-0 flex-1 grid-rows-[max-content_max-content] gap-6 overflow-y-auto p-6 lg:grid-cols-[2fr_3fr] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden">
        {/* The editable record, as a panel on the stage — lifted at rest, because a white
            card and the canvas under it measure about 1.01:1 and a stroke is not what
            separates them (ui-craft §4). */}
        <Card className="min-w-0 border-hairline shadow-raised lg:min-h-0">
          <CardContent className="flex flex-col gap-4 lg:min-h-0 lg:flex-1">
            <Field data-invalid={blank} className="lg:min-h-0 lg:flex-1">
              <FieldLabel className="text-body">Business of the day</FieldLabel>
              {/* Stacked it grows with what is typed, from a four-line floor. Beside the
                  document it takes the panel's remaining height instead and scrolls
                  inside it — `field-sizing-fixed`, or the field's own content sizing
                  would fight the flex and push the Save row off the panel. */}
              <Textarea
                value={draft}
                rows={4}
                className="text-body lg:min-h-0 lg:flex-1 lg:field-sizing-fixed"
                onChange={(event) => {
                  setDraft(event.target.value);
                  setSaved("");
                }}
              />
              <FieldDescription className="text-body-compact">
                What this court did on {formatADiaryDate(entry.dated)}, in the
                court&apos;s own words. Correct it before you sign.
              </FieldDescription>
              {/* A day the court sat is a day with business. Emptying the record is the
                  one edit this field refuses, and it says so where the error belongs
                  rather than by disabling Save with no reason given.

                  Mounted only while it has something to say. `FieldError` renders null on
                  empty children but still registers its id with the `Field`, so leaving
                  it mounted points `aria-describedby` at an element that is not there —
                  upstream DS quirk, logged in the build report. */}
              {blank ? (
                <FieldError className="text-body-compact">
                  The day&apos;s business cannot be left blank.
                </FieldError>
              ) : null}
            </Field>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {/* What Save did, for anyone not watching the document beside it change. */}
              <p
                className="text-caption text-muted-foreground sm:mr-auto"
                aria-live="polite"
              >
                {saved}
              </p>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-fit"
                disabled={blank || !dirty}
                onClick={save}
              >
                Save
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* `surface="card"`: on the tinted stage a sunken well is the stage's own tone
            with no edge, so the page sits on a white sheet with a hairline instead. And
            it lifts, because it is the second panel on the canvas and not a well inside
            one — two objects of the same rank, side by side, reading at two different
            elevations is the thing the layering model exists to stop (ui-craft §4). */}
        <DocumentPreview
          variant="quiet"
          surface="card"
          className="min-h-96 shadow-raised lg:min-h-0"
          height="fill"
          title={document.title}
          source={{
            kind: "composed",
            content: <ADiaryOrderFacsimile document={document} />,
          }}
          download={{
            onDownload: () => downloadADiaryDocument(entry),
            label: `Download the order passed on ${formatADiaryDate(entry.dated)} in ${courtText(entry.caseNumber)}`,
          }}
        />
      </div>
    </StagedOverlay>
  );
}

/**
 * The order the court passed that day, as paper.
 *
 * **What the bench came to check** (owner, 2026-09-15). The frame used to hold the
 * register page — the same four facts, the appearance table, the business under a
 * heading. But a diary entry is signed against the day it records, and what that day
 * produced is an order; a bench reading its register back needs the order in front of
 * it, not a second rendering of the sentence it is already correcting in the panel.
 *
 * So the page is built on the order sheet the order composer prints (`order-screen.tsx`)
 * rather than on a shape of its own: the court, the cause and the date, the offence every
 * case here is prosecuted for, the order's own title, who appeared, the operative
 * passage, and the block that signs it. Two screens that both draw an order must draw the
 * same one.
 *
 * Three things it keeps from the register page it replaced, and each for a reason:
 *
 * - **The appearance table.** The reference's own drawing, and the part of the day's
 *   record that says the hearing happened at all. The order composer's page states the
 *   same fact as two rolls; here it is already a table the owner has approved, and a
 *   bordered table is what a court paper puts appearances in.
 * - **The operative passage is `entry.business`** — the very string the editor corrects.
 *   That is what keeps Save a visible act: the paper changes under it. An order sheet's
 *   composed passage *is* the business of the day, which is why the two can be one field.
 * - **The paper tokens.** This is a facsimile of a court paper inside a document frame,
 *   not a product surface, so the table and the heading are drawn with the paper palette
 *   rather than the DS `Table` — the same treatment `SignOrderDialog` gives its order.
 */
function ADiaryOrderFacsimile({ document: storedDocument }: { document: ADiaryDocument }) {
  const document = useCourtLocalized(storedDocument);
  return (
    <article className="flex flex-col gap-6 rounded-md bg-paper p-6 text-paper-foreground">
      <header className="flex flex-col gap-2 text-center">
        <p className="text-body font-semibold">{document.court}</p>
        <p className="text-body font-semibold">
          Case no. {document.caseNumber}
        </p>
        <p className="text-body font-semibold">
          In the matter of {document.matter}
        </p>
        <p className="text-body font-semibold">Dated {document.dated}</p>
        {/* The offence, held back to the paper's quiet ink: an order sheet prints it
            above the operative part, and it is standing furniture — true of every case
            on this platform — rather than anything this order decided. */}
        <p className="text-caption text-paper-muted-foreground">
          {document.offence}
        </p>
      </header>

      {/* Which order this is. Centred over the operative part, the way the order
          composer's own page heads it and the way `SignOrderDialog` heads its order. */}
      <h3 className="text-center text-body font-semibold">{document.title}</h3>

      {/* Who was before the court: the table that names them, then the recital that says
          who of them actually turned up and what the matter was called for. One block,
          `gap-4`, because they are one fact told two ways — the order composer's page
          states it as two rolls, and splitting these across the sheet would read as two
          unrelated claims about the same sitting. */}
      <section className="flex flex-col gap-4">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">
            Appearances before this court in {document.caseNumber}
          </caption>
          <tbody>
            {document.appearances.map(({ label, value }, index) => (
              <tr key={`${label}-${index}`}>
                <th
                  scope="row"
                  className="w-2/5 border border-paper-border px-4 py-3 align-top text-body font-normal"
                >
                  {label}
                </th>
                <td className="border border-paper-border px-4 py-3 align-top text-body">
                  {value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="text-body">{document.attendance}</p>
      </section>

      <OperativePassage paragraphs={document.paragraphs} />

      <p className="text-body text-paper-muted-foreground">
        {document.signature}
      </p>
    </article>
  );
}

/**
 * What the court ordered — numbered, the way an order sheet numbers its paragraphs.
 *
 * **Unless there is only one, in which case it is a paragraph.** The bench can flatten
 * the passage into a single block in the editor beside this, and a numbered list holding
 * one item is a "1." with nothing to be first of — it reads as a document that lost the
 * rest of itself. A list of one is not a list, so it is rendered as the paragraph it is.
 */
function OperativePassage({ paragraphs }: { paragraphs: string[] }) {
  if (paragraphs.length <= 1) {
    /* `whitespace-pre-line` because the bench types this: a passage broken by a single
       newline should stay broken where it was broken. */
    return (
      <p className="text-body whitespace-pre-line">{paragraphs.join("")}</p>
    );
  }
  return (
    <ol className="flex list-decimal flex-col gap-3 ps-6">
      {paragraphs.map((paragraph, index) => (
        <li key={index} className="text-body whitespace-pre-line">
          {paragraph}
        </li>
      ))}
    </ol>
  );
}
