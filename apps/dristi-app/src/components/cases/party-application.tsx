"use client";

/**
 * The application ending every application-type party flow shares (PM,
 * Sept 2, revised): the system composes a court-form document from what was
 * filled in, the person reviews it as the paper it will become, and SIGNS
 * before submitting.
 *
 * Two shared pieces, and the owning flow keeps its own frame around them —
 * same modal width, same heading, its own stepper if it has one — so nothing
 * jumps when the review comes up (owner, Sept 2):
 *
 * - `PartyApplicationDocument` — the review body: the Application / Case /
 *   Generated-on block, then the composed paper beneath it, Download and Full
 *   view as icon buttons on the sheet itself. Rendered inside the owning
 *   flow's own review step.
 * - `PartySignatureDialog` — a SMALL dialog that opens OVER that review: the
 *   complaint's two-card chooser (Aadhaar e-sign / upload a signed copy).
 *   Success shows the confirmation and Done closes both. Failure closes only
 *   this dialog, so the review underneath keeps its progress.
 *
 * Consent-route endings never come here: a request to a colleague is not
 * an application.
 */

import { type ReactNode } from "react";
import { DownloadIcon, Maximize2Icon } from "lucide-react";

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
  DialogTrigger,
} from "@/components/ui/dialog";
import { FlowDialogContent } from "@/components/chrome/flow-dialog";
import { SELF } from "@/lib/access/content";
import { formatCaseDate } from "@/lib/cases/types";
import { cn } from "@/lib/utils";
import { DOCUMENT_GROUND } from "@/components/cases/document-ground";
import { useProfile } from "@/components/shell/profile";
import { useCaseOfficeAccess } from "@/components/cases/case-office-access";
import { ESignDialog } from "@/components/cases/e-sign-dialog";
import { Identifier } from "@/components/chrome/identifier";
import { useCourtLocalized } from "@/components/court/court-provider";

/** The case, as the paper names it — passed down from whoever holds it. */
export type CaseRef = {
  title: string;
  caseNumber: string;
  court: string;
};

export type PartyApplicationDoc = {
  /** "Application for the removal of an advocate". */
  matter: string;
  facts: { term: string; value: string }[];
  /** The application's own paragraphs, applicant's voice. */
  prayer: string[];
};

/* ------------------------------------------------------------------ */
/* Review body — the meta block, then the composed paper               */
/* ------------------------------------------------------------------ */

/**
 * The review step's body, rendered inside the owning flow's own dialog step
 * (which keeps the heading and width). No witness/party details column: the
 * facts already sit on the paper, so the sheet is the review.
 */
