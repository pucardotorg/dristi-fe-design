"use client";

/**
 * The rejected registration's correction round (PM, Sept 3).
 *
 * A rejected registrant is told by SMS to sign in again; the sign-in screen
 * recognises the number and lands them here — the registration steps minus
 * the role question (that answer stands), everything pre-filled with what
 * they submitted, and the officer's ONE general message pinned on every
 * step. The message is the whole feedback: fields carry no marks of their
 * own (owner, Sept 18), only the stepper tints the steps to correct.
 * Resubmitting sends the same application (same ID) back for approval,
 * ending on the same awaiting-approval screen the first submission used.
 *
 * The mobile number is not editable: it was proven by OTP the first time
 * and it is the number they just signed in with — a registration cannot
 * move to a number nobody has verified.
 */

import * as React from "react";
import { ArrowLeftIcon, ClockIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionRow,
  DescriptionTerm,
} from "@/components/ui/description-list";
import { DocumentRowValue } from "@/components/document-preview";
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
import { Stepper, StepperItem } from "@/components/ui/stepper";
import { UploadedDocField } from "@/components/cases/uploaded-doc-field";
import { pick, type Locale } from "@/lib/onboarding/content";
import {
  applicationView,
  approvalStep,
  contactStep,
  journeySteps,
  nameStep,
  registrationUi,
  rejectionUi,
  verificationSteps,
  verificationUi,
} from "@/lib/registration/content";
import type { RejectedRegistration } from "@/lib/registration/rejection";
import { cn } from "@/lib/utils";
import { Identifier } from "@/components/chrome/identifier";

type Step = "name" | "contact" | "verification" | "success" | "application";
type StepKey = (typeof STEP_KEYS)[number];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const STEP_KEYS = ["name", "contact", "verification"] as const;

/** Which step each flaggable field lives on — it decides which stepper
    circles take the warning tint. */
const FIELD_STEP: Record<string, StepKey> = {
  name: "name",
  email: "contact",
  regNumber: "verification",
  idFile: "verification",
};

/** Past roughly three lines at this column's width the message starts to
    bury the form it explains — longer than this clamps behind Read more.
    A character threshold rather than a layout measurement: it needs no
    effect, and being a line off in either direction costs nothing. */
const CLAMP_THRESHOLD = 260;

/**
 * The officer's ONE message, in a quiet well on every step. A
 * short message shows whole; a long one clamps to three lines with the rest
 * behind Read more, so the correction work stays above the fold.
 */
