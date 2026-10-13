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

import { useEffect, useState, type ReactNode } from "react";
import {
  DownloadIcon,
  HourglassIcon,
  Maximize2Icon,
  SignatureIcon,
  UploadIcon,
  XCircleIcon,
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { FlowDialogContent } from "@/components/chrome/flow-dialog";
import {
  UPLOAD_HELP,
  UploadedDocField,
} from "@/components/cases/uploaded-doc-field";
import { SELF } from "@/lib/access/content";
import { formatCaseDate } from "@/lib/cases/types";
import { cn } from "@/lib/utils";
import { DOCUMENT_GROUND } from "@/components/cases/document-ground";
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

type SignStep = "choose" | "upload" | "aadhaar" | "done";
type AadhaarPhase = "authenticating" | "failure";

/**
 * Every footer in the signing flow (choose a method, upload, signed, failed)
 * sits on the warm well rather than the dialog's white, so the step's actions
 * read as a band of their own under the content (owner, Sept 18). The DS
 * footer's `bg-muted` is one hair off white and did not read as a fill at all.
 */
const FLOW_FOOTER = "bg-surface-sunken";

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
  /** What is signed, for the step's note: "application" or "document". */
  noun?: string;
  /**
   * A next step straight from the confirmation, beside a way to leave it for
   * later: the Applications register signs, then goes on to payment, as the
   * Raise application chain does ("Proceed to payment"). Without it the
   * confirmation ends on Done, as every party application does.
   */
  proceed?: { label: string; laterLabel: string; onClick: () => void };
}) {
  const [step, setStep] = useState<SignStep>("choose");
  const [aadhaar, setAadhaar] = useState<AadhaarPhase>("authenticating");
  const [signedFile, setSignedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);

  // Start fresh each time the dialog opens — reset here, at render on the
  // open→shut edge (React's "adjust state when a prop changes" pattern), not on
  // close: resetting on close would flash the chooser as the dialog animates
  // out. Not an effect, so no cascading render.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setStep("choose");
      setAadhaar("authenticating");
      setSignedFile(null);
      setError(undefined);
    }
  }

  /**
   * Aadhaar e-sign: in the live service the person is taken to the e-sign
   * provider and the system is told when they finish. Here that round trip is
   * stood in for — after a moment the signature is detected as complete. The
   * failure path is designed and reachable so the screen exists for when the
   * service says no.
   */
  useEffect(() => {
    if (!open || step !== "aadhaar" || aadhaar !== "authenticating") return;
    const timer = setTimeout(() => setStep("done"), 2000);
    return () => clearTimeout(timer);
  }, [open, step, aadhaar]);

  function submitUpload() {
    if (!signedFile) {
      setError("Upload the signed application to continue.");
      return;
    }
    setStep("done");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) return;
        // Success is committed — closing the confirmation finishes the flow.
        if (step === "done") onComplete();
        else onClose();
      }}
    >
      <FlowDialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        {step === "done" ? (
          <>
            <DialogHeader className="shrink-0 px-6 py-5 pr-14 text-left">
              <div className="flex items-center gap-4">
                <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-info-muted text-info-muted-foreground">
                  <HourglassIcon className="size-7" aria-hidden />
                </span>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <DialogTitle className="text-body font-semibold text-balance">
                    {confirmation.title}
                  </DialogTitle>
                  <DialogDescription>{confirmation.description}</DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <footer className={cn(FLOW_FOOTER, "flex shrink-0 justify-end gap-2 border-t border-hairline px-6 py-4")}>
              {proceed ? (
                <>
                  <Button type="button" variant="outline" onClick={onComplete}>
                    {proceed.laterLabel}
                  </Button>
                  <Button type="button" onClick={proceed.onClick}>
                    {proceed.label}
                  </Button>
                </>
              ) : (
                <Button type="button" onClick={onComplete}>
                  Done
                </Button>
              )}
            </footer>
          </>
        ) : step === "aadhaar" && aadhaar === "authenticating" ? (
          <div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
            <Spinner className="size-8 text-primary" />
            <div className="flex flex-col gap-1.5">
              <DialogTitle className="text-body font-semibold">
                Signing with Aadhaar
              </DialogTitle>
              <DialogDescription>
                Complete the signature in the Aadhaar e-sign service. We record
                it here as soon as it is done.
              </DialogDescription>
            </div>
            <p className="text-caption text-muted-foreground">
              Sandbox — this completes automatically in a moment.
            </p>
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-caption"
              onClick={() => setAadhaar("failure")}
            >
              Simulate a failed signature
            </Button>
          </div>
        ) : step === "aadhaar" && aadhaar === "failure" ? (
          <>
            <div className="flex flex-1 flex-col items-center gap-4 px-6 py-10 text-center">
              <span
                aria-hidden
                className="flex size-14 shrink-0 items-center justify-center rounded-full bg-destructive-muted text-destructive-ink"
              >
                <XCircleIcon className="size-7" />
              </span>
              <div className="flex flex-col gap-1.5">
                <DialogTitle className="text-body font-semibold text-balance">
                  Signature not completed
                </DialogTitle>
                <DialogDescription className="text-balance">
                  The Aadhaar e-sign service could not complete the signature.
                  Nothing was recorded. Try again, or upload a signed copy
                  instead.
                </DialogDescription>
              </div>
            </div>
            <footer className={cn(FLOW_FOOTER, "flex shrink-0 flex-col-reverse gap-2 border-t border-hairline px-6 py-4 sm:flex-row sm:items-center sm:justify-between")}>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("choose")}
              >
                Back
              </Button>
              <Button
                type="button"
                onClick={() => setAadhaar("authenticating")}
              >
                Try again
              </Button>
            </footer>
          </>
        ) : step === "upload" ? (
          <>
            <DialogHeader className="shrink-0 gap-1.5 border-b border-hairline px-6 py-5 pr-14 text-left">
              <DialogTitle className="text-body font-semibold text-balance">
                Upload a signed copy
              </DialogTitle>
              <DialogDescription>
                The application, signed on paper or with a Digital Signature
                Certificate.
              </DialogDescription>
            </DialogHeader>
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
              <Field data-invalid={Boolean(error) && !signedFile}>
                <FieldLabel className="block w-full font-semibold leading-snug">
                  Signed application
                </FieldLabel>
                <UploadedDocField
                  label="Signed application"
                  required
                  file={signedFile}
                  onFileChange={(file) => {
                    setSignedFile(file);
                    setError(undefined);
                  }}
                />
                <FieldDescription>{UPLOAD_HELP}</FieldDescription>
              </Field>
              <FieldError>{error}</FieldError>
            </div>
            <footer className={cn(FLOW_FOOTER, "flex shrink-0 flex-col-reverse gap-2 border-t border-hairline px-6 py-4 sm:flex-row sm:items-center sm:justify-between")}>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setError(undefined);
                  setStep("choose");
                }}
              >
                Back
              </Button>
              <Button type="button" onClick={submitUpload}>
                {submitLabel}
              </Button>
            </footer>
          </>
        ) : (
          <>
            <DialogHeader className="shrink-0 gap-1.5 border-b border-hairline px-6 py-5 pr-14 text-left">
              <DialogTitle className="text-body font-semibold text-balance">
                {chooseTitle}
              </DialogTitle>
              <DialogDescription>
                An unsigned {noun} cannot be submitted to the court.
              </DialogDescription>
            </DialogHeader>
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 py-5">
              <SignMethodCard
                icon={<SignatureIcon className="size-5" />}
                tone="info"
                title="E-Sign with Aadhaar OTP"
                description="You are taken to the Aadhaar e-sign service. The signature is recorded here as soon as it is done."
                onClick={() => {
                  setAadhaar("authenticating");
                  setStep("aadhaar");
                }}
              />
              <SignMethodCard
                icon={<UploadIcon className="size-5" />}
                tone="warning"
                title="Upload a signed copy"
                description="One file that already carries the signature, on paper or by DSC."
                onClick={() => {
                  setError(undefined);
                  setStep("upload");
                }}
              />
            </div>
            <footer className={cn(FLOW_FOOTER, "flex shrink-0 items-center border-t border-hairline px-6 py-4")}>
              <Button type="button" variant="outline" onClick={onBack ?? onClose}>
                Back
              </Button>
            </footer>
          </>
        )}
      </FlowDialogContent>
    </Dialog>
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
