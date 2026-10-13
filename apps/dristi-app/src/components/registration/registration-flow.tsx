"use client";

import * as React from "react";
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  CheckIcon,
  CircleAlertIcon,
  ClockIcon,
  EyeIcon,
  EyeOffIcon,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DescriptionDetails, DescriptionList, DescriptionRow, DescriptionTerm } from "@/components/ui/description-list";
import { DocumentRowValue } from "@/components/document-preview";
import { UploadedDocField } from "@/components/cases/uploaded-doc-field";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CENTRED_STEPPER } from "@/components/chrome/stepper-layout";
import { Stepper, StepperItem } from "@/components/ui/stepper";
import { pick, type Locale } from "@/lib/onboarding/content";
import {
  applicationView,
  approvalStep,
  contactStep,
  journeySteps,
  nameStep,
  passwordStep,
  registrationUi,
  roleStep,
  successStep,
  termsStep,
  verificationSteps,
  verificationUi,
} from "@/lib/registration/content";
import { passwordProblem } from "@/lib/registration/password-policy";
import { cn } from "@/lib/utils";

import { MaskedOtp, OTP_LENGTH } from "./masked-otp";
import { Identifier } from "@/components/chrome/identifier";

type Step = "role" | "name" | "contact" | "password" | "verification" | "terms" | "success" | "application";
type AccountRole = "litigant" | "advocate" | "advocateClerk" | "poa" | "";
const DIGITS = /\D/g;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_SECONDS = 30;

/** Which roles the court must approve before the account works. */
const NEEDS_VERIFICATION = new Set<AccountRole>(["advocate", "advocateClerk"]);

function applicationId(role: AccountRole) {
  const serial = String(Math.floor(Math.random() * 900000) + 100000);
  return `KL-${role === "advocateClerk" ? "CLERK" : "ADV"}-${serial}-${new Date().getFullYear()}`;
}

function Heading({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <h1 className="text-title text-balance font-semibold">{title}</h1>
      <p className="text-body text-pretty text-muted-foreground">{body}</p>
    </div>
  );
}

function Actions({ locale, onBack, submitLabel, skip }: {
  locale: Locale;
  onBack: () => void;
  submitLabel?: string;
  /** An optional step's way past it — sits beside the primary, quieter than it. */
  skip?: { label: string; onSkip: () => void };
}) {
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Button type="button" variant="outline" onClick={onBack}>
        <ArrowLeftIcon data-icon="inline-start" aria-hidden />
        {pick(registrationUi.back, locale)}
      </Button>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        {skip ? <Button type="button" variant="ghost" onClick={skip.onSkip}>{skip.label}</Button> : null}
        <Button type="submit" className="sm:min-w-40">{submitLabel ?? pick(registrationUi.continue, locale)}</Button>
      </div>
    </div>
  );
}

