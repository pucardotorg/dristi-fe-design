"use client";

import * as React from "react";

import { StagedOverlay } from "@/components/chrome/staged-overlay";
import { OutcomeHeader } from "@/components/feedback";
import { DocumentPreview } from "@/components/cases/document-preview";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription } from "@/components/ui/dialog";
import { useCourtLocalized } from "@/components/court/court-provider";
import { cn } from "@/lib/utils";
import {
  buildADiaryDayDocument,
  downloadADiaryDayDocument,
  formatADiaryDate,
  type ADiaryDayDocument,
  type ADiaryEntry,
} from "@/lib/employee/sign-a-diary";

/**
 * Sign one day of the A-Diary — the whole day, as one document (`a-diary.md` `ADY-12`).
 *
 * The document is **built when this opens**, from the register as it stands
 * (`ADY-12a`): the diary is entries on a screen until it is signed, the way an order is
 * text until it is signed. An entry corrected a moment ago is already in it.
 *
 * One stage: the paper and the act that signs it. The screen only offers this for a day
 * that is over (`ADY-12b`), so the dialog does not argue about the date.
 *
 * **Nothing here signs, records or files anything.** Signing drops the day from the demo
 * register — see `lib/employee/sign-a-diary.ts`.
 */
export function SignADiaryDayDialog({
  day,
  register,
  onOpenChange,
  onSign,
  onReturnFocus,
}: {
  /** The day being signed, `YYYY-MM-DD`, or `null` when the dialog is closed. */
  day: string | null;
  register: ADiaryEntry[];
  onOpenChange: (open: boolean) => void;
  onSign: (day: string) => void;
  onReturnFocus: () => void;
}) {
  return (
    <Dialog open={day !== null} onOpenChange={onOpenChange}>
      {day ? (
        <SignADiaryDayBody
          key={day}
          day={day}
          register={register}
          onSign={onSign}
          onClose={() => onOpenChange(false)}
          onReturnFocus={onReturnFocus}
        />
      ) : null}
    </Dialog>
  );
}

function SignADiaryDayBody({
  day,
  register,
  onSign,
  onClose,
  onReturnFocus,
}: {
  day: string;
  register: ADiaryEntry[];
  onSign: (day: string) => void;
  onClose: () => void;
  onReturnFocus: () => void;
}) {
  /* Signed: the window turns into its outcome (skill `feedback-states`) rather than
     closing onto a page that only says so in an empty state. */
  const [signed, setSigned] = React.useState(false);
  /* Built once, when the dialog opens: this is the document being signed, and it must
     not shift under the signer while they read it. */
  const [document] = React.useState(() => buildADiaryDayDocument(day, register));
  const titleRef = React.useRef<HTMLHeadingElement | null>(null);
  const count = document.entries.length;

  return (
    <StagedOverlay
      className="sm:max-w-5xl lg:h-[85dvh]"
      title={signed ? "A-Diary signed" : "Sign the A-Diary"}
      titleRef={titleRef}
      outcome={signed}
      description={
        <DialogDescription className="text-body-compact text-muted-foreground">
          <span className="tabular-nums">{formatADiaryDate(day)}</span> ·{" "}
          {count === 1 ? "1 entry" : `${count} entries`}
        </DialogDescription>
      }
      sceneKey="day"
      motion="forward"
      padded={false}
      footer={
        signed ? (
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        ) : (
        <>
          <p className="text-caption text-muted-foreground sm:mr-auto sm:text-left">
            You sign the whole day as one document. Once signed, no entry in it can be
            changed, and signing cannot be undone.
          </p>
          <Button
            type="button"
            className="sm:self-center"
            onClick={() => {
              onSign(day);
              setSigned(true);
            }}
          >
            Sign the A-Diary
          </Button>
        </>
        )
      }
      /* The title takes focus rather than the first control in the document frame: it
         names what is being signed, which is what the signer reads first. */
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        titleRef.current?.focus();
      }}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        onReturnFocus();
      }}
    >
      {signed ? (
        <OutcomeHeader
          titleFrom="dialog"
          focusTitle
          surface="card"
          title="A-Diary signed"
          body={`The A-Diary for ${formatADiaryDate(day)} is signed. No entry in it can be changed now.`}
        />
      ) : (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6 lg:overflow-hidden">
        <DocumentPreview
          variant="quiet"
          surface="card"
          className="min-h-96 shadow-raised lg:min-h-0 lg:flex-1"
          height="fill"
          title={`A-Diary, ${formatADiaryDate(day)}`}
          source={{
            kind: "composed",
            content: <ADiaryDayFacsimile document={document} />,
          }}
          download={{
            onDownload: () => downloadADiaryDayDocument(day, register),
            label: `Download the A-Diary for ${formatADiaryDate(day)}`,
          }}
        />
      </div>
      )}
    </StagedOverlay>
  );
}

/**
 * The day's A-Diary as paper: the court and the day, then the register as a table with
 * the four columns of `a-diary.md` `ADY-03a` — the same table the screen shows — and the
 * block that signs the whole of it. Drawn with the paper palette, like the order beside
 * an entry, rather than the DS `Table`: this is a facsimile of a court paper.
 */
function ADiaryDayFacsimile({
  document: storedDocument,
}: {
  document: ADiaryDayDocument;
}) {
  const document = useCourtLocalized(storedDocument);
  const cell = "border border-paper-border px-3 py-2 align-top text-body-compact";
  return (
    <article className="flex flex-col gap-6 rounded-md bg-paper p-6 text-paper-foreground">
      <header className="flex flex-col gap-2 text-center">
        <p className="text-body font-semibold">{document.court}</p>
        <h3 className="text-body font-semibold">A-Diary</h3>
        <p className="text-body font-semibold">Dated {document.dated}</p>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-xl border-collapse text-left">
          <caption className="sr-only">A-Diary dated {document.dated}</caption>
          <thead>
            <tr>
              <th scope="col" className={cn(cell, "font-semibold")}>Case</th>
              <th scope="col" className={cn(cell, "font-semibold")}>Hearing</th>
              <th scope="col" className={cn(cell, "font-semibold")}>Proceedings</th>
              <th scope="col" className={cn(cell, "font-semibold")}>Next hearing</th>
            </tr>
          </thead>
          <tbody>
            {document.entries.map((entry, index) => (
              <tr key={`${entry.caseNumber}-${index}`}>
                <td className={cn(cell, "w-1/5")}>
                  {entry.matter}
                  <br />
                  <span className="tabular-nums">{entry.caseNumber}</span>
                </td>
                <td className={cn(cell, "w-1/6")}>
                  {entry.hearing ?? (
                    <span className="sr-only">Passed outside a hearing</span>
                  )}
                </td>
                <td className={cell}>
                  <div className="flex flex-col gap-2">
                    {entry.paragraphs.map((paragraph, paragraphIndex) => (
                      <p key={paragraphIndex} className="whitespace-pre-line">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </td>
                <td className={cn(cell, "w-1/6")}>{entry.nextHearing}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-body text-paper-muted-foreground">{document.signature}</p>
    </article>
  );
}
