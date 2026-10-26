"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2Icon,
  HourglassIcon,
  SignatureIcon,
  UploadIcon,
} from "lucide-react";

import { FlowDialogContent } from "@/components/chrome/flow-dialog";
import {
  ChoiceCard,
  DscLookup,
  InstrumentChoice,
  OtpEntry,
} from "@/components/filing/sign-stages";
import { PaperFallbackLink } from "@/components/filing/paper-fallback";
import { OFFICE_NO_ESIGN } from "@/components/cases/case-office-access";
import {
  UPLOAD_HELP,
  UploadedDocField,
} from "@/components/cases/uploaded-doc-field";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

type Step = "method" | "instrument" | "otp" | "dsc" | "upload" | "done";

const SIGNED_WITH = {
  aadhaar: "Signed with Aadhaar OTP.",
  dsc: "Signed with a DSC.",
  paper: "Signed copy added.",
} as const;

/**
 * The product's one signing, e-filing's (owner, 2026-10-12; PM, Oct 26: every
 * filing signs this way, not with the older two-card dialog): one card to
 * sign digitally, which then asks Aadhaar OTP or DSC, and a physically signed
 * copy as the way out beneath it. The OTP and the certificate are sandboxed,
 * as they are everywhere else.
 *
 * What happens once signed is the caller's: a document is on the record at
 * once, a party application goes to the magistrate, an application filed
 * from its register goes on to its fee (`proceed`).
 */
