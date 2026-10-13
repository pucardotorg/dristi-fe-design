"use client";

/**
 * Remove and Replace for a Power of Attorney holder — scenarios 6 and 7 of
 * the party-actions spec, acting on the holder's own well in the Parties
 * detail pane (you act on the person where you see them; the same berth
 * the Representation wells give advocate removal).
 *
 * Both are applications: unlike advocate removal there is no consent fork,
 * because the PoA-holder's role only ever changes by the magistrate's
 * order. Remove is grounds + document → review. Replace is the same with
 * the new holder named first — the "someone new or someone on the case"
 * step reused from Add-PoA — and the new deed attached with the grounds.
 *
 * Own side only: the server renders these actions on the viewer's own
 * litigants and gives the other side a plain fact well.
 */

import { displayName } from "@/lib/cases/names";
import { useMemo, useState } from "react";
import {
  EllipsisVerticalIcon,
  Trash2Icon,
  UserRoundPenIcon,
} from "lucide-react";

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { POA_REASON_MAX_LENGTH } from "@/lib/cases/party-actions";

/** Someone already on the case who could take the role over (scenario 8). */
export type ExistingPersonOption = { key: string; name: string; detail: string };

export function PoaHolderWell({
  holder,
  partyName,
  caseRef,
  existingPeople,
}: {
  holder: string;
  partyName: string;
  /** How the paper names the case — both actions are applications. */
  caseRef: CaseRef;
  existingPeople: ExistingPersonOption[];
}) {
  const [open, setOpen] = useState<"remove" | "replace" | null>(null);
  /* Once an application is out, the well is the requester's waiting view —
     the line names what was asked, the menu retires so the same request
     cannot be raised twice. Session-local; the tasks service is the real
     record (the RepresentationWell convention). */
  const [pending, setPending] = useState<string | null>(null);

  return (
    <>
      {/* Two actions on a half-pane well truncated the name, so they fold
          into one overflow menu that names its tasks. */}
      <div className="flex min-h-12 min-w-0 items-center gap-2 rounded-md bg-surface-sunken py-2 pr-2 pl-3">
        <span className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <span className="block truncate text-body-compact font-medium text-foreground">
            {displayName(holder)}
          </span>
          {pending ? (
            <span className="block truncate text-caption text-muted-foreground">
              {pending}
            </span>
          ) : null}
        </span>
        {!pending ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0 text-muted-foreground"
                aria-label={`Actions for ${holder}`}
              >
                <EllipsisVerticalIcon aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              <DropdownMenuItem onSelect={() => setOpen("replace")}>
                <UserRoundPenIcon aria-hidden />
                Replace holder
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setOpen("remove")}
              >
                <Trash2Icon aria-hidden />
                Remove holder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      <RemovePoaDialog
        open={open === "remove"}
        onOpenChange={(next) => setOpen(next ? "remove" : null)}
        holder={holder}
        partyName={partyName}
        caseRef={caseRef}
        onRequested={() => setPending("Removal requested · awaiting order")}
      />
      <ReplacePoaDialog
        open={open === "replace"}
        onOpenChange={(next) => setOpen(next ? "replace" : null)}
        holder={holder}
        partyName={partyName}
        caseRef={caseRef}
        existingPeople={existingPeople}
        onRequested={(newHolder) =>
          setPending(
            `Replacement by ${newHolder || "a new holder"} requested · awaiting order`
          )
        }
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Remove (scenario 6)                                                 */
/* ------------------------------------------------------------------ */

const REMOVE_STEPS = [
  {
    step: 1,
    title: "Grounds",
    description:
      "State why the PoA-holder should be removed and attach proof.",
  },
  {
    step: 2,
    title: "Review",
    description: "Confirm the application before sending it to the court.",
  },
] as const;

function RemovePoaDialog({
  open,
  onOpenChange,
  holder,
  partyName,
  caseRef,
  onRequested,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  holder: string;
  partyName: string;
  caseRef: CaseRef;
  /** Fired when the application goes out — the well's waiting view. */
  onRequested?: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [reason, setReason] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [signOpen, setSignOpen] = useState(false);
  const [errors, setErrors] = useState<{ reason?: string; document?: string }>(
    {}
  );
  const [exitConfirmationOpen, setExitConfirmationOpen] = useState(false);

  const current = REMOVE_STEPS.find((item) => item.step === step) ?? REMOVE_STEPS[0];
  const isDirty = useMemo(() => Boolean(reason || docFile), [reason, docFile]);

  function resetForm() {
    setStep(1);
    setReason("");
    setDocFile(null);
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

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: { reason?: string; document?: string } = {};
    if (!reason.trim()) next.reason = "State why they should be removed.";
    if (!docFile) next.document = "Upload a supporting document to continue.";
    setErrors(next);
    if (next.reason || next.document) return;
    setStep(2);
  }

  /** The generated application — the review sheet and the paper that is signed. */
  const applicationDoc = {
    matter: "Application for the removal of a PoA-holder",
    facts: [
      { term: "PoA-holder", value: holder },
      { term: "For", value: partyName },
      ...(docFile ? [{ term: "Annexure", value: docFile.name }] : []),
    ],
    prayer: [
      `The applicant, counsel on record in the above matter, prays that ${holder} cease to be the Power of Attorney holder of ${partyName}.`,
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
          <>
              {/* No stepper: two steps do not earn one. Heading stays put so
                  the review does not read as a different task (owner, Sept 2). */}
              <DialogHeader className="shrink-0 gap-1.5 border-b border-hairline px-6 py-5 pr-14 text-left">
                <DialogTitle className="text-title-s font-semibold text-balance">
                  Remove {holder}
                </DialogTitle>
                <DialogDescription>
                  {step === 2
                    ? `Once the magistrate orders it, ${holder} is no longer ${partyName}'s PoA-holder.`
                    : current.description}
                </DialogDescription>
              </DialogHeader>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <form
                  id="remove-poa-form"
                  noValidate
                  onSubmit={handleSubmit}
                  className="flex flex-col gap-6"
                >
                  {step === 1 ? (
                    <>
                      <Field data-invalid={Boolean(errors.reason)}>
                        <FieldLabel
                          className="block w-full text-body font-semibold leading-snug"
                          htmlFor="remove-poa-reason"
                        >
                          Why should they be removed?
                        </FieldLabel>
                        <FieldDescription>
                          The magistrate reads this to decide the application.
                        </FieldDescription>
                        <Textarea
                          id="remove-poa-reason"
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

                      <Field data-invalid={Boolean(errors.document)}>
                        <FieldLabel className="block w-full text-body font-semibold leading-snug">
                          Supporting document
                        </FieldLabel>
                        <UploadedDocField
                          label="Supporting document"
                          required
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
                    onClick={() => setStep(1)}
                  >
                    Back
                  </Button>
                ) : (
                  <span aria-hidden className="hidden sm:block" />
                )}
                {step === 1 ? (
                  <Button type="submit" form="remove-poa-form">
                    Continue
                  </Button>
                ) : (
                  <Button type="button" onClick={() => setSignOpen(true)}>
                    Continue to sign
                  </Button>
                )}
              </footer>
            </>
        </FlowDialogContent>
      </Dialog>

      <PartySignatureDialog
        open={signOpen}
        onClose={() => setSignOpen(false)}
        onComplete={() => {
          onRequested?.();
          closeClean();
        }}
        confirmation={{
          title: "Application sent to the magistrate",
          description: `${holder} stays ${partyName}'s PoA-holder until the order is passed.`,
        }}
      />

      <DiscardConfirm
        open={exitConfirmationOpen}
        onOpenChange={setExitConfirmationOpen}
        onDiscard={closeClean}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Replace (scenario 7)                                                */
/* ------------------------------------------------------------------ */

const REPLACE_STEPS = [
  {
    step: 1,
    title: "New holder",
    description: "Name who takes over the Power of Attorney.",
  },
  {
    step: 2,
    title: "Grounds and deed",
    description: "State why the holder is being replaced and attach the new deed.",
  },
  {
    step: 3,
    title: "Review",
    description: "Confirm the application before sending it to the court.",
  },
] as const;

type HolderMode = "new" | "existing";

function ReplacePoaDialog({
  open,
  onOpenChange,
  holder,
  partyName,
  caseRef,
  existingPeople,
  onRequested,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  holder: string;
  partyName: string;
  caseRef: CaseRef;
  existingPeople: ExistingPersonOption[];
  /** Fired when the application goes out, with the new holder's name. */
  onRequested?: (newHolder: string) => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [holderMode, setHolderMode] = useState<HolderMode>("new");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [existingKey, setExistingKey] = useState("");
  const [reason, setReason] = useState("");
  const [deedFile, setDeedFile] = useState<File | null>(null);
  const [signOpen, setSignOpen] = useState(false);
  const [errors, setErrors] = useState<{
    holderName?: string;
    holderPhone?: string;
    existing?: string;
    reason?: string;
    deed?: string;
  }>({});
  const [exitConfirmationOpen, setExitConfirmationOpen] = useState(false);

  const current =
    REPLACE_STEPS.find((item) => item.step === step) ?? REPLACE_STEPS[0];
  const isDirty = useMemo(
    () => Boolean(newName || newPhone || existingKey || reason || deedFile),
    [newName, newPhone, existingKey, reason, deedFile]
  );

  const newHolderName =
    holderMode === "new"
      ? newName.trim()
      : existingPeople.find((person) => person.key === existingKey)?.name ?? "";

  function resetForm() {
    setStep(1);
    setHolderMode("new");
    setNewName("");
    setNewPhone("");
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

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (step === 1) {
      const next: typeof errors = {};
      if (holderMode === "new") {
        if (!newName.trim()) next.holderName = "Enter the new holder's name.";
        if (newPhone.length !== 10) {
          next.holderPhone = "Enter the new holder's 10-digit mobile number.";
        }
      } else if (!existingKey) {
        next.existing = "Pick who on the case takes over the role.";
      }
      setErrors(next);
      if (Object.values(next).some(Boolean)) return;
      setStep(2);
      return;
    }

    if (step === 2) {
      const next: typeof errors = {};
      if (!reason.trim()) next.reason = "State why the holder is being replaced.";
      if (!deedFile) next.deed = "Upload the new Power of Attorney deed.";
      setErrors(next);
      if (Object.values(next).some(Boolean)) return;
      setStep(3);
    }
  }

  /** The generated application — the review sheet and the paper that is signed. */
  const applicationDoc = {
    matter: "Application for the replacement of a PoA-holder",
    facts: [
      { term: "Outgoing holder", value: holder },
      {
        term: "New holder",
        value:
          holderMode === "existing"
            ? `${newHolderName} (already on this case)`
            : newHolderName,
      },
      { term: "For", value: partyName },
      ...(holderMode === "new" && newPhone
        ? [{ term: "Mobile number", value: newPhone }]
        : []),
      ...(deedFile ? [{ term: "Annexure", value: deedFile.name }] : []),
    ],
    prayer: [
      `The applicant, counsel on record in the above matter, prays that ${holder} cease to be the Power of Attorney holder of ${partyName}, and that ${newHolderName || "the person named above"} be recognised in their place under the deed annexed.`,
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
          {(
            <>
              <div className="shrink-0 border-b border-hairline px-6 pt-6 pb-4">
                <FlowStepper
                  steps={REPLACE_STEPS}
                  current={step}
                  label="Replace PoA-holder progress"
                />
              </div>
              <DialogHeader className="shrink-0 gap-1.5 border-b border-hairline px-6 py-5 pr-14 text-left">
                <DialogTitle className="text-title-s font-semibold text-balance">
                  {step === 1 ? `Replace ${holder}` : current.title}
                </DialogTitle>
                <DialogDescription>
                  {step === 3
                    ? `Once the magistrate orders it, ${newHolderName || "the new holder"} holds ${partyName}'s Power of Attorney in place of ${holder}.`
                    : current.description}
                </DialogDescription>
              </DialogHeader>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <form
                  id="replace-poa-form"
                  noValidate
                  onSubmit={handleSubmit}
                  className="flex flex-col gap-6"
                >
                  {step === 1 ? (
                    <>
                      <Field>
                        <FieldLabel className="block w-full text-body font-semibold leading-snug">
                          Who takes over?
                        </FieldLabel>
                        <RadioGroup
                          value={holderMode}
                          onValueChange={(value) => {
                            setHolderMode(value as HolderMode);
                            setErrors({});
                          }}
                          className="flex flex-col gap-1"
                        >
                          <div className="flex min-h-10 items-center gap-2">
                            <RadioGroupItem id="replace-poa-new" value="new" />
                            <Label htmlFor="replace-poa-new">Someone new</Label>
                          </div>
                          <div className="flex min-h-10 items-center gap-2">
                            <RadioGroupItem
                              id="replace-poa-existing"
                              value="existing"
                            />
                            <Label htmlFor="replace-poa-existing">
                              Someone already on this case
                            </Label>
                          </div>
                        </RadioGroup>
                      </Field>

                      {holderMode === "new" ? (
                        <>
                          <Field data-invalid={Boolean(errors.holderName)}>
                            <FieldLabel htmlFor="replace-poa-name">
                              Full name
                            </FieldLabel>
                            <Input
                              id="replace-poa-name"
                              autoComplete="off"
                              value={newName}
                              onChange={(event) => {
                                setNewName(event.target.value);
                                setErrors((c) => ({
                                  ...c,
                                  holderName: undefined,
                                }));
                              }}
                            />
                            <FieldError>{errors.holderName}</FieldError>
                          </Field>
                          <Field data-invalid={Boolean(errors.holderPhone)}>
                            <FieldLabel htmlFor="replace-poa-phone">
                              Mobile number
                            </FieldLabel>
                            <Input
                              id="replace-poa-phone"
                              type="tel"
                              inputMode="numeric"
                              autoComplete="off"
                              maxLength={10}
                              value={newPhone}
                              onChange={(event) => {
                                setNewPhone(
                                  event.target.value
                                    .replace(/\D/g, "")
                                    .slice(0, 10)
                                );
                                setErrors((c) => ({
                                  ...c,
                                  holderPhone: undefined,
                                }));
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
                            No new person joins the case. They take on the PoA
                            role alongside what they already are.
                          </FieldDescription>
                          <RadioGroup
                            value={existingKey}
                            onValueChange={(value) => {
                              setExistingKey(value);
                              setErrors((c) => ({
                                ...c,
                                existing: undefined,
                              }));
                            }}
                            className="flex flex-col gap-1"
                          >
                            {existingPeople.map((person) => (
                              <div
                                key={person.key}
                                className="flex min-h-10 items-center gap-2"
                              >
                                <RadioGroupItem
                                  id={`replace-poa-${person.key}`}
                                  value={person.key}
                                  aria-invalid={Boolean(errors.existing)}
                                />
                                <Label htmlFor={`replace-poa-${person.key}`}>
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
                          htmlFor="replace-poa-reason"
                        >
                          Why is {holder} being replaced?
                        </FieldLabel>
                        <FieldDescription>
                          The magistrate reads this to decide the application.
                        </FieldDescription>
                        <Textarea
                          id="replace-poa-reason"
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
                          New Power of Attorney deed
                        </FieldLabel>
                        <FieldDescription>
                          The executed deed naming{" "}
                          {newHolderName || "the new holder"} for {partyName}.
                        </FieldDescription>
                        <UploadedDocField
                          label="New Power of Attorney deed"
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
                    onClick={() => setStep((s) => (s - 1) as 1 | 2)}
                  >
                    Back
                  </Button>
                ) : (
                  <span aria-hidden className="hidden sm:block" />
                )}
                {step < 3 ? (
                  <Button type="submit" form="replace-poa-form">
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
          onRequested?.(newHolderName);
          closeClean();
        }}
        confirmation={{
          title: "Application sent to the magistrate",
          description: `${holder} is replaced by ${newHolderName || "the new holder"} once the order is passed.`,
        }}
      />

      <DiscardConfirm
        open={exitConfirmationOpen}
        onOpenChange={setExitConfirmationOpen}
        onDiscard={closeClean}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Shared bits                                                          */
/* ------------------------------------------------------------------ */

function DiscardConfirm({
  open,
  onOpenChange,
  onDiscard,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDiscard: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <ChromeAlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard this application?</AlertDialogTitle>
          <AlertDialogDescription>
            The details entered here will be lost if you discard this draft.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep editing</AlertDialogCancel>
          <AlertDialogAction variant="destructive-solid" onClick={onDiscard}>
            Discard draft
          </AlertDialogAction>
        </AlertDialogFooter>
      </ChromeAlertDialogContent>
    </AlertDialog>
  );
}
