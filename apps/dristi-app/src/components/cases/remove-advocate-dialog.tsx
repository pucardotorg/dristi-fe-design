"use client";

/**
 * Remove an advocate — scenarios 3a and 3b of the party-actions spec, one
 * flow with a fork. The grounds are stated once (reason + supporting
 * document); what forks is who approves the removal:
 *
 * - **Their consent (3b)** — a request the outgoing advocate accepts or
 *   rejects from their own Pending tasks. Quicker when the exit is amicable.
 * - **The magistrate (3a)** — a formal application; the advocate stays on
 *   the case until the order is passed.
 *
 * Two entry points, one dialog: the advocate's well in the Parties tab's
 * Representation section, and the vakalatnama rows of the Share-access
 * dialog (which could until now only explain why Remove was locked).
 * Office staff never come here; their access is revoked in one click in
 * the share dialog. This flow is only for advocates on the vakalatnama.
 *
 * Composed in the owner's dialog grammar; ends in the done stage, not a
 * disabled button (both Sept 1 rulings).
 */

import { useMemo, useState } from "react";
import { HourglassIcon } from "lucide-react";

import { DiscardQuestion, useDiscardGuard } from "@/components/chrome/discard-guard";
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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { FlowStepper } from "@/components/cases/flow-stepper";
import { FlowDialogContent } from "@/components/chrome/flow-dialog";
import {
  PartyApplicationDocument,
  PartySignatureDialog,
  type CaseRef,
} from "@/components/cases/party-application";
import {
  ReviewDocValue,
  UPLOAD_HELP,
  UploadedDocField,
} from "@/components/cases/uploaded-doc-field";

type RemoveStep = 1 | 2 | 3;

/**
 * Approval FIRST (PM, Sept 2): the route decides how much the grounds step
 * asks. Consent makes the reason and document optional context for the
 * outgoing advocate; the magistrate route makes both mandatory, because an
 * application without grounds is nothing.
 */
const STEPS = [
  {
    step: 1,
    title: "Approval",
    description: "Removal from the vakalatnama needs one of two approvals.",
  },
  {
    step: 2,
    title: "Grounds",
    description: "State why the advocate should be removed and attach proof.",
  },
  {
    step: 3,
    title: "Review",
    description: "Confirm the request before sending it.",
  },
] as const;

const REASON_MAX_LENGTH = 500;

type Route = "consent" | "magistrate" | "";

type Errors = {
  reason?: string;
  document?: string;
  route?: string;
};

