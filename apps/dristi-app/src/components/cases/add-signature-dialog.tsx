"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ClockIcon,
  DownloadIcon,
  SignatureIcon,
} from "lucide-react";

import { FlowDialogContent } from "@/components/chrome/flow-dialog";

import {
  ChoiceCard,
  DscLookup,
  InstrumentChoice,
  OtpEntry,
} from "@/components/filing/sign-stages";
import { PaperFallbackLink } from "@/components/filing/paper-fallback";
import {
  GATEWAY_MS,
  PAYMENT_PROCESSING_BODY,
  PAYMENT_PROCESSING_TITLE,
  PAYMENT_SUCCESS_TITLE,
  PaymentProcessing,
  PaymentFacts,
} from "@/components/payment/payment-steps";
import {
  OutcomeAmount,
  OutcomeHeader,
  OutcomeSummary,
  StatusLine,
} from "@/components/feedback";
import {
  UPLOAD_HELP,
  UploadedDocField,
} from "@/components/cases/uploaded-doc-field";
import { Badge } from "@/components/ui/badge";
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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import {
  COURT_FEE,
  CourtFeeSummary,
} from "@/components/cases/submission-payment-dialog";
import { downloadGeneratedApplication } from "@/lib/cases/application-document";
import { newPaymentRef } from "@/lib/filing/data";
import { type ApplicationDraft } from "@/lib/cases/application-draft";
import { applicationTypeGuide } from "@/lib/cases/application-type-guide";
import { applicationsFile } from "@/lib/cases/applications";
import { formatCaseDate, type CaseRecord } from "@/lib/cases/types";
import { Identifier } from "@/components/chrome/identifier";
import { cn } from "@/lib/utils";

/** Where a filing stopped when the signing chain closed. */
export type SigningOutcome =
  | { status: "pending-signature" }
  | { status: "pending-payment" }
  | { status: "paid"; temporaryId: string };

type SignatureStep =
  | "method"
  /** e-filing's signing (owner, 2026-10-12): digitally → Aadhaar OTP or DSC. */
  | "instrument"
  | "otp"
  | "dsc"
  | "upload"
  | "signed"
  | "payment"
  /** The gateway round trip, then its receipt (owner, 2026-10-12). */
  | "processing"
  | "receipt"
  | "success"
  /** Signed by nobody yet — Sign later and Notify senior both land here. */
  | "pending";

/**
 * The chain after Generate application, mirroring the legacy portal's
 * modals: choose a signature method → upload the signed copy → signed
 * confirmation → court-fee payment → submission confirmation. One dialog,
 * one step union — the legacy's separate modals are steps of the same task.
 *
 * The signing steps are e-filing's (owner, 2026-10-12), built from its own parts
 * (`sign-stages`): one card to sign digitally, which then asks Aadhaar OTP or DSC, and
 * a physically signed copy as the way out beneath it. Sign later and Download stay,
 * as this chain had them. The OTP and the certificate are sandboxed and say so.
 *
 * Sign later leaves the chain early: it does not
 * sign, so it never reaches payment — an unsigned application has nothing to
 * file yet. Both end on the same confirmation, which states the one thing
 * that is true of each, that the application waits in Applications as Pending
 * signature. Nothing here persists, so nothing claims a signature was taken.
 *
 * Payment is deliberately not designed: Make payment marks the fee paid on
 * the spot (product's ask), and Skip leaves the submission pending payment —
 * the same state the Applications register already models.
 *
 * Submitted means signed and paid (Application Lifecycle PRD, ALC-01), so
 * only a paid filing is called submitted and only a paid filing gets its
 * temporary ID (ALC-02). A clerk never signs: for them the chain ends on the
 * hand-off to the advocate who will.
 */