export function ESignDialog({
  open,
  noun,
  chooseTitle,
  submitLabel = "Submit signature",
  officeAccess = false,
  onBack,
  onDismiss,
  onSignLater,
  onComplete,
  confirmation,
  proceed,
}: {
  open: boolean;
  /** What is signed, in the steps' copy: "document", "2 documents", "application". */
  noun: string;
  /** The first step's heading. */
  chooseTitle: string;
  /** The paper path's button. */
  submitLabel?: string;
  /**
   * Office access never e-signs (OFC-06): the first step says so and offers
   * only a copy signed by an advocate on the vakalatnama.
   */
  officeAccess?: boolean;
  /** The first step's Back: return to what was being read. */
  onBack: () => void;
  /** Closed before signing, from the window's own close. Defaults to Back. */
  onDismiss?: () => void;
  /** Leave it unsigned for now; the caller keeps it as Pending signature. */
  onSignLater?: () => void;
  /** Signed; the confirmation is closed. */
  onComplete: () => void;
  /**
   * The confirmation's copy. `done` when signing finishes it (a green mark),
   * `waiting` when it goes on to someone else (the hourglass).
   */
  confirmation: { title: string; description: string; tone?: "done" | "waiting" };
  /** A next step straight from the confirmation, beside leaving it for later. */
  proceed?: { label: string; laterLabel: string; onClick: () => void };
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState<Step>("method");
  const [otp, setOtp] = useState("");
  const [otpResent, setOtpResent] = useState(false);
  const [dscFound, setDscFound] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | undefined>(undefined);
  const [signedWith, setSignedWith] = useState<keyof typeof SIGNED_WITH>("aadhaar");

  /* Start fresh each time it opens, at render on the closed→open edge. */
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setStep("method");
      setOtp("");
      setOtpResent(false);
      setDscFound(false);
      setFile(null);
      setFileError(undefined);
    }
  }

  /* The certificate utility takes a beat to answer, as in e-filing. */
  useEffect(() => {
    if (!open || step !== "dsc" || dscFound) return;
    const timer = setTimeout(() => setDscFound(true), 1100);
    return () => clearTimeout(timer);
  }, [open, step, dscFound]);

  /* A new step replaces the content; focusing its title announces it. */
  useEffect(() => {
    if (open && step !== "method") titleRef.current?.focus();
  }, [open, step]);

  function signWith(instrument: keyof typeof SIGNED_WITH) {
    setSignedWith(instrument);
    setStep("done");
  }

  const title = {
    method: chooseTitle,
    instrument: "Add your e-signature",
    otp: "Enter the OTP",
    dsc: "Sign with your DSC",
    upload: "Upload a signed copy",
    done: "",
  }[step];

  const description = {
    method: `An unsigned ${noun.replace(/^\d+ /, "").replace(/s$/, "")} cannot be submitted to the court.`,
    instrument: "Either one is your own signature. Use whichever you have.",
    otp: "Sent to your Aadhaar-linked mobile.",
    dsc: "Your certificate has to be plugged in, with the signing utility running on this computer.",
    upload: `The ${noun}, signed on paper or with a Digital Signature Certificate.`,
    done: "",
  }[step];

  const FOOTER =
    "flex shrink-0 flex-col-reverse gap-2 border-t border-hairline bg-surface-sunken px-6 py-4 sm:flex-row sm:items-center sm:justify-between";
  const done = confirmation.tone === "done";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) return;
        // Once signed it is committed; closing the confirmation finishes.
        if (step === "done") onComplete();
        else (onDismiss ?? onBack)();
      }}
    >
      <FlowDialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        {step === "done" ? (
          <DialogHeader className="shrink-0 px-6 py-5 pr-14 text-left">
            <div className="flex items-center gap-4">
              <span
                aria-hidden
                className={cn(
                  "flex size-14 shrink-0 items-center justify-center rounded-full",
                  done
                    ? "bg-success-muted text-success-muted-foreground"
                    : "bg-info-muted text-info-muted-foreground"
                )}
              >
                {done ? (
                  <CheckCircle2Icon className="size-7" />
                ) : (
                  <HourglassIcon className="size-7" />
                )}
              </span>
              <div className="flex min-w-0 flex-col gap-1.5">
                <DialogTitle
                  ref={titleRef}
                  tabIndex={-1}
                  className="text-body font-semibold text-balance outline-none"
                >
                  {confirmation.title}
                </DialogTitle>
                <DialogDescription>
                  {SIGNED_WITH[signedWith]} {confirmation.description}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        ) : (
          <>
            <DialogHeader className="shrink-0 gap-1.5 border-b border-hairline px-6 py-4 pr-12 text-left">
              <DialogTitle
                ref={titleRef}
                tabIndex={-1}
                className="text-body font-semibold text-balance outline-none"
              >
                {title}
              </DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </DialogHeader>

            <div
              className={cn(
                "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 py-6",
                // e-filing's choice cards sit on its tinted canvas.
                (step === "method" || step === "instrument") &&
                  "gap-4 bg-muted dark:bg-background"
              )}
            >
              {step === "method" && officeAccess ? (
                <>
                  <Banner variant="info">{OFFICE_NO_ESIGN}</Banner>
                  <ChoiceCard
                    title="Upload a signed copy"
                    tone="bg-warning-muted text-warning-muted-foreground"
                    icon={<UploadIcon className="size-5" />}
                    onClick={() => {
                      setFileError(undefined);
                      setStep("upload");
                    }}
                  >
                    One file signed by an advocate on the vakalatnama.
                  </ChoiceCard>
                </>
              ) : step === "method" ? (
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
                  id="e-sign-otp"
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
                </>
              ) : null}
            </div>
          </>
        )}

        {step === "method" || step === "instrument" ? (
          <footer className={FOOTER}>
            <Button
              type="button"
              variant="outline"
              onClick={() => (step === "instrument" ? setStep("method") : onBack())}
            >
              Back
            </Button>
            {onSignLater ? (
              <Button type="button" variant="ghost" onClick={onSignLater}>
                I&rsquo;ll sign later
              </Button>
            ) : null}
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

        {step === "upload" ? (
          <footer className={FOOTER}>
            <Button type="button" variant="outline" onClick={() => setStep("method")}>
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
              {submitLabel}
            </Button>
          </footer>
        ) : null}

        {step === "done" ? (
          <footer className={cn(FOOTER, "sm:justify-end")}>
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
        ) : null}
      </FlowDialogContent>
    </Dialog>
  );
}

/** A document's signing: signing is submitting, it never pays (DSB-19). */
export function DocumentSignatureDialog({
  open,
  count = 1,
  onBack,
  onSignLater,
  onComplete,
}: {
  open: boolean;
  /** How many documents this one signature covers (Sign all). */
  count?: number;
  onBack: () => void;
  onSignLater?: () => void;
  onComplete: () => void;
}) {
  const several = count > 1;
  return (
    <ESignDialog
      open={open}
      noun={several ? "documents" : "document"}
      chooseTitle={
        several ? `How are these ${count} documents signed?` : "How is this document signed?"
      }
      onBack={onBack}
      onSignLater={onSignLater}
      onComplete={onComplete}
      confirmation={{
        tone: "done",
        title: several ? `${count} documents submitted` : "Document submitted",
        description: several
          ? "They are on the case record now. Everyone on the case can see them."
          : "It is on the case record now. Everyone on the case can see it.",
      }}
    />
  );
}
