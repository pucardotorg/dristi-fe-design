"use client";

import * as React from "react";
import { FileTextIcon, Trash2Icon, UploadIcon } from "lucide-react";

import {
  ChoicePillGroup,
  formatFileSize,
  validateSelectedFiles,
} from "@/components/cases/filing-form-shared";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError } from "@/components/ui/field";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import {
  signFormProcessLabel,
  type SignForm,
} from "@/lib/employee/sign-forms";

const ACCEPTED_FILE_TYPES =
  ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

/** Aadhaar e-Sign sends six digits. The same length the rest of the app asks for. */
const OTP_LENGTH = 6;

/**
 * The two ways the reference offers to put a signature on a court paper. They share one
 * group because they answer one question — how this gets signed — and splitting them
 * would ask it twice.
 *
 * A function rather than a constant because the upload label has to name the paper: a
 * bench signing a bail bond is not offered "Upload the form with your signature". `noun`
 * defaults to "form" throughout this module, so the forms queue reads exactly as before.
 */
function signatureMethods(noun: string) {
  return [
    { id: "e-sign" as const, label: "E-sign" },
    { id: "upload" as const, label: `Upload the ${noun} with your signature` },
  ];
}

type SignatureMethod = "e-sign" | "upload";

/**
 * The Add signature step, shared by both ways into it.
 *
 * The question is identical wherever one paper is being signed — e-sign or upload a
 * signed copy — so the fields live here rather than once per queue. The single-document
 * path reaches this after the bench has read the paper, as its own overlay. Only the
 * sentence above the choice differs, and that is the `subject` prop.
 */
export type SignatureChoice = ReturnType<typeof useSignatureChoice>;

export function useSignatureChoice(noun = "form") {
  const [method, setMethod] = React.useState<SignatureMethod | "">("");
  const [file, setFile] = React.useState<File | null>(null);
  const [fileError, setFileError] = React.useState<string | undefined>(
    undefined,
  );
  const [otp, setOtp] = React.useState("");

  function choose(next: SignatureMethod) {
    setMethod(next);
    /* Switching away from upload drops what was attached to it — a file left behind by
       a method the bench has abandoned would silently arm Submit. */
    if (next !== "upload") {
      setFile(null);
      setFileError(undefined);
    }
    /* And switching away from e-sign drops the code typed under it, for the same
       reason. */
    if (next !== "e-sign") setOtp("");
  }

  function chooseFile(files: File[]) {
    if (files.length === 0) return;
    if (files.length > 1) {
      setFileError(`Choose one signed ${noun}.`);
      return;
    }
    const validationError = validateSelectedFiles(files);
    if (validationError) {
      setFileError(validationError);
      return;
    }
    setFile(files[0]);
    setFileError(undefined);
  }

  const reset = React.useCallback(() => {
    setMethod("");
    setFile(null);
    setFileError(undefined);
    setOtp("");
  }, []);

  /* An upload with no file is not a signature, and neither is an e-sign with no code —
     picking the method is choosing a route, not completing it. An enabled Submit that
     then does nothing is worse than a disabled one whose reason is on screen above it. */
  const canSubmit =
    (method === "e-sign" && otp.length === OTP_LENGTH) ||
    (method === "upload" && file !== null);

  /* Something a close would throw away: digits of the code, or the signed copy. Choosing
     the method alone is the route, not yet an entry. */
  const entered = otp.length > 0 || file !== null;

  return {
    method,
    choose,
    file,
    clearFile: () => setFile(null),
    fileError,
    chooseFile,
    otp,
    setOtp,
    canSubmit,
    entered,
    reset,
  };
}

/**
 * What the bench is about to sign, in one sentence.
 *
 * Named rather than counted wherever naming is possible: one form says which case it
 * belongs to, and a run of forms that happen to share a process type says so, because
 * "8 Examination of accused forms" is a fact the bench can check against the table
 * behind the dialog in a way that "8 forms" is not.
 */
export function signatureSubject(forms: SignForm[]): string {
  if (forms.length === 0) return "No forms are selected.";
  if (forms.length === 1) {
    const [form] = forms;
    return `You are adding your signature to the ${signFormProcessLabel(
      form.process,
    )} form in ${form.caseNumber}.`;
  }
  const processes = new Set(forms.map((form) => form.process));
  if (processes.size === 1) {
    return `You are adding your signature to ${forms.length} ${signFormProcessLabel(
      forms[0].process,
    )} forms.`;
  }
  return `You are adding your signature to ${forms.length} forms.`;
}

/**
 * The note, the choice, and the drop target the choice asks for.
 *
 * The note is `info` rather than a plain paragraph for the reason the craft rules ration
 * tint: it reports what the next control will act on, which is the machine-read fact the
 * DS `Banner` exists for. By this step the documents are off screen and the bench is one
 * click from committing.
 */