export function PartyApplicationDocument({
  caseRef,
  doc,
}: {
  caseRef: CaseRef;
  doc: PartyApplicationDoc;
}) {
  // The download carries what the sheet shows: the selected state's court and numbers.
  const courtCaseRef = useCourtLocalized(caseRef);
  const courtDoc = useCourtLocalized(doc);
  const generatedOn = formatCaseDate(new Date().toISOString());

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg bg-surface-sunken p-4">
        <DescriptionList>
          <ReviewRow term="Application">{doc.matter}</ReviewRow>
          <ReviewRow term="Case">
            <Identifier value={caseRef.caseNumber} label="case number" />
          </ReviewRow>
          <ReviewRow term="Generated on">{generatedOn}</ReviewRow>
        </DescriptionList>
      </div>

      <div className="relative">
        {/* Download and Full view on the sheet itself, as icon buttons at its
            top-right (owner, Sept 2). They sit outside the scroll region so
            they stay put as the paper scrolls. */}
        <div className="absolute right-2 top-2 z-10 flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Download ${doc.matter}`}
            onClick={() => downloadPartyApplication(courtCaseRef, courtDoc, generatedOn)}
          >
            <DownloadIcon aria-hidden />
          </Button>
          <FullViewButton title={doc.matter}>
            <PartyApplicationPaper
              caseRef={caseRef}
              doc={doc}
              generatedOn={generatedOn}
            />
          </FullViewButton>
        </div>

        {/* The paper flows at full height and the DIALOG scrolls — one
            scrollbar. The old inner `max-h + overscroll-contain` region
            trapped the wheel at its own edge, so a long application read as
            "stops halfway" (owner, Sept 3). Full view stays for a bigger
            look. */}
        <div className="rounded-xl bg-surface-sunken p-4">
          <div className="mx-auto w-full max-w-3xl">
            <PartyApplicationPaper
              caseRef={caseRef}
              doc={doc}
              generatedOn={generatedOn}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Full view of the sheet, near the size of the window. */
function FullViewButton({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Full view of ${title}`}
        >
          <Maximize2Icon aria-hidden />
        </Button>
      </DialogTrigger>
      <FlowDialogContent className="flex h-[92svh] flex-col gap-4 overflow-hidden sm:max-w-[calc(100%-4rem)]">
        <DialogHeader className="pr-12">
          <DialogTitle className="text-title-s font-semibold break-words">
            {title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Full view. Close to go back.
          </DialogDescription>
        </DialogHeader>
        <div
          tabIndex={0}
          aria-label={`Preview of ${title}`}
          className={cn(
            "min-h-0 flex-1 overflow-auto rounded-xl p-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            DOCUMENT_GROUND
          )}
        >
          <div className="mx-auto w-full max-w-4xl">{children}</div>
        </div>
      </FlowDialogContent>
    </Dialog>
  );
}

/**
 * The court-form paper — the `paper` facsimile family, fixed in both
 * themes, per the generated-application precedent.
 */
function PartyApplicationPaper({
  caseRef: storedCaseRef,
  doc: storedDoc,
  generatedOn,
}: {
  caseRef: CaseRef;
  doc: PartyApplicationDoc;
  generatedOn: string;
}) {
  const caseRef = useCourtLocalized(storedCaseRef);
  const doc = useCourtLocalized(storedDoc);
  return (
    <article className="flex flex-col gap-6 rounded-md bg-paper p-6 text-paper-foreground [&_[data-slot=description-details]]:text-paper-foreground [&_[data-slot=description-term]]:text-paper-muted-foreground">
      <header className="flex flex-col gap-2 text-center">
        <p className="text-body font-semibold">{caseRef.court}</p>
        <p className="text-body font-semibold">Case no. {caseRef.caseNumber}</p>
        <p className="text-body font-semibold">{caseRef.title}</p>
        <p className="text-body-compact text-paper-muted-foreground">
          {doc.matter} · Date: {generatedOn}
        </p>
      </header>

      <DescriptionList className="rounded-md border border-paper-border px-4">
        {doc.facts.map((fact) => (
          <ReviewRow key={fact.term} term={fact.term}>
            {fact.value}
          </ReviewRow>
        ))}
      </DescriptionList>

      <div className="flex flex-col gap-3">
        {doc.prayer.map((paragraph) => (
          <p key={paragraph} className="text-body-compact text-pretty">
            {paragraph}
          </p>
        ))}
      </div>

      <div className="flex w-1/2 flex-col gap-1 self-end pt-4">
        <div className="h-px w-full bg-paper-border" aria-hidden />
        <p className="text-caption text-paper-muted-foreground">
          {SELF.name}, Advocate
        </p>
      </div>
    </article>
  );
}

/** The printable copy — plain text until a PDF service exists. */
function downloadPartyApplication(
  caseRef: CaseRef,
  doc: PartyApplicationDoc,
  generatedOn: string
) {
  const lines = [
    caseRef.court,
    `Case no. ${caseRef.caseNumber}`,
    caseRef.title,
    `${doc.matter} · Date: ${generatedOn}`,
    "",
    ...doc.facts.map((fact) => `${fact.term}: ${fact.value}`),
    "",
    ...doc.prayer,
    "",
    `${SELF.name}, Advocate`,
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${doc.matter.replaceAll(" ", "_")}_${caseRef.caseNumber.replaceAll("/", "-")}.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ */
/* Sign — a small dialog OVER the review                               */
/* ------------------------------------------------------------------ */

/**
 * Signing a party application, in the product's one signing (`ESignDialog`,
 * e-filing's; PM, Oct 26: the older two cards, Aadhaar and upload, were not
 * the signing model). Kept as its own name so every party flow signs the
 * same way without each changing how it asks.
 */
export function PartySignatureDialog({
  open,
  onClose,
  onBack,
  onComplete,
  confirmation,
  submitLabel = "Submit application",
  chooseTitle = "How is this application signed?",
  noun = "application",
  proceed,
}: {
  open: boolean;
  /** Dismiss the sign dialog only — the review stays open behind it. */
  onClose: () => void;
  /** The first step's Back, where the review did not stay open behind it:
   *  return to it. Defaults to closing. */
  onBack?: () => void;
  /** Signed and submitted — closes the sign dialog AND the review beneath. */
  onComplete: () => void;
  /** The success screen's copy — the flow's own "sent" message. */
  confirmation: { title: string; description: string };
  submitLabel?: string;
  /** The first step's heading; callers signing several at once reword it. */
  chooseTitle?: string;
  /** What is signed, for the steps' copy: "application" or "document". */
  noun?: string;
  /**
   * A next step straight from the confirmation, beside a way to leave it for
   * later: the Applications register signs, then goes on to payment, as the
   * Raise application chain does ("Proceed to payment"). Without it the
   * confirmation ends on Done, as every party application does.
   */
  proceed?: { label: string; laterLabel: string; onClick: () => void };
}) {
  /* The case page cannot tell the profile; a litigant or party in person
     signing their own never holds office access. */
  const { profileRole } = useProfile();
  const officeAccess = useCaseOfficeAccess() && profileRole !== "litigant";
  return (
    <ESignDialog
      open={open}
      noun={noun}
      chooseTitle={chooseTitle}
      submitLabel={submitLabel}
      officeAccess={officeAccess}
      onBack={onBack ?? onClose}
      onDismiss={onClose}
      onComplete={onComplete}
      confirmation={{ ...confirmation, tone: "waiting" }}
      proceed={proceed}
    />
  );
}

/** One method on the sign chooser — the complaint sign step's card grammar.
 *  Exported so the application chain's signing step is built from the same card. */
export function SignMethodCard({
  icon,
  tone,
  title,
  description,
  onClick,
}: {
  icon: ReactNode;
  /** `neutral` is for a way of not signing now: no status colour to claim. */
  tone: "info" | "warning" | "neutral";
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-start gap-4 rounded-xl border border-border p-4 text-left transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span
        aria-hidden
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg",
          tone === "info"
            ? "bg-info-muted text-info-muted-foreground"
            : tone === "warning"
              ? "bg-warning-muted text-warning-muted-foreground"
              : "bg-surface-sunken text-muted-foreground group-hover:bg-background"
        )}
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-body-compact font-semibold text-foreground">
          {title}
        </span>
        <span className="text-body-compact text-muted-foreground">
          {description}
        </span>
      </span>
    </button>
  );
}

function ReviewRow({
  term,
  children,
}: {
  term: string;
  children: React.ReactNode;
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