export function AddSignatureDialog({
  open,
  onOpenChange,
  draft,
  record,
  onBack,
  onComplete,
  onReturnFocus,
  handoffTo,
  objection,
  done,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: ApplicationDraft;
  record: CaseRecord;
  /**
   * Set when the person filing may not sign (a clerk): the advocate who will.
   * The chain skips the signing cards and ends on the hand-off.
   */
  handoffTo?: string;
  /** Set when the filing is an objection: what it objects to, and when that is decided. */
  objection?: { target: string; inSentence: string; decision?: string };
  /** Return to the generated-application dialog. */
  onBack: () => void;
  /**
   * The chain is done — leave for the Applications register. Says where the
   * filing stopped, so the caller can record it: waiting for a signature
   * (signed later, or handed to the advocate), waiting for payment, or paid
   * with its temporary ID.
   */
  onComplete: (outcome: SigningOutcome) => void;
  onReturnFocus: () => void;
  /**
   * The last button, where the filer goes next. Unset it is Done. Filing bail straight
   * after joining a case ends on View case: the person joined from home, so the case is
   * where they go next (owner, 2026-10-12).
   */
  done?: { label: string; onClick: () => void };
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const firstStep: SignatureStep = handoffTo ? "pending" : "method";
  const [step, setStep] = useState<SignatureStep>(firstStep);
  const noun = objection ? "objection" : "application";
  const Noun = objection ? "Objection" : "Application";
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | undefined>(undefined);
  const [paid, setPaid] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpResent, setOtpResent] = useState(false);
  const [dscFound, setDscFound] = useState(false);
  const [signedWith, setSignedWith] = useState<"aadhaar" | "dsc" | "paper">("aadhaar");

  /* The certificate utility takes a beat to answer, as in e-filing. */
  useEffect(() => {
    if (!open || step !== "dsc" || dscFound) return;
    const timer = setTimeout(() => setDscFound(true), 1100);
    return () => clearTimeout(timer);
  }, [open, step, dscFound]);

  function signWith(instrument: "aadhaar" | "dsc" | "paper") {
    setSignedWith(instrument);
    setStep("signed");
  }

  /* Paying stands in for the gateway the same way: a moment of processing, then a
     receipt, as e-filing and joining a case do (owner, 2026-10-12). */
  const [paymentRef, setPaymentRef] = useState("");
  useEffect(() => {
    if (!open || step !== "processing") return;
    const timer = setTimeout(() => {
      setPaid(true);
      setPaymentRef(newPaymentRef());
      setStep("receipt");
    }, GATEWAY_MS);
    return () => clearTimeout(timer);
  }, [open, step]);

  /**
   * The temporary ID this case would allot on submission (ALC-02) — existing
   * applications plus one, in the legacy's {case}-AP{n} shape. Dummy, but
   * grounded in what the register already holds rather than invented.
   */
  const temporaryId = useMemo(() => {
    const count = applicationsFile(record).submissions.filter(
      (submission) => submission.kind === "application",
    ).length;
    return `${record.caseNumber}-AP${count + 1}`;
  }, [record]);

  /**
   * Swapping the step replaces the dialog's content wholesale; landing focus
   * on the new title is what announces the change. Initial open keeps
   * Radix's own focus handling — this only runs on a step change.
   */
  useEffect(() => {
    if (step !== "method") titleRef.current?.focus();
  }, [step]);

  /** Every path out of the dialog runs through an event handler — reset there. */
  function reset() {
    setStep(firstStep);
    setFile(null);
    setFileError(undefined);
    setPaid(false);
    setOtp("");
    setOtpResent(false);
    setDscFound(false);
  }

  function finish() {
    const outcome: SigningOutcome =
      step === "pending"
        ? { status: "pending-signature" }
        : paid
          ? { status: "paid", temporaryId }
          : { status: "pending-payment" };
    reset();
    onComplete(outcome);
  }

  function handleOpenChange(next: boolean) {
    // The gateway is confirming; the window holds until it answers.
    if (!next && step === "processing") return;
    if (!next) {
      // Once a confirmation is up, closing is finishing — dropping back into
      // the filled form after the screen said the application was submitted,
      // saved, or sent to a senior would contradict what was just shown.
      if (step === "success" || step === "pending" || step === "receipt") {
        finish();
        return;
      }
      reset();
    }
    onOpenChange(next);
  }

  /* e-filing's own words for the shared steps (`sign-flow-dialog`). */
  const stepTitle = {
    method: `How is this ${noun} signed?`,
    instrument: "Add your e-signature",
    otp: "Enter the OTP",
    dsc: "Sign with your DSC",
    upload: "Upload a signed copy",
    signed: "Your signature",
    payment: "Payment",
    processing: PAYMENT_PROCESSING_TITLE,
    receipt: PAYMENT_SUCCESS_TITLE,
    success: "",
    pending: "",
  }[step];

  const stepDescription = {
    method: `An unsigned ${noun} cannot be submitted to the court.`,
    instrument: "Either one is your own signature — use whichever you have.",
    otp: "Sent to your Aadhaar-linked mobile.",
    dsc: "Your certificate has to be plugged in, with the signing utility running on this computer.",
    upload: `The ${noun}, signed by hand on paper.`,
    signed: `The ${noun} is signed and ready to file.`,
    payment: `Court fee for filing this ${noun}.`,
    processing: PAYMENT_PROCESSING_BODY,
    receipt: `Court fee of ${COURT_FEE} paid for this ${noun}.`,
    success: "",
    pending: "",
  }[step];

  const FOOTER =
    "flex shrink-0 flex-col-reverse gap-2 border-t border-hairline bg-surface-sunken px-6 py-4 sm:flex-row sm:items-center sm:justify-between";

  function backToMethods() {
    setFileError(undefined);
    setStep("method");
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <FlowDialogContent
        ownBack
        className={cn(
          "flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md",
          step === "processing" && "[&_[data-slot=dialog-close]]:hidden",
        )}
        // Radix's own restore lands on document.body here, so put focus back
        // on the button that opened the chain explicitly.
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onReturnFocus();
        }}
      >
        {step === "success" ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <SuccessContent
              paid={paid}
              temporaryId={temporaryId}
              noun={Noun}
              objection={objection}
            />
          </div>
        ) : step === "pending" ? (
          /*
            Saved for later, in the confirmation grammar the party applications
            end on: the mark, what happened, then the facts of the thing saved.
            Amber, not green: nothing is filed yet, and the register will call
            this Pending signature in the same colour.
          */
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {/* Waiting on someone else: sent, not decided (the hourglass). Waiting on
                you: a normal step, not a warning (owner rule), so neutral with today's
                clock; the Pending badge below keeps the amber. */}
            <OutcomeHeader
              key="pending"
              compact
              titleFrom="dialog"
              focusTitle
              tone={handoffTo ? "info" : "neutral"}
              icon={handoffTo ? undefined : ClockIcon}
              title={
                handoffTo
                  ? `Saved. Waiting for ${handoffTo} to sign`
                  : "Saved. Waiting for your signature"
              }
              body={
                handoffTo
                  ? "Nothing has gone to the court yet. They sign it from the case's Applications tab."
                  : "Nothing has gone to the court yet. Sign it from the case's Applications tab when you are ready."
              }
            />

            <div className="px-6 py-6">
            <OutcomeSummary>
            <dl className="flex flex-col text-body-compact">
              <div className="flex items-baseline justify-between gap-4 border-b border-hairline py-2.5">
                <dt className="text-muted-foreground">{Noun}</dt>
                <dd className="min-w-0 text-right font-medium">
                  {objection
                    ? objection.target
                    : applicationTypeGuide(draft.type || "application-others")
                        .label}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 border-b border-hairline py-2.5">
                <dt className="text-muted-foreground">Case</dt>
                <dd className="font-medium">
                  <Identifier value={record.caseNumber} label="case number" />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-2.5">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <Badge variant="warning">Pending signature</Badge>
                </dd>
              </div>
            </dl>
            </OutcomeSummary>
            </div>
          </div>
        ) : (
          <>
            {step === "receipt" ? (
              <OutcomeHeader key="receipt" compact titleFrom="dialog" focusTitle title={stepTitle} body={stepDescription}>
                <OutcomeAmount label="Amount paid" value={COURT_FEE} />
              </OutcomeHeader>
            ) : (
            <DialogHeader className="shrink-0 gap-1.5 border-b border-hairline px-6 py-4 pr-12 text-left">
              {/* The chip is the step's own status, so only the two steps that
                  report one carry it. */}
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle
                  ref={titleRef}
                  tabIndex={-1}
                  className="text-body font-semibold text-balance outline-none"
                >
                  {stepTitle}
                </DialogTitle>
                {step === "signed" ? (
                  <Badge variant="success">Signed</Badge>
                ) : null}
              </div>
              <DialogDescription>{stepDescription}</DialogDescription>
            </DialogHeader>
            )}

            <div
              className={cn(
                "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 py-6",
                // Payment: the body is the well and the fees are the white
                // sheet on it, as in the View Case payment dialog.
                step === "payment" && "bg-surface-sunken",
                // e-filing's choice cards sit on its tinted canvas.
                (step === "method" || step === "instrument") && "gap-4 bg-muted dark:bg-background",
              )}
            >
              {step === "method" ? (
                <>
                  <ChoiceCard
                    title="Sign digitally"
                    tone="bg-brand-muted text-brand-muted-foreground"
                    icon={<SignatureIcon className="size-5" />}
                    onClick={() => setStep("instrument")}
                  >
                    You sign the {noun} with your DSC or Aadhaar e-sign.
                  </ChoiceCard>
                  <PaperFallbackLink
                    onClick={() => {
                      setFileError(undefined);
                      setStep("upload");
                    }}
                  />
                </>
              ) : null}

              {step === "instrument" ? (
                <InstrumentChoice
                  onAadhaar={() => {
                    setOtp("");
                    setStep("otp");
                  }}
                  onDsc={() => {
                    setDscFound(false);
                    setStep("dsc");
                  }}
                />
              ) : null}

              {step === "otp" ? (
                <OtpEntry
                  id="application-esign-otp"
                  value={otp}
                  onChange={setOtp}
                  resent={otpResent}
                  onResend={() => setOtpResent(true)}
                />
              ) : null}

              {step === "dsc" ? <DscLookup found={dscFound} holder="" /> : null}

              {step === "upload" ? (
                <>
                  <Field data-invalid={Boolean(fileError) && !file}>
                    <FieldLabel className="block w-full font-semibold leading-snug">
                      Signed {noun}
                    </FieldLabel>
                    <UploadedDocField
                      label={`Signed ${noun}`}
                      required
                      file={file}
                      onFileChange={(next) => {
                        setFile(next);
                        setFileError(undefined);
                      }}
                    />
                    <FieldDescription>{UPLOAD_HELP}</FieldDescription>
                  </Field>
                  <FieldError>{fileError}</FieldError>
                  {/* Where e-filing keeps it: the unsigned copy is only needed to
                      sign on paper, so it is offered on the paper path. */}
                  <p className="flex flex-wrap items-center gap-1 text-body-compact">
                    Need the unsigned {noun} to sign on paper?
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto p-0 underline"
                      onClick={() => downloadGeneratedApplication(draft, record)}
                    >
                      Download it
                    </Button>
                  </p>
                </>
              ) : null}

              {step === "signed" ? (
                <StatusLine tone="success">
                  {signedWith === "aadhaar"
                    ? "Signed with Aadhaar OTP."
                    : signedWith === "dsc"
                      ? "Signed with a DSC."
                      : `Signed copy added to this ${noun}.`}
                </StatusLine>
              ) : null}

              {/* The register's payment dialog shows the same block. */}
              {step === "payment" ? <CourtFeeSummary /> : null}

              {step === "processing" ? <PaymentProcessing /> : null}

              {step === "receipt" ? (
                <PaymentFacts
                  rows={[
                    {
                      label: "Case",
                      value: <Identifier value={record.caseNumber} label="case number" />,
                    },
                    {
                      label: "Payment reference",
                      value: <Identifier value={paymentRef} label="payment reference" />,
                    },
                  ]}
                />
              ) : null}
            </div>
          </>
        )}

        {/* The signing flow's warm footer band; see `FLOW_FOOTER` in
            party-application.tsx. */}
        {step === "method" || step === "instrument" ? (
          <footer className={FOOTER}>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (step === "instrument") {
                  setStep("method");
                  return;
                }
                reset();
                onBack();
              }}
            >
              Back
            </Button>
            {/* Sign later stays, as e-filing words it: saved unsigned, waiting in
                Applications as Pending signature. */}
            <Button type="button" variant="ghost" onClick={() => setStep("pending")}>
              I&rsquo;ll sign later
            </Button>
          </footer>
        ) : null}

        {step === "otp" ? (
          <footer className={FOOTER}>
            <Button type="button" variant="outline" onClick={() => setStep("instrument")}>
              Back
            </Button>
            <Button type="button" disabled={otp.length < 6} onClick={() => signWith("aadhaar")}>
              Verify and sign
            </Button>
          </footer>
        ) : null}

        {step === "dsc" ? (
          <footer className={FOOTER}>
            <Button type="button" variant="outline" onClick={() => setStep("instrument")}>
              Back
            </Button>
            <Button type="button" disabled={!dscFound} onClick={() => signWith("dsc")}>
              Sign with this certificate
            </Button>
          </footer>
        ) : null}

        {step === "receipt" ? (
          <footer className={FOOTER}>
            <span aria-hidden />
            <Button type="button" onClick={() => setStep("success")}>
              Continue
            </Button>
          </footer>
        ) : null}

        {step === "upload" ? (
          <footer className={FOOTER}>
            <Button type="button" variant="outline" onClick={backToMethods}>
              Back
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!file) {
                  setFileError(`Upload the signed ${noun} to continue.`);
                  return;
                }
                signWith("paper");
              }}
            >
              Submit signature
            </Button>
          </footer>
        ) : null}

        {step === "signed" ? (
          <footer className={FOOTER}>
            <Button type="button" variant="outline" onClick={backToMethods}>
              Back
            </Button>
            <Button type="button" onClick={() => setStep("payment")}>
              Proceed to payment
            </Button>
          </footer>
        ) : null}

        {step === "pending" ? (
          <footer className={FOOTER}>
            {/* Changing your mind is one click: back to the ways of signing.
                Not for a clerk, who has no way of signing to go back to. */}
            {handoffTo ? (
              <span aria-hidden />
            ) : (
              <Button type="button" variant="outline" onClick={backToMethods}>
                Sign now
              </Button>
            )}
            <Button
              type="button"
              onClick={() => {
                finish();
                done?.onClick();
              }}
            >
              {done?.label ?? "Done"}
            </Button>
          </footer>
        ) : null}

        {step === "payment" ? (
          <footer className={cn(FOOTER, "bg-background")}>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPaid(false);
                setStep("success");
              }}
            >
              Skip
            </Button>
            <Button type="button" onClick={() => setStep("processing")}>
              Make payment
            </Button>
          </footer>
        ) : null}

        {step === "success" ? (
          <footer className={FOOTER}>
            <Button
              type="button"
              variant="outline"
              onClick={() => downloadGeneratedApplication(draft, record)}
            >
              <DownloadIcon data-icon="inline-start" aria-hidden />
              Download submission
            </Button>
            {paid ? (
              <Button
                type="button"
                onClick={() => {
                  finish();
                  done?.onClick();
                }}
              >
                {done?.label ?? "Done"}
              </Button>
            ) : (
              <Button type="button" onClick={() => setStep("processing")}>
                Make payment
              </Button>
            )}
          </footer>
        ) : null}
      </FlowDialogContent>
    </Dialog>
  );
}