export function RemoveAdvocateDialog({
  open,
  onOpenChange,
  advocateName,
  partyName,
  caseRef,
  onRequested,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The advocate being removed from the vakalatnama. */
  advocateName: string;
  /** The party they represent, where the entry point knows it. */
  partyName?: string;
  /** How the paper names the case — the magistrate route prints it. */
  caseRef: CaseRef;
  /** Fired when the removal goes out, with the route it took — the entry
      point's chance to show the wait ("requested · awaiting consent"). */
  onRequested?: (route: "consent" | "magistrate") => void;
}) {
  const [step, setStep] = useState<RemoveStep>(1);
  const [reason, setReason] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [route, setRoute] = useState<Route>("");
  const [done, setDone] = useState(false);
  /** The magistrate route's sign dialog, layered over the review (Sept 2). */
  const [signOpen, setSignOpen] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const current = STEPS.find((item) => item.step === step) ?? STEPS[0];
  const isDirty = useMemo(
    () => Boolean(reason || docFile || route),
    [reason, docFile, route]
  );

  function resetForm() {
    setStep(1);
    setReason("");
    setDocFile(null);
    setRoute("");
    setDone(false);
    setSignOpen(false);
    setErrors({});
  }

  function closeClean() {
    resetForm();
    onOpenChange(false);
  }

  const guard = useDiscardGuard(isDirty && !done, closeClean);

  function requestExit() {
    guard.close();
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (step === 1) {
      if (!route) {
        setErrors((c) => ({ ...c, route: "Pick who approves the removal." }));
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      // Mandatory only on the magistrate route; consent treats both as
      // optional context for the outgoing advocate.
      if (route === "magistrate") {
        const next: Errors = {};
        if (!reason.trim()) {
          next.reason = "State why the advocate should be removed.";
        }
        if (!docFile) {
          next.document = "Upload a supporting document to continue.";
        }
        setErrors(next);
        if (next.reason || next.document) return;
      }
      setStep(3);
    }
  }

  /** The generated application — the magistrate route's review sheet. */
  const applicationDoc = {
    matter: "Application for the removal of an advocate",
    facts: [
      { term: "Advocate", value: advocateName },
      ...(partyName ? [{ term: "Representing", value: partyName }] : []),
      ...(docFile ? [{ term: "Annexure", value: docFile.name }] : []),
    ],
    prayer: [
      `The applicant, counsel on record in the above matter, prays that ${advocateName} be removed from the vakalatnama${partyName ? ` of ${partyName}` : ""}.`,
      `Grounds: ${reason.trim()}`,
      "It is prayed that this Hon'ble Court may allow this application and pass such orders as are deemed fit.",
    ],
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (next) onOpenChange(true);
          else requestExit();
        }}
      >
        <FlowDialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
          {done ? (
            <>
              <DialogHeader className="shrink-0 px-6 py-5 pr-14 text-left">
                <div className="flex items-center gap-4">
                  <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-info-muted text-info-muted-foreground">
                    <HourglassIcon className="size-7" aria-hidden />
                  </span>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <DialogTitle className="text-title-s font-semibold text-balance">
                      {route === "consent"
                        ? `Request sent to ${advocateName}`
                        : "Application sent to the magistrate"}
                    </DialogTitle>
                    <DialogDescription className="text-pretty">
                      {route === "consent"
                        ? "They can accept or reject it. You'll be notified either way."
                        : `${advocateName} stays on the case until the order is passed.`}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <footer className="flex shrink-0 justify-end border-t border-hairline px-6 py-4">
                <Button type="button" onClick={closeClean}>
                  Done
                </Button>
              </footer>
            </>
          ) : (
            <>
              <div className="shrink-0 border-b border-hairline px-6 pt-6 pb-4">
                <FlowStepper
                  steps={STEPS}
                  current={step}
                  label="Remove advocate progress"
                />
              </div>
              <DialogHeader className="shrink-0 gap-1.5 border-b border-hairline px-6 py-5 pr-14 text-left">
                <DialogTitle className="text-title-s font-semibold text-balance">
                  {step === 1 ? `Remove ${advocateName}` : current.title}
                </DialogTitle>
                {/* No text-pretty here: it balanced the last line by breaking
                    early mid-sentence, which read as a stray line break
                    (owner, Sept 1). */}
                <DialogDescription>
                  {step === 3 && route
                    ? route === "consent"
                      ? `Once ${advocateName} accepts, they come off the vakalatnama.`
                      : `Once the magistrate orders it, ${advocateName} comes off the vakalatnama.`
                    : step === 2 && route === "consent"
                      ? `Give ${advocateName} the context for the request.`
                      : current.description}
                </DialogDescription>
              </DialogHeader>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <form
                  id="remove-advocate-form"
                  noValidate
                  onSubmit={handleSubmit}
                  className="flex flex-col gap-6"
                >
                  {step === 1 ? (
                    <Field data-invalid={Boolean(errors.route)}>
                      <FieldLabel className="block w-full text-body font-semibold leading-snug">
                        Who approves the removal?
                      </FieldLabel>
                      <RadioGroup
                        value={route}
                        onValueChange={(value) => {
                          setRoute(value as Route);
                          setErrors((c) => ({ ...c, route: undefined }));
                        }}
                        className="flex flex-col gap-3"
                      >
                        <div className="flex items-start gap-2">
                          <RadioGroupItem
                            id="remove-route-consent"
                            value="consent"
                            className="mt-2.5"
                            aria-invalid={Boolean(errors.route)}
                          />
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <div className="flex min-h-10 items-center">
                              <Label htmlFor="remove-route-consent">
                                Ask {advocateName} to consent
                              </Label>
                            </div>
                            <p className="-mt-2 pb-1 text-caption text-muted-foreground">
                              They accept or reject the request. Quicker when
                              the exit is amicable.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <RadioGroupItem
                            id="remove-route-magistrate"
                            value="magistrate"
                            className="mt-2.5"
                            aria-invalid={Boolean(errors.route)}
                          />
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <div className="flex min-h-10 items-center">
                              <Label htmlFor="remove-route-magistrate">
                                Apply to the magistrate
                              </Label>
                            </div>
                            <p className="-mt-2 pb-1 text-caption text-muted-foreground">
                              The magistrate hears the application and passes
                              an order. Use this when consent is unlikely.
                            </p>
                          </div>
                        </div>
                      </RadioGroup>
                      <FieldError>{errors.route}</FieldError>
                    </Field>
                  ) : step === 2 ? (
                    <>
                      <Field data-invalid={Boolean(errors.reason)}>
                        <FieldLabel
                          className="block w-full text-body font-semibold leading-snug"
                          htmlFor="remove-reason"
                        >
                          Why should they be removed?
                          {route === "consent" ? (
                            <span className="font-normal text-muted-foreground">
                              {" "}
                              (optional)
                            </span>
                          ) : null}
                        </FieldLabel>
                        <FieldDescription>
                          {route === "consent"
                            ? `Context for ${advocateName}; they see it with the request.`
                            : "The magistrate reads this to decide the application."}
                        </FieldDescription>
                        <Textarea
                          id="remove-reason"
                          className="min-h-24"
                          maxLength={REASON_MAX_LENGTH}
                          value={reason}
                          onChange={(event) => {
                            setReason(event.target.value);
                            setErrors((c) => ({ ...c, reason: undefined }));
                          }}
                        />
                        <FieldDescription className="flex justify-end">
                          {reason.length.toLocaleString("en-IN")} /{" "}
                          {REASON_MAX_LENGTH.toLocaleString("en-IN")}
                        </FieldDescription>
                        <FieldError>{errors.reason}</FieldError>
                      </Field>

                      <Field data-invalid={Boolean(errors.document)}>
                        <FieldLabel className="block w-full text-body font-semibold leading-snug">
                          Supporting document
                          {route === "consent" ? (
                            <span className="font-normal text-muted-foreground">
                              {" "}
                              (optional)
                            </span>
                          ) : null}
                        </FieldLabel>
                        <FieldDescription>
                          Whatever evidences the grounds: correspondence, a
                          client instruction, a notice.
                        </FieldDescription>
                        <UploadedDocField
                          label="Supporting document"
                          required={route === "magistrate"}
                          file={docFile}
                          onFileChange={(file) => {
                            setDocFile(file);
                            setErrors((c) => ({ ...c, document: undefined }));
                          }}
                        />
                        <FieldDescription>{UPLOAD_HELP}</FieldDescription>
                        <FieldError>{errors.document}</FieldError>
                      </Field>
                    </>
                  ) : route === "magistrate" ? (
                    <PartyApplicationDocument
                      caseRef={caseRef}
                      doc={applicationDoc}
                    />
                  ) : (
                    <DescriptionList>
                      <ReviewRow term="Advocate">
                        {advocateName}
                        {partyName ? (
                          <span className="text-muted-foreground">
                            {" "}
                            · representing {partyName}
                          </span>
                        ) : null}
                      </ReviewRow>
                      {reason.trim() ? (
                        <ReviewRow term="Grounds">
                          <span className="whitespace-pre-wrap">
                            {reason.trim()}
                          </span>
                        </ReviewRow>
                      ) : null}
                      {docFile ? (
                        <ReviewRow term="Document">
                          <ReviewDocValue file={docFile} />
                        </ReviewRow>
                      ) : null}
                      <ReviewRow term="Approved by">
                        {route === "consent"
                          ? `${advocateName}, by consent`
                          : "The magistrate, by order"}
                      </ReviewRow>
                    </DescriptionList>
                  )}
                </form>
              </div>

              <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-hairline px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                {step > 1 ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep((s) => (s - 1) as RemoveStep)}
                  >
                    Back
                  </Button>
                ) : (
                  <span aria-hidden className="hidden sm:block" />
                )}
                {step < 3 ? (
                  <Button type="submit" form="remove-advocate-form">
                    Continue
                  </Button>
                ) : route === "consent" ? (
                  <Button
                    type="button"
                    variant="destructive-solid"
                    onClick={() => {
                      onRequested?.("consent");
                      setDone(true);
                    }}
                  >
                    Send request
                  </Button>
                ) : (
                  <Button type="button" onClick={() => setSignOpen(true)}>
                    Continue to sign
                  </Button>
                )}
              </footer>
            </>
          )}
          <DiscardQuestion guard={guard} />
        </FlowDialogContent>
      </Dialog>

      <PartySignatureDialog
        open={signOpen}
        onClose={() => setSignOpen(false)}
        onComplete={() => {
          onRequested?.("magistrate");
          closeClean();
        }}
        confirmation={{
          title: "Application sent to the magistrate",
          description: `${advocateName} stays on the case until the order is passed.`,
        }}
      />
    </>
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
