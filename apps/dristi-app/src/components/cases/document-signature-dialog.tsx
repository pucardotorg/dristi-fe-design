"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2Icon, SignatureIcon } from "lucide-react";

import { FlowDialogContent } from "@/components/chrome/flow-dialog";
import {
  ChoiceCard,
  DscLookup,
  InstrumentChoice,
  OtpEntry,
} from "@/components/filing/sign-stages";
import { PaperFallbackLink } from "@/components/filing/paper-fallback";
import {
  UPLOAD_HELP,
  UploadedDocField,
} from "@/components/cases/uploaded-doc-field";
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
 * Signing a document, in e-filing's signing (owner, 2026-10-12; PM, Oct 26:
 * the model Raise application signs with, not the older two-card dialog):
 * one card to sign digitally, which then asks Aadhaar OTP or DSC, and a
 * physically signed copy as the way out beneath it. Sign later stays.
 *
 * A document never pays (DSB-19), so signing is submitting: the chain ends
 * on the document being on the record, not on a fee. The OTP and the
 * certificate are sandboxed, as they are everywhere else.
 */
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
  /** The first step's Back: return to what was being read. */
  onBack: () => void;
  /** Leave it unsigned for now; the caller keeps it as Pending signature. */
  onSignLater?: () => void;
  /** Signed, and so submitted. */
  onComplete: () => void;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState<Step>("method");
  const [otp, setOtp] = useState("");
  const [otpResent, setOtpResent] = useState(false);
  const [dscFound, setDscFound] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | undefined>(undefined);
  const [signedWith, setSignedWith] = useState<keyof typeof SIGNED_WITH>("aadhaar");

  const several = count > 1;
  const noun = several ? "documents" : "document";
  const these = several ? `these ${count} documents` : "this document";

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
    method: `How ${several ? "are" : "is"} ${these} signed?`,
    instrument: "Add your e-signature",
    otp: "Enter the OTP",
    dsc: "Sign with your DSC",
    upload: "Upload a signed copy",
    done: "",
  }[step];

  const description = {
    method: `An unsigned ${noun.replace(/s$/, "")} cannot be submitted to the court.`,
    instrument: "Either one is your own signature. Use whichever you have.",
    otp: "Sent to your Aadhaar-linked mobile.",
    dsc: "Your certificate has to be plugged in, with the signing utility running on this computer.",
    upload: `The ${noun}, signed by hand on paper.`,
    done: "",
  }[step];

  const FOOTER =
    "flex shrink-0 flex-col-reverse gap-2 border-t border-hairline bg-surface-sunken px-6 py-4 sm:flex-row sm:items-center sm:justify-between";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) return;
        // Once signed it is submitted; closing the confirmation finishes.
        if (step === "done") onComplete();
        else onBack();
      }}
    >
      <FlowDialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        {step === "done" ? (
          <DialogHeader className="shrink-0 px-6 py-5 pr-14 text-left">
            <div className="flex items-center gap-4">
              <span
                aria-hidden
                className="flex size-14 shrink-0 items-center justify-center rounded-full bg-success-muted text-success-muted-foreground"
              >
                <CheckCircle2Icon className="size-7" />
              </span>
              <div className="flex min-w-0 flex-col gap-1.5">
                <DialogTitle
                  ref={titleRef}
                  tabIndex={-1}
                  className="text-body font-semibold text-balance outline-none"
                >
                  {several ? `${count} documents submitted` : "Document submitted"}
                </DialogTitle>
                <DialogDescription>
                  {SIGNED_WITH[signedWith]}{" "}
                  {several
                    ? "They are on the case record now. Everyone on the case can see them."
                    : "It is on the case record now. Everyone on the case can see it."}
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
                  id="document-esign-otp"
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
              Submit signature
            </Button>
          </footer>
        ) : null}

        {step === "done" ? (
          <footer className={cn(FOOTER, "sm:justify-end")}>
            <Button type="button" onClick={onComplete}>
              Done
            </Button>
          </footer>
        ) : null}
      </FlowDialogContent>
    </Dialog>
  );
}