export function RegistrationFlow({ locale, summoned, toSign = false, initialMobile = "", onFinish }: {
  /** Arrived from a signing link: the success step sends them to sign, and says so. */
  toSign?: boolean;
  locale: Locale;
  summoned: boolean;
  initialMobile?: string;
  onFinish?: (result: { idSkipped: boolean; profileIncomplete: boolean }) => void;
}) {
  const [step, setStep] = React.useState<Step>("role");
  const [role, setRole] = React.useState<AccountRole>("");
  const [fullName, setFullName] = React.useState("");
  const [mobile, setMobile] = React.useState(initialMobile);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [passwordRevealed, setPasswordRevealed] = React.useState(false);
  const [termsAccepted, setTermsAccepted] = React.useState(false);
  const [touched, setTouched] = React.useState(false);
  const [destinationNotice, setDestinationNotice] = React.useState(false);

  // Contact-step OTP. Anyone can type anyone's number, so the number is proven here —
  // code requested, verified on the same screen — before Continue means anything.
  const [otpRequested, setOtpRequested] = React.useState(false);
  const [otpCode, setOtpCode] = React.useState("");
  const [otpVerified, setOtpVerified] = React.useState(false);
  const [otpTouched, setOtpTouched] = React.useState(false);
  // The code is masked at rest. It arrives on the lock screen of the phone in the
  // person's hand, in a room they do not control — the same reason a password is dotted.
  const [otpRevealed, setOtpRevealed] = React.useState(false);
  const [resendIn, setResendIn] = React.useState(0);

  // Advocate / clerk verification.
  const [regNumber, setRegNumber] = React.useState("");
  const [idFile, setIdFile] = React.useState<File | null>(null);
  const [appId, setAppId] = React.useState("");

  React.useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  const needsVerification = NEEDS_VERIFICATION.has(role);
  const verification = role === "advocateClerk" ? verificationSteps.advocateClerk : verificationSteps.advocate;
  // The first policy rule the password fails, against what this person has told us so
  // far — name from step two, number and email from step three.
  const problem = passwordProblem(password, { mobile, name: fullName, email });

  const journeyKeys: readonly (keyof typeof journeySteps)[] = needsVerification
    ? ["role", "name", "contact", "password", "verification", "terms"]
    : ["role", "name", "contact", "password", "terms"];
  const journeyIndex = Math.max(0, journeyKeys.indexOf(step as keyof typeof journeySteps));

  function resetOtp() {
    setOtpRequested(false);
    setOtpCode("");
    setOtpVerified(false);
    setOtpTouched(false);
    setOtpRevealed(false);
    setResendIn(0);
  }

  if (step === "success") {
    if (needsVerification) {
      return (
        <div className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center gap-6 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-warning-muted text-warning-muted-foreground">
            <ClockIcon className="size-7" aria-hidden />
          </span>
          <Heading title={pick(approvalStep.title, locale)} body={pick(approvalStep.body, locale).replace("{id}", appId)} />
          <Button size="lg" onClick={() => setStep("application")}>{pick(approvalStep.action, locale)}</Button>
        </div>
      );
    }
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center gap-6 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-success-muted text-success-muted-foreground">
          <CheckCircle2Icon className="size-7" aria-hidden />
        </span>
        <Heading title={pick(successStep.title, locale)} body={pick(toSign ? successStep.signBody : successStep.body, locale)} />
        <Button size="lg" onClick={() => onFinish ? onFinish({ idSkipped: true, profileIncomplete: true }) : setDestinationNotice(true)}>
          {pick(toSign ? successStep.signAction : summoned ? successStep.summonedAction : successStep.generalAction, locale)}
        </Button>
        {destinationNotice ? <Alert variant="info" className="text-left"><AlertTitle>Prototype: destination not connected</AlertTitle><AlertDescription>This action will open your portal home.</AlertDescription></Alert> : null}
      </div>
    );
  }

  if (step === "application") {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <h1 className="text-title text-balance text-center font-semibold">{pick(applicationView.title, locale).replace("{id}", appId)}</h1>
        <DescriptionList className="rounded-lg bg-muted px-4">
          <DescriptionRow><DescriptionTerm>{pick(applicationView.name, locale)}</DescriptionTerm><DescriptionDetails>{fullName}</DescriptionDetails></DescriptionRow>
          <DescriptionRow><DescriptionTerm>{pick(applicationView.mobile, locale)}</DescriptionTerm><DescriptionDetails>+91 {mobile}</DescriptionDetails></DescriptionRow>
          {email ? <DescriptionRow><DescriptionTerm>{pick(applicationView.email, locale)}</DescriptionTerm><DescriptionDetails>{email}</DescriptionDetails></DescriptionRow> : null}
          <DescriptionRow><DescriptionTerm>{pick(applicationView.role, locale)}</DescriptionTerm><DescriptionDetails>{pick(role === "advocateClerk" ? roleStep.advocateClerk : roleStep.advocate, locale)}</DescriptionDetails></DescriptionRow>
          <DescriptionRow><DescriptionTerm>{pick(verification.numberLabel, locale)}</DescriptionTerm><DescriptionDetails><Identifier value={regNumber} label="registration number" /></DescriptionDetails></DescriptionRow>
          {idFile ? <DescriptionRow className="items-center"><DescriptionTerm>{pick(verification.uploadLabel, locale)}</DescriptionTerm><DescriptionDetails><DocumentRowValue file={idFile} locale={locale} /></DescriptionDetails></DescriptionRow> : null}
        </DescriptionList>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 md:gap-10">
      <div className="mx-auto w-full max-w-2xl">
        <Stepper
          className={CENTRED_STEPPER}
          aria-label={pick(registrationUi.stepOf, locale).replace("{current}", String(journeyIndex + 1)).replace("{total}", String(journeyKeys.length))}
        >
          {journeyKeys.map((key, index) => <StepperItem key={key} step={index + 1} title={pick(journeySteps[key].title, locale)} status={index < journeyIndex ? "complete" : index === journeyIndex ? "current" : "upcoming"} />)}
        </Stepper>
        {/* Six names do not fit under six circles on a phone (Malayalam collides
            even at caption size), so below md one line names the step you are on. */}
        <p className="mt-3 text-center text-caption text-muted-foreground md:hidden">
          {pick(registrationUi.stepOf, locale).replace("{current}", String(journeyIndex + 1)).replace("{total}", String(journeyKeys.length))}
          {" · "}
          <span className="font-medium text-foreground">{pick(journeySteps[journeyKeys[journeyIndex]].title, locale)}</span>
        </p>
      </div>

      <div className="mx-auto w-full max-w-xl">
        {step === "role" ? (
          <form className="flex flex-col gap-6" onSubmit={(event) => { event.preventDefault(); setTouched(true); if (!role) return; setTouched(false); setStep("name"); }}>
            <Heading title={pick(roleStep.title, locale)} body={pick(roleStep.body, locale)} />
            <Field data-invalid={touched && !role}>
              <RadioGroup value={role} onValueChange={(value) => { setRole(value as AccountRole); setTouched(false); }} className="flex flex-col gap-3">
                {(["litigant", "poa", "advocate", "advocateClerk"] as const).map((value) => (
                  <Label key={value} htmlFor={`registration-role-${value}`} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-brand-muted">
                    <RadioGroupItem id={`registration-role-${value}`} value={value} className="mt-0.5" />
                    <span className="flex flex-col gap-1"><span className="font-medium">{pick(roleStep[value], locale)}</span><span className="text-caption font-normal text-muted-foreground">{pick(roleStep[`${value}Hint`], locale)}</span></span>
                  </Label>
                ))}
              </RadioGroup>
              <FieldError>{touched && !role ? pick(roleStep.required, locale) : null}</FieldError>
            </Field>
            <Button type="submit">{pick(registrationUi.continue, locale)}</Button>
          </form>
        ) : null}

        {step === "name" ? (
          <form className="flex flex-col gap-6" noValidate onSubmit={(event) => { event.preventDefault(); setTouched(true); if (!fullName.trim()) return; setTouched(false); setStep("contact"); }}>
            <Heading title={pick(nameStep.title, locale)} body={pick(nameStep.body, locale)} />
            {/* One line, `autoComplete="name"`. The three-box version asked every person
                whose name does not split that way to decide which box their name is. */}
            <Field data-invalid={touched && !fullName.trim()}>
              <FieldLabel>{pick(nameStep.fullName, locale)} <span className="text-destructive">*</span></FieldLabel>
              <Input value={fullName} autoComplete="name" placeholder={pick(nameStep.fullNamePlaceholder, locale)} onChange={(event) => { setFullName(event.target.value); setTouched(false); }} />
              <FieldDescription>{pick(nameStep.fullNameHint, locale)}</FieldDescription>
              <FieldError>{touched && !fullName.trim() ? pick(nameStep.error, locale) : null}</FieldError>
            </Field>
            <Actions locale={locale} onBack={() => { setTouched(false); setStep("role"); }} />
          </form>
        ) : null}

        {step === "contact" ? (
          <form className="flex flex-col gap-6" noValidate onSubmit={(event) => { event.preventDefault(); setTouched(true); if (mobile.length !== 10 || !otpVerified || (email && !EMAIL.test(email))) return; setTouched(false); setStep("password"); }}>
            <Heading title={pick(contactStep.title, locale)} body={pick(contactStep.body, locale)} />
            <Field data-invalid={touched && (mobile.length !== 10 || !otpVerified)}>
              <FieldLabel>{pick(contactStep.mobile, locale)} <span className="text-destructive">*</span></FieldLabel>
              <div className="flex gap-2">
                {/* The DS disabled look, minus the 50% dim on the value itself: the number
                    is the one thing being verified against the code, so it stays at full
                    contrast while the frame and addon still read as locked. */}
                <InputGroup className={cn("flex-1", otpRequested && "has-disabled:opacity-100 has-disabled:bg-surface-sunken dark:has-disabled:bg-surface-sunken")}><InputGroupAddon variant="field"><InputGroupText>+91</InputGroupText></InputGroupAddon><InputGroupInput type="tel" inputMode="numeric" maxLength={10} value={mobile} disabled={otpRequested} className={otpRequested ? "disabled:text-foreground disabled:opacity-100 disabled:[-webkit-text-fill-color:currentcolor]" : undefined} placeholder={pick(contactStep.mobilePlaceholder, locale)} onChange={(event) => { setMobile(event.target.value.replace(DIGITS, "").slice(0, 10)); setTouched(false); }} /></InputGroup>
                {!otpRequested ? (
                  <Button type="button" variant="outline" className="shrink-0" disabled={mobile.length !== 10} onClick={() => { setOtpRequested(true); setResendIn(RESEND_SECONDS); setTouched(false); }}>
                    {pick(contactStep.sendOtp, locale)}
                  </Button>
                ) : (
                  <Button type="button" variant="ghost" className="shrink-0" onClick={resetOtp}>{pick(contactStep.changeNumber, locale)}</Button>
                )}
              </div>
              {otpVerified ? (
                <p className="flex items-center gap-1.5 text-body-compact text-success-ink"><CheckCircle2Icon className="size-4" aria-hidden />{pick(contactStep.verified, locale)}</p>
              ) : (
                <FieldDescription>{pick(contactStep.mobileHint, locale)}</FieldDescription>
              )}
              <FieldError>{touched && mobile.length !== 10 ? pick(contactStep.mobileError, locale) : touched && !otpVerified ? pick(contactStep.verifyFirst, locale) : null}</FieldError>
            </Field>

            {otpRequested && !otpVerified ? (
              <Field data-invalid={otpTouched && otpCode.length !== OTP_LENGTH} className="rounded-lg bg-surface-sunken p-4">
                {/* Label repeated the description's "6-digit code"; kept for screen
                    readers, dropped from view (owner, Sept 11). */}
                <FieldLabel className="sr-only">{pick(contactStep.otpLabel, locale)}</FieldLabel>
                <FieldDescription>{pick(contactStep.otpSent, locale).replace("{number}", mobile)}</FieldDescription>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <MaskedOtp value={otpCode} revealed={otpRevealed} onChange={(value) => { setOtpCode(value); setOtpTouched(false); }} />
                  <Button type="button" className="sm:h-12" onClick={() => { setOtpTouched(true); if (otpCode.length !== OTP_LENGTH) return; setOtpVerified(true); setOtpTouched(false); setTouched(false); }}>
                    {pick(contactStep.otpVerify, locale)}
                  </Button>
                </div>
                <FieldError>{otpTouched && otpCode.length !== OTP_LENGTH ? pick(contactStep.otpError, locale) : null}</FieldError>
                {/* One row under the boxes: reveal on the left, under the code it reveals;
                    countdown / resend on the right, under the Verify it follows. The
                    countdown and the resend link share the right-hand slot at a fixed
                    height, so nothing hops when the timer runs out. */}
                <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto p-0"
                    aria-pressed={otpRevealed}
                    onClick={() => setOtpRevealed((value) => !value)}
                  >
                    {otpRevealed ? <EyeOffIcon data-icon="inline-start" aria-hidden /> : <EyeIcon data-icon="inline-start" aria-hidden />}
                    {pick(otpRevealed ? contactStep.otpHide : contactStep.otpShow, locale)}
                  </Button>
                  {resendIn > 0 ? (
                    <p className="text-body-compact whitespace-nowrap text-muted-foreground tabular-nums">{pick(contactStep.otpResendIn, locale).replace("{seconds}", String(resendIn))}</p>
                  ) : (
                    <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => { setResendIn(RESEND_SECONDS); setOtpCode(""); }}>{pick(contactStep.otpResend, locale)}</Button>
                  )}
                </div>
              </Field>
            ) : null}

            <Field data-invalid={touched && Boolean(email) && !EMAIL.test(email)}><FieldLabel>{pick(contactStep.email, locale)}</FieldLabel><Input type="email" value={email} placeholder={pick(contactStep.emailPlaceholder, locale)} onChange={(event) => { setEmail(event.target.value); setTouched(false); }} /><FieldError>{touched && email && !EMAIL.test(email) ? pick(contactStep.emailError, locale) : null}</FieldError></Field>
            <Actions locale={locale} onBack={() => { setTouched(false); setStep("name"); }} />
          </form>
        ) : null}

        {step === "password" ? (
          <form className="flex flex-col gap-6" noValidate onSubmit={(event) => { event.preventDefault(); setTouched(true); if (problem || password !== confirmPassword) return; setTouched(false); setStep(needsVerification ? "verification" : "terms"); }}>
            <Heading title={pick(passwordStep.title, locale)} body={pick(passwordStep.body, locale)} />

            <Field data-invalid={touched && Boolean(problem)}>
              <FieldLabel>{pick(passwordStep.password, locale)}</FieldLabel>
              <Input
                type={passwordRevealed ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                placeholder={pick(passwordStep.passwordPlaceholder, locale)}
                onChange={(event) => { setPassword(event.target.value); setTouched(false); }}
              />
              {/* Under the box, one line that changes as they type: the whole policy at
                  rest, the one rule currently failing once typing starts, the all-clear
                  when nothing fails. Polite live region — a checklist ticking on every
                  keystroke is what this replaced. The reveal sits on the same line's
                  right edge, under the box it reveals; one reveal governs both boxes,
                  since two eyes would let someone show the first and check the second
                  against a field they cannot read. */}
              <div className="flex items-start justify-between gap-4">
                {touched && problem ? (
                  <FieldError>{pick(passwordStep.problem[problem], locale)}</FieldError>
                ) : (
                  <FieldDescription
                    aria-live="polite"
                    className={cn(
                      "flex items-start gap-1.5",
                      password && problem && "text-destructive-ink",
                      password && !problem && "text-success-ink",
                    )}
                  >
                    {password && problem ? <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden /> : null}
                    {password && !problem ? <CheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden /> : null}
                    <span>{pick(!password ? passwordStep.rules : problem ? passwordStep.problem[problem] : passwordStep.ok, locale)}</span>
                  </FieldDescription>
                )}
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto shrink-0 p-0"
                  aria-pressed={passwordRevealed}
                  onClick={() => setPasswordRevealed((value) => !value)}
                >
                  {passwordRevealed ? <EyeOffIcon data-icon="inline-start" aria-hidden /> : <EyeIcon data-icon="inline-start" aria-hidden />}
                  {pick(passwordRevealed ? passwordStep.hide : passwordStep.show, locale)}
                </Button>
              </div>
            </Field>

            <Field data-invalid={touched && password !== confirmPassword}>
              <FieldLabel>{pick(passwordStep.confirm, locale)}</FieldLabel>
              {/* The tick inside the box is the match signal; its absence is the
                  mismatch signal. Continue stays live either way — pressing it with a
                  mismatch says so in words below, rather than a button that will not
                  press and does not say why. */}
              <InputGroup>
                <InputGroupInput
                  type={passwordRevealed ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  placeholder={pick(passwordStep.confirmPlaceholder, locale)}
                  onChange={(event) => { setConfirmPassword(event.target.value); setTouched(false); }}
                />
                {confirmPassword && confirmPassword === password ? (
                  <InputGroupAddon align="inline-end" className="text-success-ink">
                    <CheckIcon aria-hidden />
                    <span className="sr-only">{pick(passwordStep.confirmMatch, locale)}</span>
                  </InputGroupAddon>
                ) : null}
              </InputGroup>
              <FieldError>{touched && password !== confirmPassword ? pick(passwordStep.confirmError, locale) : null}</FieldError>
            </Field>

            {/* Skip drops anything half-typed — an account is created with a password
                or without one, never with a password nobody confirmed. */}
            <Actions
              locale={locale}
              onBack={() => { setTouched(false); setStep("contact"); }}
              skip={{
                label: pick(passwordStep.skip, locale),
                onSkip: () => { setPassword(""); setConfirmPassword(""); setTouched(false); setStep(needsVerification ? "verification" : "terms"); },
              }}
            />
          </form>
        ) : null}

        {step === "verification" ? (
          <form className="flex flex-col gap-6" noValidate onSubmit={(event) => { event.preventDefault(); setTouched(true); if (!regNumber.trim() || !idFile) return; setTouched(false); setStep("terms"); }}>
            <Heading title={pick(verification.title, locale)} body={pick(verification.body, locale)} />
            <Field data-invalid={touched && !regNumber.trim()}>
              <FieldLabel>{pick(verification.numberLabel, locale)} <span className="text-destructive">*</span></FieldLabel>
              <Input value={regNumber} onChange={(event) => { setRegNumber(event.target.value); setTouched(false); }} />
              <FieldError>{touched && !regNumber.trim() ? pick(verification.numberError, locale) : null}</FieldError>
            </Field>
            <Field data-invalid={touched && !idFile}>
              <FieldLabel>{pick(verification.uploadLabel, locale)} <span className="text-destructive">*</span></FieldLabel>
              {/* The app's one upload row (Sept 3): the filled state is the
                  Attachment row with Change file / Remove on its right edge —
                  not a Change link stranded under the box. */}
              <UploadedDocField
                label={pick(verification.uploadLabel, locale)}
                required
                file={idFile}
                onFileChange={(file) => { setIdFile(file); setTouched(false); }}
                copy={{
                  changeFile: pick(verificationUi.changeFile, locale),
                  remove: pick(verificationUi.removeFile, locale),
                  noFile: pick(verificationUi.noFile, locale),
                  chooseFile: pick(verificationUi.chooseFile, locale),
                }}
              />
              <FieldDescription>{pick(verification.uploadHint, locale)} {pick(verificationUi.fileHelp, locale)}</FieldDescription>
              <FieldError>{touched && !idFile ? pick(verification.uploadError, locale) : null}</FieldError>
            </Field>
            <Actions locale={locale} onBack={() => { setTouched(false); setStep("password"); }} />
          </form>
        ) : null}

        {step === "terms" ? (
          <form className="flex flex-col gap-6" onSubmit={(event) => { event.preventDefault(); setTouched(true); if (!termsAccepted) return; if (NEEDS_VERIFICATION.has(role)) setAppId(applicationId(role)); setStep("success"); }}>
            <Heading title={pick(termsStep.title, locale)} body={pick(termsStep.body, locale)} />
            <div className="divide-y divide-border border-y border-border">{termsStep.clauses.map((clause, index) => <div key={index} className="flex gap-3 py-4"><span className="text-body-compact font-semibold text-muted-foreground">{index + 1}.</span><p className="text-body-compact text-muted-foreground">{pick(clause, locale)}</p></div>)}</div>
            <Field data-invalid={touched && !termsAccepted}><div className="flex items-start gap-3 rounded-lg bg-surface-sunken p-4"><Checkbox id="registration-terms" checked={termsAccepted} onCheckedChange={(checked) => { setTermsAccepted(checked === true); setTouched(false); }} /><Label htmlFor="registration-terms" className="cursor-pointer text-body-compact leading-5">{pick(termsStep.accept, locale)}</Label></div><FieldError>{touched && !termsAccepted ? pick(termsStep.error, locale) : null}</FieldError></Field>
            <Actions locale={locale} onBack={() => { setTouched(false); setStep(needsVerification ? "verification" : "password"); }} submitLabel={pick(termsStep.submit, locale)} />
          </form>
        ) : null}
      </div>
    </div>
  );
}