function OfficerMessage({
  locale,
  applicationId,
  message,
}: {
  locale: Locale;
  applicationId: string;
  message: string;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const clamps = message.length > CLAMP_THRESHOLD;
  return (
    <div className="flex flex-col items-start gap-1.5 rounded-lg bg-surface-sunken p-4">
      <p className="text-caption font-semibold text-warning-ink">
        {pick(rejectionUi.messageMeta, locale).replace("{id}", applicationId)}
      </p>
      <p
        className={cn(
          "text-body-compact text-pretty text-foreground",
          clamps && !expanded && "line-clamp-3"
        )}
      >
        &ldquo;{message}&rdquo;
      </p>
      {clamps ? (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0"
          onClick={() => setExpanded((value) => !value)}
        >
          {pick(expanded ? rejectionUi.showLess : rejectionUi.readMore, locale)}
        </Button>
      ) : null}
    </div>
  );
}

export function ResubmissionFlow({
  locale,
  rejection,
}: {
  locale: Locale;
  rejection: RejectedRegistration;
}) {
  const [step, setStep] = React.useState<Step>("name");
  const [fullName, setFullName] = React.useState(rejection.fullName);
  const [email, setEmail] = React.useState(rejection.email);
  const [regNumber, setRegNumber] = React.useState(rejection.regNumber);
  const [idFile, setIdFile] = React.useState<File | null>(null);
  const [touched, setTouched] = React.useState(false);

  /** The steps the officer's marks land on — they wear the stepper tint. */
  const flaggedSteps = new Set(
    rejection.flagged.map((field) => FIELD_STEP[field])
  );
  const verification = verificationSteps.advocate;
  const stepIndex = Math.max(0, STEP_KEYS.indexOf(step as StepKey));

  /** The officer's ONE message, on every step — it is the universal
      feedback (owner, Sept 18), still a quiet well rather than a destructive
      banner (owner, Sept 3: too alarming). */
  const officerMessage = (
    <OfficerMessage
      locale={locale}
      applicationId={rejection.applicationId}
      message={rejection.officerMessage}
    />
  );

  if (step === "success") {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center gap-6 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-warning-muted text-warning-muted-foreground">
          <ClockIcon className="size-7" aria-hidden />
        </span>
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-title text-balance font-semibold">
            {pick(rejectionUi.resubmittedTitle, locale)}
          </h1>
          <p className="text-body text-pretty text-muted-foreground">
            {pick(rejectionUi.resubmittedBody, locale).replace(
              "{id}",
              rejection.applicationId
            )}
          </p>
        </div>
        <Button size="lg" onClick={() => setStep("application")}>
          {pick(approvalStep.action, locale)}
        </Button>
      </div>
    );
  }

  if (step === "application") {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <h1 className="text-title text-balance text-center font-semibold">
          {pick(applicationView.title, locale).replace(
            "{id}",
            rejection.applicationId
          )}
        </h1>
        <DescriptionList className="rounded-lg bg-muted px-4">
          <DescriptionRow>
            <DescriptionTerm>{pick(applicationView.name, locale)}</DescriptionTerm>
            <DescriptionDetails>{fullName}</DescriptionDetails>
          </DescriptionRow>
          <DescriptionRow>
            <DescriptionTerm>{pick(applicationView.mobile, locale)}</DescriptionTerm>
            <DescriptionDetails>+91 {rejection.mobile}</DescriptionDetails>
          </DescriptionRow>
          {email ? (
            <DescriptionRow>
              <DescriptionTerm>{pick(applicationView.email, locale)}</DescriptionTerm>
              <DescriptionDetails>{email}</DescriptionDetails>
            </DescriptionRow>
          ) : null}
          <DescriptionRow>
            <DescriptionTerm>{pick(verification.numberLabel, locale)}</DescriptionTerm>
            <DescriptionDetails>
              <Identifier value={regNumber} label="registration number" />
            </DescriptionDetails>
          </DescriptionRow>
          {idFile ? (
            <DescriptionRow className="items-center">
              <DescriptionTerm>{pick(verification.uploadLabel, locale)}</DescriptionTerm>
              <DescriptionDetails>
                <DocumentRowValue file={idFile} locale={locale} />
              </DescriptionDetails>
            </DescriptionRow>
          ) : null}
        </DescriptionList>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 md:gap-10">
      <div className="mx-auto w-full max-w-2xl">
        <Stepper
          className={cn(
            "w-full",
            "[&_[data-slot=stepper-item]]:items-center",
            "[&_[data-slot=stepper-item]>div:first-child]:relative [&_[data-slot=stepper-item]>div:first-child]:justify-center",
            "[&_[data-slot=stepper-connector]]:absolute [&_[data-slot=stepper-connector]]:top-4 [&_[data-slot=stepper-connector]]:left-[calc(50%+1rem)] [&_[data-slot=stepper-connector]]:mx-0 [&_[data-slot=stepper-connector]]:h-px [&_[data-slot=stepper-connector]]:w-[calc(100%-2rem)]",
            /* Three short labels fit a phone, so they stay at every width —
               the full registration hides its six below md, this does not. */
            "[&_[data-slot=stepper-item]>div:last-child]:w-full [&_[data-slot=stepper-item]>div:last-child]:pr-0 [&_[data-slot=stepper-item]>div:last-child]:text-center"
          )}
          aria-label={pick(registrationUi.stepOf, locale)
            .replace("{current}", String(stepIndex + 1))
            .replace("{total}", String(STEP_KEYS.length))}
        >
          {STEP_KEYS.map((key, index) => (
            <StepperItem
              key={key}
              step={index + 1}
              /* A flagged step AHEAD of you wears the current step's own
                 fill recipe in warning tones — light yellow fill, warning
                 border and number — because the eye scans the circles, not
                 the labels (owner, Sept 3; the ring tried first looked
                 bolted on). The step you are ON stays the teal current
                 look, and a step you pass completes to the normal tick;
                 unflagged upcoming steps stay grey. The sr-only text
                 stays, so the mark is never colour alone for a screen reader.
                 The cast: StepperItem declares `title?: ReactNode`, but the
                 li's own `title: string` attribute intersects it down to
                 string — a DS-level type conflict, not a rendering one
                 (candidate for ds-requests). */
              className={
                flaggedSteps.has(key) && index > stepIndex
                  ? "[&_[data-slot=stepper-indicator]]:border-warning-ink [&_[data-slot=stepper-indicator]]:bg-warning-muted [&_[data-slot=stepper-indicator]]:text-warning-muted-foreground"
                  : undefined
              }
              title={
                (flaggedSteps.has(key) ? (
                  <span>
                    {pick(journeySteps[key].title, locale)}{" "}
                    <span className="sr-only">
                      {pick(rejectionUi.stepFlagged, locale)}
                    </span>
                  </span>
                ) : (
                  pick(journeySteps[key].title, locale)
                )) as unknown as string
              }
              status={
                index < stepIndex
                  ? "complete"
                  : index === stepIndex
                    ? "current"
                    : "upcoming"
              }
            />
          ))}
        </Stepper>
      </div>

      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        {step === "name" ? (
          <form
            className="flex flex-col gap-6"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              setTouched(true);
              if (!fullName.trim()) return;
              setTouched(false);
              setStep("contact");
            }}
          >
            {/* The rejection is the page's own structure — headline and one
                quiet line — never an alarm banner. */}
            <div className="flex flex-col items-center gap-2 text-center">
              <h1 className="text-title text-balance font-semibold">
                {pick(rejectionUi.notApprovedTitle, locale)}
              </h1>
              <p className="text-body text-pretty text-muted-foreground">
                {pick(rejectionUi.notApprovedBody, locale)}
              </p>
            </div>
            {officerMessage}
            <Field data-invalid={touched && !fullName.trim()}>
              <FieldLabel>
                {pick(nameStep.fullName, locale)}{" "}
                <span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                value={fullName}
                autoComplete="name"
                placeholder={pick(nameStep.fullNamePlaceholder, locale)}
                onChange={(event) => {
                  setFullName(event.target.value);
                  setTouched(false);
                }}
              />
              <FieldDescription>
                {pick(nameStep.fullNameHint, locale)}
              </FieldDescription>
              <FieldError>
                {touched && !fullName.trim()
                  ? pick(nameStep.error, locale)
                  : null}
              </FieldError>
            </Field>
            <div className="flex justify-end">
              <Button type="submit" className="sm:min-w-40">
                {pick(registrationUi.continue, locale)}
              </Button>
            </div>
          </form>
        ) : null}

        {step === "contact" ? (
          <form
            className="flex flex-col gap-6"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              setTouched(true);
              if (email && !EMAIL.test(email)) return;
              setTouched(false);
              setStep("verification");
            }}
          >
            <div className="flex flex-col items-center gap-2 text-center">
              <h1 className="text-title text-balance font-semibold">
                {pick(contactStep.title, locale)}
              </h1>
              <p className="text-body text-pretty text-muted-foreground">
                {pick(contactStep.body, locale)}
              </p>
            </div>
            {officerMessage}
            <Field>
              <FieldLabel>{pick(contactStep.mobile, locale)}</FieldLabel>
              <InputGroup className="has-disabled:opacity-100 has-disabled:bg-surface-sunken dark:has-disabled:bg-surface-sunken">
                <InputGroupAddon variant="field">
                  <InputGroupText>+91</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  value={rejection.mobile}
                  disabled
                  readOnly
                  className="disabled:text-foreground disabled:opacity-100 disabled:[-webkit-text-fill-color:currentcolor]"
                />
              </InputGroup>
              <FieldDescription>
                {pick(rejectionUi.mobileVerified, locale)}
              </FieldDescription>
            </Field>
            <Field data-invalid={touched && Boolean(email) && !EMAIL.test(email)}>
              <FieldLabel>{pick(contactStep.email, locale)}</FieldLabel>
              <Input
                type="email"
                value={email}
                placeholder={pick(contactStep.emailPlaceholder, locale)}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setTouched(false);
                }}
              />
              <FieldError>
                {touched && email && !EMAIL.test(email)
                  ? pick(contactStep.emailError, locale)
                  : null}
              </FieldError>
            </Field>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setTouched(false);
                  setStep("name");
                }}
              >
                <ArrowLeftIcon data-icon="inline-start" aria-hidden />
                {pick(registrationUi.back, locale)}
              </Button>
              <Button type="submit" className="sm:min-w-40">
                {pick(registrationUi.continue, locale)}
              </Button>
            </div>
          </form>
        ) : null}

        {step === "verification" ? (
          <form
            className="flex flex-col gap-6"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              setTouched(true);
              if (!regNumber.trim() || !idFile) return;
              setTouched(false);
              setStep("success");
            }}
          >
            <div className="flex flex-col items-center gap-2 text-center">
              <h1 className="text-title text-balance font-semibold">
                {pick(verification.title, locale)}
              </h1>
              <p className="text-body text-pretty text-muted-foreground">
                {pick(verification.body, locale)}
              </p>
            </div>
            {officerMessage}
            <Field data-invalid={touched && !regNumber.trim()}>
              <FieldLabel>
                {pick(verification.numberLabel, locale)}{" "}
                <span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                value={regNumber}
                onChange={(event) => {
                  setRegNumber(event.target.value);
                  setTouched(false);
                }}
              />
              <FieldError>
                {touched && !regNumber.trim()
                  ? pick(verification.numberError, locale)
                  : null}
              </FieldError>
            </Field>
            <Field data-invalid={touched && !idFile}>
              <FieldLabel>
                {pick(verification.uploadLabel, locale)}{" "}
                <span className="text-destructive">*</span>
              </FieldLabel>
              <UploadedDocField
                label={pick(verification.uploadLabel, locale)}
                required
                file={idFile}
                onFileChange={(file) => {
                  setIdFile(file);
                  setTouched(false);
                }}
                copy={{
                  changeFile: pick(verificationUi.changeFile, locale),
                  remove: pick(verificationUi.removeFile, locale),
                  noFile: pick(verificationUi.noFile, locale),
                  chooseFile: pick(verificationUi.chooseFile, locale),
                }}
              />
              <FieldDescription>
                {pick(verification.uploadHint, locale)}{" "}
                {pick(verificationUi.fileHelp, locale)}
              </FieldDescription>
              <FieldError>
                {touched && !idFile ? pick(verification.uploadError, locale) : null}
              </FieldError>
            </Field>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setTouched(false);
                  setStep("contact");
                }}
              >
                <ArrowLeftIcon data-icon="inline-start" aria-hidden />
                {pick(registrationUi.back, locale)}
              </Button>
              <Button type="submit" className="sm:min-w-40">
                {pick(rejectionUi.resubmit, locale)}
              </Button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}