/**
 * The submission confirmation, mirroring the legacy's final modal: the mark,
 * what happened, and the allotted ID. The heading carries the DialogTitle so
 * the confirmation is what a screen reader hears.
 *
 * Only a paid filing is submitted (ALC-01), so an unpaid one ends amber, on
 * what it is still waiting for, and has no ID yet: the temporary ID is
 * allotted on submission (ALC-02).
 */
function SuccessContent({
  paid,
  temporaryId,
  noun,
  objection,
}: {
  paid: boolean;
  temporaryId: string;
  noun: string;
  objection?: { target: string; inSentence: string; decision?: string };
}) {
  const next = objection
    ? `It is read with the other side's ${objection.inSentence} when the court decides it${
        objection.decision ? ` on ${objection.decision}` : ""
      }.`
    : "It is with the court now. The court takes it up next and gives it an application number.";
  return (
    <>
      {/* The filing's outcome takes over the window (skill `feedback-states`). Unpaid is
          a normal next step, not a warning: neutral with today's clock, and the amber
          stays on the Pending payment badge. */}
      <OutcomeHeader
        key="success"
        compact
        titleFrom="dialog"
        focusTitle
        tone={paid ? "success" : "neutral"}
        icon={paid ? undefined : ClockIcon}
        title={paid ? `${noun} submitted` : "Signed. Waiting for payment"}
        body={
          paid
            ? next
            : "Nothing reaches the court until the court fee is paid. Pay it here, or later from the case's Applications tab."
        }
      />

      <div className="flex flex-col gap-4 px-6 py-6">
        <OutcomeSummary>
        <DescriptionList>
          <DescriptionRow className="grid-cols-[1fr_auto] items-center border-hairline">
            <DescriptionTerm className="text-body-compact">
              {paid ? "Submission date" : "Signed on"}
            </DescriptionTerm>
            <DescriptionDetails className="text-body-compact">
              {formatCaseDate(new Date().toISOString())}
            </DescriptionDetails>
          </DescriptionRow>
          {paid ? (
            <DescriptionRow className="grid-cols-[1fr_auto] items-center border-hairline">
              <DescriptionTerm className="text-body-compact">
                {objection ? "Filing ID" : "Temporary ID"}
              </DescriptionTerm>
              {/* The value is its own copy control now, so the icon button beside it
                  went with the conversion — same confirmation, one thing to hit. */}
              <DescriptionDetails className="flex items-center gap-2 text-body-compact font-medium">
                <Identifier value={temporaryId} label="temporary id" />
              </DescriptionDetails>
            </DescriptionRow>
          ) : null}
          {paid ? (
            /* One mark on the screen: the fee is a fact here, as on the bail filing's
               outcome, not a second green line. */
            <DescriptionRow className="grid-cols-[1fr_auto] items-center border-hairline">
              <DescriptionTerm className="text-body-compact">Court fee</DescriptionTerm>
              <DescriptionDetails className="text-body-compact tabular-nums">
                {COURT_FEE} paid
              </DescriptionDetails>
            </DescriptionRow>
          ) : (
            <DescriptionRow className="grid-cols-[1fr_auto] items-center border-hairline">
              <DescriptionTerm className="text-body-compact">Status</DescriptionTerm>
              <DescriptionDetails>
                <Badge variant="warning">Pending payment</Badge>
              </DescriptionDetails>
            </DescriptionRow>
          )}
        </DescriptionList>
        </OutcomeSummary>
      </div>
    </>
  );
}
