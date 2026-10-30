"use client";

/**
 * Add a Power of Attorney holder — scenarios 5 and 8 of the party-actions
 * spec, one flow. An **application**: unlike an advocate (whose vakalatnama
 * is the authority), a PoA-holder is added only by a magistrate's order,
 * and the flow says so before asking for anything.
 *
 * Scenario 8 lives inside scenario 5 rather than as a fourth menu entry:
 * "an existing party becomes the PoA-holder" is the same application with
 * the person picked from the case instead of entered fresh, so it is a
 * choice on the holder step. One flow, two ways to name the person.
 *
 * A party carries at most one PoA-holder, so a party that already has one
 * is shown but not selectable; replacing them is its own action
 * (scenario 7), not a second add.
 *
 * Composed in the owner's dialog grammar (join-case dialog): sm:max-w-xl,
 * hairline header, semibold field labels as section headings on the body
 * fill, DocumentSlot for the deed, plain
 * hairline footer. The first cut aped the witness dialog's oversized
 * case-screen style and was rejected (Sept 1).
 */

import { FileXIcon } from "lucide-react";
import { useMemo, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { FlowStepper } from "@/components/cases/flow-stepper";
import { usePartiesLive } from "@/components/cases/parties-live";
import {
  ChromeAlertDialogContent,
} from "@/components/chrome/app-chrome";
import { FlowDialogContent } from "@/components/chrome/flow-dialog";
import {
  PartyApplicationDocument,
  PartySignatureDialog,
  type CaseRef,
} from "@/components/cases/party-application";
import {
  UPLOAD_HELP,
  UploadedDocField,
} from "@/components/cases/uploaded-doc-field";
import {
  PARTY_SIDE_LABEL,
  POA_REASON_MAX_LENGTH,
  type PartyOption,
} from "@/lib/cases/party-actions";
import { ConfirmMark } from "@/components/feedback";

type PoaStep = 1 | 2 | 3;

const STEPS = [
  {
    step: 1,
    title: "Holder and party",
    description:
      "Name the person who will hold the Power of Attorney, and the party granting it.",
  },
  {
    step: 2,
    title: "Grounds and deed",
    description: "State why the party needs a PoA-holder and attach the deed.",
  },
  {
    step: 3,
    title: "Review",
    description:
      "The application goes to the magistrate. The PoA-holder is added when the order is passed.",
  },
] as const;

type HolderMode = "new" | "existing";

type Errors = {
  party?: string;
  holderName?: string;
  holderPhone?: string;
  existing?: string;
  reason?: string;
  deed?: string;
};

export function AddPoaDialog({
  open,
  onOpenChange,
  litigants,
  casePeople,
  caseRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The viewer's own clients only; never the opposing side. */
  litigants: PartyOption[];
  /**
   * Scenario 8's pool: everyone attached to the case on the viewer's own
   * side (PM + owner, Sept 2) — its litigants, its on-nama advocates, and
   * its office staff.
   */
  casePeople: { key: string; name: string; detail: string }[];
  /** How the paper names the case. */
  caseRef: CaseRef;
}) {
  const [step, setStep] = useState<PoaStep>(1);
  const [partyId, setPartyId] = useState("");
  const [holderMode, setHolderMode] = useState<HolderMode>("new");
  const [holderName, setHolderName] = useState("");
  const [holderPhone, setHolderPhone] = useState("");
  const [existingKey, setExistingKey] = useState("");
  const [reason, setReason] = useState("");
  const [deedFile, setDeedFile] = useState<File | null>(null);
  /** The sign dialog, layered over the review (Sept 2). */
  const [signOpen, setSignOpen] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [exitConfirmationOpen, setExitConfirmationOpen] = useState(false);
  /* Null outside the Parties tab (the dialog has other hosts). */
  const live = usePartiesLive();

  const current = STEPS.find((item) => item.step === step) ?? STEPS[0];
  const isDirty = useMemo(
    () =>
      Boolean(
        partyId || holderName || holderPhone || existingKey || reason || deedFile
      ),
    [partyId, holderName, holderPhone, existingKey, reason, deedFile]
  );

  const grantingParty = litigants.find((party) => party.id === partyId);

  /* The granting party cannot hold their own PoA; everyone else stays. */
  const existingPeople = casePeople.filter(
    (person) => person.key !== `party:${partyId}`
  );

  const holderDisplayName =
    holderMode === "new"
      ? holderName.trim()
      : existingPeople.find((person) => person.key === existingKey)?.name ?? "";

  function resetForm() {
    setStep(1);
    setPartyId("");
    setHolderMode("new");
    setHolderName("");
    setHolderPhone("");
    setExistingKey("");
    setReason("");
    setDeedFile(null);
    setSignOpen(false);
    setErrors({});
    setExitConfirmationOpen(false);
  }

  function closeClean() {
    resetForm();
    onOpenChange(false);
  }

  function requestExit() {
    if (isDirty) {
      setExitConfirmationOpen(true);
      return;
    }
    closeClean();
  }

  /** The generated application — the review sheet and the paper that is signed. */
  const applicationDoc = {
    matter: "Application for the appointment of a PoA-holder",
    facts: [
      { term: "Granting party", value: grantingParty?.name ?? "" },
      {
        term: "PoA-holder",
        value:
          holderMode === "existing"
            ? `${holderDisplayName} (already on this case)`
            : holderDisplayName,
      },
      ...(holderMode === "new" && holderPhone
        ? [{ term: "Mobile number", value: holderPhone }]
        : []),
      ...(deedFile ? [{ term: "Annexure", value: deedFile.name }] : []),
    ],
    prayer: [
      `The applicant, counsel on record in the above matter, prays that ${holderDisplayName || "the person named above"} be recognised as the Power of Attorney holder of ${grantingParty?.name ?? "the party"} under the deed annexed.`,
      `Grounds: ${reason.trim()}`,
      "It is prayed that this Hon'ble Court may allow this application and pass such orders as are deemed fit.",
    ],
  };

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (step === 1) {
      const next: Errors = {};
      if (!partyId) next.party = "Pick the party granting the Power of Attorney.";
      if (holderMode === "new") {
        if (!holderName.trim()) next.holderName = "Enter the holder's name.";
        if (holderPhone.length !== 10) {
          next.holderPhone = "Enter the holder's 10-digit mobile number.";
        }
      } else if (!existingKey) {
        next.existing = "Pick who on the case will take on the role.";
      }
      setErrors(next);
      if (Object.values(next).some(Boolean)) return;
      setStep(2);
      return;
    }

    if (step === 2) {
      const next: Errors = {};
      if (!reason.trim()) next.reason = "State why the party needs a PoA-holder.";
      if (!deedFile) next.deed = "Upload the Power of Attorney deed to continue.";
      setErrors(next);
      if (Object.values(next).some(Boolean)) return;
      setStep(3);
    }
  }

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
          {(
            <>
          {/* Own band + hairline for the stepper; see add-advocate-dialog. */}
          <div className="shrink-0 border-b border-hairline px-6 pt-6 pb-4">
            <FlowStepper
              steps={STEPS}
              current={step}
              label="Add Power of Attorney holder progress"
            />
          </div>
          <DialogHeader className="shrink-0 gap-1.5 border-b border-hairline px-6 py-5 pr-14 text-left">
            <DialogTitle className="text-title-s font-semibold text-balance">
              {current.title}
            </DialogTitle>
            <DialogDescription className="text-pretty">
              {current.description}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <form
              id="add-poa-form"
              noValidate
              onSubmit={handleSubmit}
              className="flex flex-col gap-6"
            >
              {step === 1 ? (
                <>
                  {/* No process banner here: the review step already says the
                      application goes to the magistrate (owner, Sept 1). */}
                  <Field data-invalid={Boolean(errors.party)}>
                    <FieldLabel className="block w-full text-body font-semibold leading-snug">
                      Who is granting the Power of Attorney?
                    </FieldLabel>
                    <FieldDescription>
                      A party can have at most one PoA-holder.
                    </FieldDescription>
                    <RadioGroup
                      value={partyId}
                      onValueChange={(value) => {
                        setPartyId(value);
                        /* The pool excludes the granting party, so a pick
                           made before the party changes can go stale. */
                        setExistingKey("");
                        setErrors((c) => ({ ...c, party: undefined }));
                      }}
                      className="flex flex-col gap-1"
                    >
                      {litigants.map((party) => {
                        const taken = Boolean(party.poaHolder);
                        return (
                          <div
                            key={party.id}
                            className="flex items-start gap-2"
                          >
                            <RadioGroupItem
                              id={`poa-party-${party.id}`}
                              value={party.id}
                              disabled={taken}
                              className="mt-2.5"
                              aria-invalid={Boolean(errors.party)}
                            />
                            <div className="flex min-w-0 flex-col gap-0.5">
                              <div className="flex min-h-10 items-center">
                                <Label
                                  htmlFor={`poa-party-${party.id}`}
                                  className={
                                    taken ? "text-muted-foreground" : undefined
                                  }
                                >
                                  {party.name}
                                  <span className="font-normal text-muted-foreground">
                                    {" "}
                                    · {PARTY_SIDE_LABEL[party.side]}
                                  </span>
                                </Label>
                              </div>
                              {taken ? (
                                <p className="-mt-2 pb-2 text-caption text-muted-foreground">
                                  Already has a PoA-holder ({party.poaHolder}).
                                  Replace them instead of adding a second.
                                </p>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </RadioGroup>
                    <FieldError>{errors.party}</FieldError>
                  </Field>

                  <Field>
                    <FieldLabel className="block w-full text-body font-semibold leading-snug">
                      Who will hold it?
                    </FieldLabel>
                    <RadioGroup
                      value={holderMode}
                      onValueChange={(value) => {
                        setHolderMode(value as HolderMode);
                        setErrors((c) => ({
                          ...c,
                          holderName: undefined,
                          holderPhone: undefined,
                          existing: undefined,
                        }));
                      }}
                      className="flex flex-col gap-1"
                    >
                      <div className="flex min-h-10 items-center gap-2">
                        <RadioGroupItem id="poa-holder-new" value="new" />
                        <Label htmlFor="poa-holder-new">Someone new</Label>
                      </div>
                      <div className="flex min-h-10 items-center gap-2">
                        <RadioGroupItem
                          id="poa-holder-existing"
                          value="existing"
                        />
                        <Label htmlFor="poa-holder-existing">
                          Someone already on this case
                        </Label>
                      </div>
                    </RadioGroup>
                  </Field>

                  {holderMode === "new" ? (
                    <>
                      <Field data-invalid={Boolean(errors.holderName)}>
                        <FieldLabel htmlFor="poa-holder-name">
                          Full name
                        </FieldLabel>
                        <Input
                          id="poa-holder-name"
                          autoComplete="off"
                          value={holderName}
                          onChange={(event) => {
                            setHolderName(event.target.value);
                            setErrors((c) => ({ ...c, holderName: undefined }));
                          }}
                        />
                        <FieldError>{errors.holderName}</FieldError>
                      </Field>
                      <Field data-invalid={Boolean(errors.holderPhone)}>
                        <FieldLabel htmlFor="poa-holder-phone">
                          Mobile number
                        </FieldLabel>
                        <Input
                          id="poa-holder-phone"
                          type="tel"
                          inputMode="numeric"
                          autoComplete="off"
                          maxLength={10}
                          value={holderPhone}
                          onChange={(event) => {
                            setHolderPhone(
                              event.target.value.replace(/\D/g, "").slice(0, 10)
                            );
                            setErrors((c) => ({ ...c, holderPhone: undefined }));
                          }}
                        />
                        <FieldError>{errors.holderPhone}</FieldError>
                      </Field>
                    </>
                  ) : (
                    <Field data-invalid={Boolean(errors.existing)}>
                      <FieldLabel className="block w-full text-body font-semibold leading-snug">
                        Who takes on the role?
                      </FieldLabel>
                      <FieldDescription>
                        No new person joins the case. They take on the PoA role
                        alongside what they already are.
                      </FieldDescription>
                      <RadioGroup
                        value={existingKey}
                        onValueChange={(value) => {
                          setExistingKey(value);
                          setErrors((c) => ({ ...c, existing: undefined }));
                        }}
                        className="flex flex-col gap-1"
                      >
                        {existingPeople.map((person) => (
                          <div
                            key={person.key}
                            className="flex min-h-10 items-center gap-2"
                          >
                            <RadioGroupItem
                              id={`poa-existing-${person.key}`}
                              value={person.key}
                              aria-invalid={Boolean(errors.existing)}
                            />
                            <Label htmlFor={`poa-existing-${person.key}`}>
                              {person.name}
                              <span className="font-normal text-muted-foreground">
                                {" "}
                                · {person.detail}
                              </span>
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                      <FieldError>{errors.existing}</FieldError>
                    </Field>
                  )}
                </>
              ) : step === 2 ? (
                <>
                  <Field data-invalid={Boolean(errors.reason)}>
                    <FieldLabel
                      className="block w-full text-body font-semibold leading-snug"
                      htmlFor="poa-reason"
                    >
                      Why does {grantingParty?.name ?? "the party"} need a
                      PoA-holder?
                    </FieldLabel>
                    <FieldDescription>
                      The magistrate reads this to decide the application.
                    </FieldDescription>
                    <Textarea
                      id="poa-reason"
                      className="min-h-24"
                      maxLength={POA_REASON_MAX_LENGTH}
                      value={reason}
                      onChange={(event) => {
                        setReason(event.target.value);
                        setErrors((c) => ({ ...c, reason: undefined }));
                      }}
                    />
                    <FieldDescription className="flex justify-end">
                      {reason.length.toLocaleString("en-IN")} /{" "}
                      {POA_REASON_MAX_LENGTH.toLocaleString("en-IN")}
                    </FieldDescription>
                    <FieldError>{errors.reason}</FieldError>
                  </Field>

                  <Field data-invalid={Boolean(errors.deed)}>
                    <FieldLabel className="block w-full text-body font-semibold leading-snug">
                      Power of Attorney deed
                    </FieldLabel>
                    <FieldDescription>
                      The executed deed naming {holderDisplayName || "the holder"}{" "}
                      for {grantingParty?.name ?? "the party"}.
                    </FieldDescription>
                    <UploadedDocField
                      label="Power of Attorney deed"
                      required
                      file={deedFile}
                      onFileChange={(file) => {
                        setDeedFile(file);
                        setErrors((c) => ({ ...c, deed: undefined }));
                      }}
                    />
                    <FieldDescription>{UPLOAD_HELP}</FieldDescription>
                    <FieldError>{errors.deed}</FieldError>
                  </Field>
                </>
              ) : (
                <PartyApplicationDocument
                  caseRef={caseRef}
                  doc={applicationDoc}
                />
              )}
            </form>
          </div>

          <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-hairline px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            {step > 1 ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep((s) => (s - 1) as PoaStep)}
              >
                Back
              </Button>
            ) : (
              <span aria-hidden className="hidden sm:block" />
            )}
            {step < 3 ? (
              <Button type="submit" form="add-poa-form">
                Continue
              </Button>
            ) : (
              <Button type="button" onClick={() => setSignOpen(true)}>
                Continue to sign
              </Button>
            )}
          </footer>
            </>
          )}
        </FlowDialogContent>
      </Dialog>

      <PartySignatureDialog
        open={signOpen}
        onClose={() => setSignOpen(false)}
        onComplete={() => {
          /* The granting party's pane grows a Power of attorney section
             with the holder waiting on the order — the application must
             show where its result will land. */
          if (partyId && holderDisplayName) {
            live?.addPoaHolder(partyId, holderDisplayName);
          }
          closeClean();
        }}
        confirmation={{
          title: "Application sent to the magistrate",
          description: `${holderDisplayName || "The holder"} is added as ${grantingParty?.name ?? "the party"}'s PoA-holder once the order is passed.`,
        }}
      />

      <AlertDialog
        open={exitConfirmationOpen}
        onOpenChange={setExitConfirmationOpen}
      >
        <ChromeAlertDialogContent>
          <AlertDialogHeader>
            <ConfirmMark danger icon={FileXIcon} />
            <AlertDialogTitle>Discard this application?</AlertDialogTitle>
            <AlertDialogDescription>
              The details entered here will be lost if you discard this draft.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={closeClean}>
              Discard draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </ChromeAlertDialogContent>
      </AlertDialog>
    </>
  );
}