export function SignatureFields({
  choice,
  subject,
  download,
  noun = "form",
}: {
  choice: SignatureChoice;
  subject: string;
  /**
   * Offered only where there is one document to offer. The prompt comes from the caller
   * because the question is not the same on both paths: the single-form path has just
   * shown the document, and the bulk path never has.
   */
  download?: { prompt: string; onDownload: () => void };
  /**
   * What the paper is called, in the copy that has to name it — the upload option, the
   * drop target and its file input. Defaults to "form" for the queue this started on.
   */
  noun?: string;
}) {
  const otpId = React.useId();
  const [resent, setResent] = React.useState(false);

  return (
    <div className="flex flex-col gap-6">
      <Banner variant="info">{subject}</Banner>

      <ChoicePillGroup
        legend="Your signature"
        options={signatureMethods(noun)}
        value={choice.method}
        orientation="column"
        onChange={choice.choose}
      />

      {/* Each route reveals what it actually needs, directly under the choice. E-sign
          asks for the code; upload asks for the file. Picking a method and being shown
          nothing is what made this step look finished when it was not — the same gap the
          owner flagged on the filing and vakalatnama signing screens, which is why those
          both take a 6-digit code (`tasks/act/shared.tsx`, `vakalatnama/steps/review-sign.tsx`).

          It is inline rather than a further dialog: those two open the OTP over a page,
          while this step is already an overlay, and a dialog over a dialog would put two
          focus traps in a row for one question. */}
      {choice.method === "e-sign" ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={otpId} className="text-body-compact">
              Enter OTP
            </Label>
            <InputOTP
              id={otpId}
              maxLength={OTP_LENGTH}
              value={choice.otp}
              onChange={choice.setOtp}
              containerClassName="gap-2"
            >
              <InputOTPGroup className="gap-2">
                {Array.from({ length: OTP_LENGTH }, (_, index) => (
                  <InputOTPSlot
                    key={index}
                    index={index}
                    className="size-10 rounded-lg border border-input"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
            {/* What the live service would do, and what this one does — said here rather
                than left for the bench to infer from a code that accepts anything. */}
            <p className="text-caption text-muted-foreground">
              In the live service a {OTP_LENGTH}-digit code goes to your
              Aadhaar-linked mobile and the signature applied is yours. Sandbox
              — any {OTP_LENGTH}-digit code is accepted here.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-body-compact text-muted-foreground">
              Didn&rsquo;t get it?
            </span>
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 underline"
              onClick={() => setResent(true)}
            >
              {resent ? "Sent again" : "Resend OTP"}
            </Button>
          </div>
        </div>
      ) : null}

      {choice.method === "upload" ? (
        <SignedCopyUpload choice={choice} noun={noun} />
      ) : null}

      {/* The document is off screen on this step, so the reference offers it here. A
          link rather than a button: reading is not a third act competing with Back and
          Submit. A bulk run of more than one form has no single document to offer, so
          it passes nothing and this does not render. */}
      {download ? (
        <p className="text-body text-muted-foreground">
          {download.prompt}{" "}
          <Button type="button" variant="link" onClick={download.onDownload}>
            Download it
          </Button>
        </p>
      ) : null}
    </div>
  );
}

/**
 * The signed copy coming back: a drop target, the file once chosen, and what it must be.
 * The upload route of `SignatureFields`, and the paper route of the order signing window
 * (`sign-order-flow.tsx`), which reaches it from a link rather than a choice.
 */
export function SignedCopyUpload({
  choice,
  noun = "form",
}: {
  choice: SignatureChoice;
  noun?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  return (
    <Field data-invalid={Boolean(choice.fileError)}>
      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          choice.chooseFile(Array.from(event.dataTransfer.files));
        }}
        className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-input p-6 text-center group-data-[invalid=true]/field:border-destructive"
      >
        <UploadIcon className="size-8 text-muted-foreground" aria-hidden />
        <p className="text-body text-muted-foreground">
          Drag and drop the signed {noun}, or
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
        >
          Browse files
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          tabIndex={-1}
          className="sr-only"
          aria-label={`Choose the signed ${noun}`}
          onChange={(event) => {
            choice.chooseFile(Array.from(event.target.files ?? []));
            event.currentTarget.value = "";
          }}
        />
      </div>
      <FieldDescription className="text-body-compact">
        PDF, JPG, JPEG or PNG; maximum 10 MB.
      </FieldDescription>
      <FieldError className="text-body-compact">
        {choice.fileError}
      </FieldError>

      {choice.file ? (
        <AttachmentGroup className="flex-col overflow-visible py-0 *:data-[slot=attachment]:w-full">
          <Attachment className="w-full">
            <AttachmentMedia variant="icon">
              <FileTextIcon aria-hidden />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>{choice.file.name}</AttachmentTitle>
              <AttachmentDescription>
                {formatFileSize(choice.file.size)} · selected locally
              </AttachmentDescription>
            </AttachmentContent>
            <AttachmentActions>
              <AttachmentAction
                type="button"
                variant="destructive-ghost"
                size="icon"
                aria-label={`Remove ${choice.file.name}`}
                onClick={choice.clearFile}
              >
                <Trash2Icon aria-hidden />
              </AttachmentAction>
            </AttachmentActions>
          </Attachment>
        </AttachmentGroup>
      ) : null}
    </Field>
  );
}
