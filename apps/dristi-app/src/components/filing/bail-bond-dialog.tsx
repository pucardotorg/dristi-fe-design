"use client";

import * as React from "react";
import {
  CopyIcon,
  CheckIcon,
  DownloadIcon,
  ExternalLinkIcon,
  SignatureIcon,
  XIcon,
} from "lucide-react";

import { FlowDialogContent } from "@/components/chrome/flow-dialog";
import { useBackCloses, useFlowWindow } from "@/components/chrome/flow-window";
import { Identifier } from "@/components/chrome/identifier";
import { Fact, FactGroup } from "@/components/cases/application-record-dialog";
import {
  AddressField,
  PrefilledField,
  RowWell,
  SelectField,
  TextField,
} from "@/components/cases/application-type-fields";
import {
  DiscardFilingDialog,
  FileField,
  focusFirstInvalid,
} from "@/components/cases/filing-form-shared";
import { ComposedDocumentViewer } from "@/components/cases/pdf-viewer";
import {
  UPLOAD_HELP,
  UploadedDocField,
} from "@/components/cases/uploaded-doc-field";
import { useCourtText } from "@/components/court/court-provider";
import { PaperFallbackLink } from "@/components/filing/paper-fallback";
import {
  ChoiceCard,
  DscLookup,
  InstrumentChoice,
  OtpEntry,
} from "@/components/filing/sign-stages";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionRow,
  DescriptionTerm,
} from "@/components/ui/description-list";
import {
  Dialog,
  DialogClose,
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AccessCase } from "@/lib/access/content";
import { datedThis } from "@/lib/cases/application-document";
import {
  emptySurety,
  resizeSureties,
  validateContact,
  validateSureties,
  type SuretyDraft,
} from "@/lib/cases/application-draft";
import { formatCaseDate } from "@/lib/cases/types";
import {
  BAIL_PETITIONERS,
  BOND_AMOUNT,
  BOND_ID,
  BOND_LITIGANT,
  BOND_REQUIRED_SURETIES,
  BOND_SIGN_LINK,
  BOND_SIGN_PATH,
  BOND_SURETIES,
  BOND_THIRD_SURETY,
  bailDialog,
  bondCopy,
  fillCopy,
  type BondSurety,
} from "@/lib/filing/content";
import { pick } from "@/lib/onboarding/content";
import { cn } from "@/lib/utils";
import { OutcomeHeader, OutcomeSummary, StatusLine, notify } from "@/components/feedback";

/**
 * The bail bond, in its three entries:
 *
 * `task`   — from the case file's "Raise bail bond" pending task, after the
 *            magistrate approved the bail application. The bail terms and the
 *            sureties from the application are locked (contact details stay
 *            editable — mistakes happen); the magistrate asked for one surety
 *            more, so a fresh form is demanded for it.
 * `edit`   — from the bond's status view. Editing invalidates every signature,
 *            so only contact details are open; everything else is as the
 *            magistrate approved it. A new bail application changes the rest.
 * `direct` — from Make filings, without a bail application. Everything is
 *            editable; a personal bond needs no sureties.
 *
 * It files the way Raise application does (PM, Oct 29: the bond did not look
 * like the applications): the details in a form dialog, Generate bail bond
 * opens the generated bond in the application record's frame, and Add
 * signature opens the same signing steps — sign digitally (Aadhaar OTP or
 * DSC) or upload a physically signed copy. The fields are the bail
 * application's own, so a surety is asked for in the same words in both.
 *
 * What stays the bond's own: e-signing sends the litigant and sureties their
 * own signing links, and a physically signed upload carries everyone's
 * signature already and goes straight to court review. There is no court
 * fee and no register to wait in, so there is no payment step and no Sign
 * later.
 */

export type BondMode = "task" | "direct" | "edit";

export type BailBondResult = {
  caseNumber: string;
  bondId: string;
  method: "esign" | "upload";
  edited: boolean;
};

type View = "form" | "generated" | "sign";

const BOND_TYPES = [
  { value: "surety" as const, label: "Surety" },
  { value: "personal" as const, label: "Personal bond" },
];

/** "₹50,000" from what was typed; the magistrate's figure as it stands. */
function rupees(amount: string): string {
  const digits = amount.replace(/[^\d]/g, "");
  return digits ? `₹${Number(digits).toLocaleString("en-IN")}` : "";
}

function lockedSuretiesFor(mode: BondMode): BondSurety[] {
  return mode === "edit"
    ? [...BOND_SURETIES, BOND_THIRD_SURETY]
    : mode === "task"
      ? BOND_SURETIES
      : [];
}

export function BailBondDialog({
  open,
  onOpenChange,
  accessCase,
  mode,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accessCase: AccessCase;
  mode: BondMode;
  onSubmitted?: (result: BailBondResult) => void;
}) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const formId = React.useId();
  const [view, setView] = React.useState<View>("form");
  const [discardOpen, setDiscardOpen] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string | undefined>>({});

  // Direct-mode fields; in task/edit mode the magistrate's terms stand in.
  const [petitionerId, setPetitionerId] = React.useState("");
  const [father, setFather] = React.useState("");
  const [fatherPrefilled, setFatherPrefilled] = React.useState(false);
  const [amount, setAmount] = React.useState("");
  const [bondType, setBondType] = React.useState<"" | "surety" | "personal">("");
  const [count, setCount] = React.useState("");

  const lockedSureties = lockedSuretiesFor(mode);
  const [lockedContacts, setLockedContacts] = React.useState(() =>
    lockedSureties.map((entry) => ({ phone: entry.phone, email: entry.email })),
  );
  const missingCount =
    mode === "task" ? Math.max(0, BOND_REQUIRED_SURETIES - BOND_SURETIES.length) : 0;
  const [sureties, setSureties] = React.useState<SuretyDraft[]>(() =>
    Array.from({ length: missingCount }, emptySurety),
  );

  const direct = mode === "direct";
  const personal = direct && bondType === "personal";
  const petitionerName = direct
    ? (BAIL_PETITIONERS.find((entry) => entry.id === petitionerId)?.name ?? "")
    : BOND_LITIGANT.name;
  const terms = {
    petitioner: petitionerName,
    father: direct ? father.trim() : BOND_LITIGANT.father,
    amount: direct ? rupees(amount) : BOND_AMOUNT,
    personal,
    sureties: personal
      ? []
      : [
          ...lockedSureties.map((entry) => entry.name),
          ...sureties.map((entry) => entry.fullName.trim()),
        ].filter(Boolean),
  };

  function reset() {
    setView("form");
    setDiscardOpen(false);
    setDirty(false);
    setErrors({});
    setPetitionerId("");
    setFather("");
    setFatherPrefilled(false);
    setAmount("");
    setBondType("");
    setCount("");
    setLockedContacts(
      lockedSureties.map((entry) => ({ phone: entry.phone, email: entry.email })),
    );
    setSureties(Array.from({ length: missingCount }, emptySurety));
  }

  function close() {
    reset();
    onOpenChange(false);
  }

  /** Closing midway asks first, once something was entered. */
  function requestClose() {
    if (dirty) setDiscardOpen(true);
    else close();
  }

  /* A window on a phone, the phone's Back doing what the footer's does: the
     form meets the discard warning, the later steps return to the one before. */
  const { phone } = useFlowWindow();
  useBackCloses(phone && open, () => {
    if (discardOpen) setDiscardOpen(false);
    else if (view === "generated") setView("form");
    else if (view === "form") requestClose();
  });

  function touch(...keys: string[]) {
    setDirty(true);
    setErrors((current) => {
      const next = { ...current };
      for (const key of keys) next[key] = undefined;
      return next;
    });
  }

  function choosePetitioner(id: string) {
    setPetitionerId(id);
    const entry = BAIL_PETITIONERS.find((option) => option.id === id);
    // The record knows the father's name: filled in, tinted until the filer
    // changes it, and replaced on a new petitioner while still untouched.
    if (entry && (!father.trim() || fatherPrefilled)) {
      setFather(entry.father);
      setFatherPrefilled(true);
    }
    touch("petitioner", "father");
  }

  function updateSurety(id: string, patch: Partial<SuretyDraft>) {
    setSureties((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
    touch(...Object.keys(patch).map((key) => `${id}.${key}`));
  }

  function validate(): Record<string, string | undefined> {
    const found: Record<string, string | undefined> = {};
    lockedContacts.forEach((entry, index) =>
      Object.assign(found, validateContact(`locked-${index}`, entry.phone, entry.email)),
    );
    if (mode === "task") Object.assign(found, validateSureties(sureties));
    if (!direct) return found;

    if (!petitionerId) found.petitioner = "Choose the petitioner.";
    if (!father.trim()) found.father = "Enter the father's name.";
    if (!bondType) found.bondType = "Choose the type of bail.";
    if (!amount.replace(/[^\d]/g, "")) found.amount = "Enter the bail amount.";
    if (bondType === "surety") {
      if (!/^[1-9]\d*$/.test(count.trim())) found.count = "Enter a whole number, 1 or more.";
      Object.assign(found, validateSureties(sureties));
    }
    return found;
  }

  function generate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.values(found).some(Boolean)) {
      focusFirstInvalid(formRef.current);
      return;
    }
    setView("generated");
  }

  function returnFocusToGenerate() {
    document
      .querySelector<HTMLElement>(`button[form="${CSS.escape(formId)}"]`)
      ?.focus();
  }

  const description = pick(
    mode === "task" ? bondCopy.taskBody : mode === "edit" ? bondCopy.editBody : bondCopy.directBody,
    "en",
  );

  return (
    <>
      {/*
        The Raise application form dialog: fixed header naming the ask and the
        case, a scrolling body of fields, a sunken footer holding the two ways
        out.
      */}
      <Dialog
        open={open && view === "form"}
        onOpenChange={(next) => {
          if (!next) requestClose();
        }}
      >
        <FlowDialogContent
          ownBack
          className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader className="shrink-0 border-b border-hairline px-6 py-4 pr-12 text-left">
            <DialogTitle className="text-title-s font-semibold text-balance">
              {mode === "edit" ? "Edit bail bond" : "Bail bond"}
            </DialogTitle>
            <DialogDescription className="text-pretty">{description}</DialogDescription>
            {/* Where the application shows its summons line: the terms are fixed. */}
            {direct ? null : (
              <p className="text-body-compact text-pretty text-muted-foreground">
                {pick(bondCopy.termsNote, "en")}
              </p>
            )}
            <p className="text-caption text-muted-foreground">
              <Identifier value={accessCase.caseNumber} label="case number" />
              <span aria-hidden> · </span>
              {accessCase.title}
            </p>
          </DialogHeader>

          <form
            id={formId}
            ref={formRef}
            noValidate
            onSubmit={generate}
            className="min-h-0 flex-1 overflow-y-auto px-6 py-6"
          >
            <div className="flex flex-col gap-6">
              {direct ? (
                <>
                  <SelectField
                    label="Petitioner"
                    value={petitionerId}
                    options={BAIL_PETITIONERS.map((entry) => ({
                      value: entry.id,
                      label: entry.name,
                    }))}
                    placeholder="Choose the litigant"
                    error={errors.petitioner}
                    onChange={choosePetitioner}
                  />
                  <TextField
                    label="Petitioner's father's name"
                    value={father}
                    prefilled={fatherPrefilled}
                    error={errors.father}
                    onChange={(value) => {
                      setFather(value);
                      setFatherPrefilled(false);
                      touch("father");
                    }}
                  />
                  <SelectField
                    label="Type of bail"
                    value={bondType}
                    options={BOND_TYPES}
                    placeholder="Choose surety or personal bond"
                    error={errors.bondType}
                    onChange={(value) => {
                      setBondType(value as "surety" | "personal");
                      touch("bondType");
                    }}
                  />
                  {bondType ? (
                    <TextField
                      label="Bail amount (Rs.)"
                      value={amount}
                      inputMode="numeric"
                      error={errors.amount}
                      onChange={(value) => {
                        setAmount(value.replace(/[^\d,]/g, ""));
                        touch("amount");
                      }}
                    />
                  ) : null}
                  {personal ? (
                    <Banner variant="info">{pick(bondCopy.typePersonalNote, "en")}</Banner>
                  ) : null}
                  {bondType === "surety" ? (
                    <TextField
                      label="Number of sureties"
                      value={count}
                      inputMode="numeric"
                      error={errors.count}
                      onChange={(value) => {
                        const next = value.replace(/\D/g, "").slice(0, 2);
                        setCount(next);
                        setSureties((current) => resizeSureties(current, next));
                        touch("count");
                      }}
                    />
                  ) : null}
                </>
              ) : (
                <>
                  {/* Set by the magistrate: grey, read-only, never the
                      yellow "we filled this, change it" tint. */}
                  <div className="grid gap-6 md:grid-cols-2">
                    <PrefilledField label="Petitioner" value={BOND_LITIGANT.name} />
                    <PrefilledField
                      label="Petitioner's father's name"
                      value={BOND_LITIGANT.father}
                    />
                    <PrefilledField label="Type of bail" value="Surety" />
                    <PrefilledField label="Bail amount (Rs.)" value={BOND_AMOUNT} />
                    <PrefilledField
                      label="Number of sureties"
                      value={String(BOND_REQUIRED_SURETIES)}
                    />
                  </div>
                  {mode === "task" && missingCount > 0 ? (
                    <Banner variant="info">
                      {fillCopy(bondCopy.addMoreNote, "en", {
                        n: String(BOND_REQUIRED_SURETIES),
                        k: String(missingCount),
                      })}
                    </Banner>
                  ) : null}
                  {lockedSureties.map((surety, index) => (
                    <RowWell key={surety.name} legend={`Surety ${index + 1}`}>
                      <div className="grid gap-6 md:grid-cols-2">
                        <PrefilledField label="Surety name" value={surety.name} />
                        <PrefilledField
                          label="Father's / mother's name"
                          value={surety.father}
                        />
                        <TextField
                          label="Surety phone number"
                          value={lockedContacts[index]?.phone ?? ""}
                          inputMode="tel"
                          type="tel"
                          error={errors[`locked-${index}.phone`]}
                          onChange={(value) => {
                            setLockedContacts((current) =>
                              current.map((entry, i) =>
                                i === index ? { ...entry, phone: value } : entry,
                              ),
                            );
                            touch(`locked-${index}.phone`);
                          }}
                        />
                        <TextField
                          label="Surety email ID"
                          optional
                          value={lockedContacts[index]?.email ?? ""}
                          type="email"
                          error={errors[`locked-${index}.email`]}
                          onChange={(value) => {
                            setLockedContacts((current) =>
                              current.map((entry, i) =>
                                i === index ? { ...entry, email: value } : entry,
                              ),
                            );
                            touch(`locked-${index}.email`);
                          }}
                        />
                      </div>
                      <PrefilledField label="Surety address" value={surety.address} />
                    </RowWell>
                  ))}
                </>
              )}

              {/* Fresh sureties: the one the magistrate added in task mode,
                  every one in a direct surety bond. The bail application's
                  surety well, field for field. */}
              {mode === "task" || (direct && bondType === "surety")
                ? sureties.map((item, index) => (
                    <RowWell
                      key={item.id}
                      legend={`Surety ${lockedSureties.length + index + 1}`}
                    >
                      <div className="grid gap-6 md:grid-cols-2">
                        <TextField
                          label="Surety name"
                          value={item.fullName}
                          error={errors[`${item.id}.fullName`]}
                          onChange={(fullName) => updateSurety(item.id, { fullName })}
                        />
                        <TextField
                          label="Father's / mother's name"
                          value={item.parentName}
                          error={errors[`${item.id}.parentName`]}
                          onChange={(parentName) => updateSurety(item.id, { parentName })}
                        />
                        <TextField
                          label="Surety phone number"
                          value={item.phone}
                          inputMode="tel"
                          type="tel"
                          error={errors[`${item.id}.phone`]}
                          onChange={(value) => updateSurety(item.id, { phone: value })}
                        />
                        <TextField
                          label="Surety email ID"
                          optional
                          value={item.email}
                          type="email"
                          error={errors[`${item.id}.email`]}
                          onChange={(email) => updateSurety(item.id, { email })}
                        />
                      </div>
                      <AddressField
                        label="Surety address"
                        value={item.address}
                        error={errors[`${item.id}.address`]}
                        onChange={(address) => updateSurety(item.id, { address })}
                      />
                      <FileField
                        required
                        label="Surety ID proof"
                        files={item.identityProof}
                        error={errors[`${item.id}.identityProof`]}
                        onFilesChange={(identityProof) =>
                          updateSurety(item.id, { identityProof })
                        }
                        onErrorChange={(error) =>
                          setErrors((current) => ({
                            ...current,
                            [`${item.id}.identityProof`]: error,
                          }))
                        }
                      />
                      <FileField
                        required
                        label="Proof of solvency"
                        files={item.solvencyProof}
                        error={errors[`${item.id}.solvencyProof`]}
                        onFilesChange={(solvencyProof) =>
                          updateSurety(item.id, { solvencyProof })
                        }
                        onErrorChange={(error) =>
                          setErrors((current) => ({
                            ...current,
                            [`${item.id}.solvencyProof`]: error,
                          }))
                        }
                      />
                    </RowWell>
                  ))
                : null}
            </div>
          </form>

          <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-hairline bg-surface-sunken px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant="outline" onClick={requestClose}>
              Cancel
            </Button>
            <Button type="submit" form={formId}>
              Generate bail bond
            </Button>
          </footer>
        </FlowDialogContent>
      </Dialog>

      <GeneratedBondDialog
        open={open && view === "generated"}
        onOpenChange={(next) => {
          if (!next) setView("form");
        }}
        accessCase={accessCase}
        terms={terms}
        onAddSignature={() => setView("sign")}
        onReturnFocus={returnFocusToGenerate}
      />

      <BondSignatureDialog
        open={open && view === "sign"}
        edited={mode === "edit"}
        hasSureties={terms.sureties.length > 0}
        onBack={() => setView("generated")}
        onCancel={() => setView("form")}
        onSubmitted={(method) =>
          onSubmitted?.({
            caseNumber: accessCase.caseNumber,
            bondId: BOND_ID,
            method,
            edited: mode === "edit",
          })
        }
        onDone={close}
        onReturnFocus={returnFocusToGenerate}
      />

      <DiscardFilingDialog
        open={open && discardOpen}
        onOpenChange={setDiscardOpen}
        onDiscard={close}
        noun="bail bond"
      />
    </>
  );
}

type BondTerms = {
  petitioner: string;
  father: string;
  amount: string;
  personal: boolean;
  sureties: string[];
};

function downloadNotice() {
  notify.neutral(pick(bondCopy.downloadBondPrototype, "en"), { icon: DownloadIcon });
}

/**
 * What Generate bail bond produces, read before signing, in Generate
 * application's frame: the facts on the left, the bond as large as the
 * dialog allows on the right, Add signature in the sunken footer. Closing it
 * returns to the form.
 */
function GeneratedBondDialog({
  open,
  onOpenChange,
  accessCase,
  terms,
  onAddSignature,
  onReturnFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accessCase: AccessCase;
  terms: BondTerms;
  onAddSignature: () => void;
  onReturnFocus: () => void;
}) {
  // Day precision, so recomputing per render never changes the text.
  const generatedOn = formatCaseDate(new Date().toISOString());
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FlowDialogContent
        ownBack
        showCloseButton={false}
        className="flex h-[calc(100dvh---spacing(12))] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onReturnFocus();
        }}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-hairline py-3 pr-3 pl-6">
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-body-compact font-semibold text-pretty sm:truncate">
              Generated bail bond
            </DialogTitle>
            <DialogDescription className="sr-only">
              Check the generated bail bond before adding a signature.
            </DialogDescription>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Download"
                  onClick={downloadNotice}
                >
                  <DownloadIcon aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Download</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <DialogClose asChild>
            <Button type="button" variant="ghost" size="icon-sm">
              <XIcon aria-hidden />
              <span className="sr-only">Close</span>
            </Button>
          </DialogClose>
        </div>

        <div className="@container/record flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col @3xl/record:flex-row">
            <div className="flex max-h-72 shrink-0 flex-col overflow-y-auto border-b border-hairline p-4 @3xl/record:max-h-none @3xl/record:w-80 @3xl/record:border-r @3xl/record:border-b-0">
              <div className="flex flex-col divide-y divide-hairline">
                <FactGroup>
                  {/* The surety count rides on the filing line, so the facts
                      stay as tall as the application's and leave the bond its
                      room where the halves stack (tablets). */}
                  <Fact label="Filing">
                    {terms.personal
                      ? "Personal bond"
                      : `Surety bond · ${terms.sureties.length} ${
                          terms.sureties.length === 1 ? "surety" : "sureties"
                        }`}
                  </Fact>
                </FactGroup>
                <FactGroup columns={2}>
                  <Fact label="Case">
                    <Identifier value={accessCase.caseNumber} label="case number" />
                  </Fact>
                  <Fact label="Generated on">
                    <span className="tabular-nums">{generatedOn}</span>
                  </Fact>
                  <Fact label="Filed for">{terms.petitioner}</Fact>
                  <Fact label="Bail amount">
                    <span className="tabular-nums">{terms.amount}</span>
                  </Fact>
                </FactGroup>
              </div>
            </div>

            <ComposedDocumentViewer
              title="Bail bond"
              className="min-h-64 min-w-0 flex-1 rounded-none"
            >
              <GeneratedBondDocument
                accessCase={accessCase}
                terms={terms}
                generatedOn={generatedOn}
              />
            </ComposedDocumentViewer>
          </div>
        </div>

        <footer className="flex shrink-0 flex-col border-t border-hairline bg-surface-sunken px-6 py-4 sm:flex-row sm:justify-end">
          <Button type="button" className="w-full sm:w-auto" onClick={onAddSignature}>
            Add signature
          </Button>
        </footer>
      </FlowDialogContent>
    </Dialog>
  );
}

/**
 * Form No. 37 on the court's paper, as the generated application is set: the
 * heading, the case lines, the undertaking, the sureties' clause, the dated
 * line and the signature slots. Built from what was entered, so the bond
 * read here is the bond filed.
 */
function GeneratedBondDocument({
  accessCase,
  terms,
  generatedOn,
}: {
  accessCase: AccessCase;
  terms: BondTerms;
  generatedOn: string;
}) {
  const courtText = useCourtText();
  const signatories = [
    terms.petitioner,
    ...terms.sureties.map((name, index) => `${name} (Surety ${index + 1})`),
  ];
  return (
    <article className="flex flex-col gap-8 rounded-md bg-paper p-6 text-paper-foreground sm:p-8">
      <header className="flex flex-col gap-6 text-center">
        <p className="text-body font-semibold text-balance">
          {courtText(pick(bailDialog.draftCourtLine, "en"))}
        </p>
        <div className="flex flex-col gap-1">
          <p className="text-body font-semibold">
            Case No: <span className="tabular-nums">{accessCase.caseNumber}</span>
          </p>
          <p className="text-body font-semibold">In the matter of: {accessCase.title}</p>
          <p className="text-body font-semibold">
            Date: <span className="tabular-nums">{generatedOn}</span>
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-1 text-center">
        <p className="text-body-compact">{pick(bondCopy.formLine, "en")}</p>
        <h3 className="text-body font-semibold">{pick(bondCopy.bondDocTitle, "en")}</h3>
        <p className="text-body-compact italic">{pick(bondCopy.sectionLine, "en")}</p>
      </div>

      <div className="flex flex-col gap-4 text-body text-pretty">
        <p>
          {fillCopy(bondCopy.bondBody1, "en", { name: terms.petitioner, father: terms.father })}{" "}
          {fillCopy(bondCopy.bondBody2, "en", { amount: terms.amount })}
        </p>
        {terms.sureties.length ? (
          <p>
            {fillCopy(bondCopy.bondSuretyClause, "en", {
              name: terms.petitioner,
              amount: terms.amount,
              sureties: terms.sureties.join(", "),
            })}
          </p>
        ) : null}
      </div>

      <footer className="flex flex-col gap-6">
        <p className="self-end text-body">{datedThis(generatedOn)}</p>
        <div className="grid gap-6 sm:grid-cols-2">
          {signatories.map((name) => (
            <div key={name} className="flex flex-col items-start gap-1">
              {/* Dashed = empty target; each slot fills as that person signs. */}
              <div className="mb-2 flex h-16 w-56 max-w-full items-center justify-center rounded-lg border border-dashed border-paper-border">
                <p className="text-body-compact text-paper-muted-foreground">
                  Signature pending
                </p>
              </div>
              <p className="text-body">{name}</p>
            </div>
          ))}
        </div>
      </footer>
    </article>
  );
}

type SignStep = "method" | "instrument" | "otp" | "dsc" | "upload" | "signed" | "done";

/**
 * Add signature's chain (`AddSignatureDialog`), in its steps and words: sign
 * digitally, then Aadhaar OTP or DSC; or upload a physically signed copy.
 * Signed is confirmed, then Submit bail bond files it. The bond ends on its
 * own confirmation: the bond ID and, once e-signed, the link the litigant
 * and sureties sign from.
 */
function BondSignatureDialog({
  open,
  edited,
  hasSureties,
  onBack,
  onCancel,
  onSubmitted,
  onDone,
  onReturnFocus,
}: {
  open: boolean;
  edited: boolean;
  /** A personal bond has only the litigant to sign after the advocate. */
  hasSureties: boolean;
  /** Back to the generated bond. */
  onBack: () => void;
  /** Closed midway: back to the form, as Add signature does. */
  onCancel: () => void;
  onSubmitted: (method: "esign" | "upload") => void;
  /** Closed after filing: the whole flow ends. */
  onDone: () => void;
  onReturnFocus: () => void;
}) {
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const [step, setStep] = React.useState<SignStep>("method");
  const [file, setFile] = React.useState<File | null>(null);
  const [fileError, setFileError] = React.useState<string | undefined>(undefined);
  const [otp, setOtp] = React.useState("");
  const [otpResent, setOtpResent] = React.useState(false);
  const [dscFound, setDscFound] = React.useState(false);
  const [signedWith, setSignedWith] = React.useState<"aadhaar" | "dsc" | "paper">("aadhaar");
  const [copied, setCopied] = React.useState(false);
  const method = signedWith === "paper" ? "upload" : "esign";

  /* The certificate utility takes a beat to answer, as in e-filing. */
  React.useEffect(() => {
    if (!open || step !== "dsc" || dscFound) return;
    const timer = setTimeout(() => setDscFound(true), 1100);
    return () => clearTimeout(timer);
  }, [open, step, dscFound]);

  React.useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  /* Swapping the step replaces the content; focus on the new title says so. */
  React.useEffect(() => {
    if (step !== "method") titleRef.current?.focus();
  }, [step]);

  /* On a phone, Back steps back as each footer's Back does. */
  const { phone } = useFlowWindow();
  useBackCloses(phone && open, () => {
    if (step === "method") onBack();
    else if (step === "instrument" || step === "upload" || step === "signed") setStep("method");
    else if (step === "otp" || step === "dsc") setStep("instrument");
    else finish();
  });

  function reset() {
    setStep("method");
    setFile(null);
    setFileError(undefined);
    setOtp("");
    setOtpResent(false);
    setDscFound(false);
    setCopied(false);
  }

  function finish() {
    reset();
    onDone();
  }

  function signWith(instrument: "aadhaar" | "dsc" | "paper") {
    setSignedWith(instrument);
    setStep("signed");
  }

  function backToMethods() {
    setFileError(undefined);
    setStep("method");
  }

  function handleOpenChange(next: boolean) {
    if (next) return;
    // Once filed, closing is finishing: the form is never shown again.
    if (step === "done") {
      finish();
      return;
    }
    reset();
    onCancel();
  }

  const stepTitle = {
    method: "How is this bail bond signed?",
    instrument: "Add your e-signature",
    otp: "Enter the OTP",
    dsc: "Sign with your DSC",
    upload: "Upload a signed copy",
    signed: "Your signature",
    done: "",
  }[step];

  const stepDescription = {
    method: "An unsigned bail bond cannot be submitted to the court.",
    instrument: "Either one is your own signature. Use whichever you have.",
    otp: "Sent to your Aadhaar-linked mobile.",
    dsc: "Your certificate has to be plugged in, with the signing utility running on this computer.",
    upload: pick(bondCopy.uploadBondHint, "en"),
    signed:
      method === "esign"
        ? hasSureties
          ? "Submitting sends the litigant and each surety a link to add their signatures."
          : "Submitting sends the litigant a link to add their signature."
        : "The signed bail bond is ready to file.",
    done: "",
  }[step];

  const FOOTER =
    "flex shrink-0 flex-col-reverse gap-2 border-t border-hairline bg-surface-sunken px-6 py-4 sm:flex-row sm:items-center sm:justify-between";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <FlowDialogContent
        ownBack
        className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onReturnFocus();
        }}
      >
        {step === "done" ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {/* The filing's outcome takes the window over (skill `feedback-states`). */}
            <OutcomeHeader
              compact
              titleFrom="dialog"
              focusTitle
              title={pick(edited ? bondCopy.doneTitleEdited : bondCopy.doneTitle, "en")}
              body={
                edited
                  ? pick(bondCopy.doneBodyEdited, "en")
                  : method === "upload"
                    ? pick(bondCopy.doneBodyUpload, "en")
                    : hasSureties
                      ? pick(bondCopy.doneBodyEsign, "en")
                      : "The litigant has been sent a link by SMS, and email, if given, to add their signature."
              }
            />
          <div className="flex flex-col gap-4 px-6 py-6">
            <OutcomeSummary>
            <DescriptionList>
              <DescriptionRow className="grid-cols-[1fr_auto] items-center border-hairline">
                <DescriptionTerm className="text-body-compact">Submission date</DescriptionTerm>
                <DescriptionDetails className="text-body-compact">
                  {formatCaseDate(new Date().toISOString())}
                </DescriptionDetails>
              </DescriptionRow>
              <DescriptionRow className="grid-cols-[1fr_auto] items-center border-hairline">
                <DescriptionTerm className="text-body-compact">Bond ID</DescriptionTerm>
                <DescriptionDetails className="flex items-center gap-2 text-body-compact font-medium">
                  <Identifier value={BOND_ID} label="bond number" />
                </DescriptionDetails>
              </DescriptionRow>
              <DescriptionRow className="grid-cols-[1fr_auto] items-center border-hairline">
                <DescriptionTerm className="text-body-compact">Status</DescriptionTerm>
                <DescriptionDetails>
                  <Badge variant="warning">
                    {pick(
                      method === "esign" ? bondCopy.statusPendingSign : bondCopy.statusPendingReview,
                      "en",
                    )}
                  </Badge>
                </DescriptionDetails>
              </DescriptionRow>
            </DescriptionList>
            </OutcomeSummary>

            {method === "esign" ? (
              <div className="flex flex-col gap-2">
                <p className="text-body-compact font-medium">Signing link</p>
                <div className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 truncate font-mono text-body-compact">
                    {BOND_SIGN_LINK}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={copied ? "Copied" : "Copy signing link"}
                    onClick={() => {
                      void navigator.clipboard?.writeText(BOND_SIGN_LINK);
                      setCopied(true);
                    }}
                  >
                    {copied ? (
                      <CheckIcon className="text-success-ink" aria-hidden />
                    ) : (
                      <CopyIcon aria-hidden />
                    )}
                  </Button>
                </div>
                {/* The demo stand-in for the SMS/email the parties receive. Centred on a
                    phone, left with the facts from tablet up (owner, Oct 29). */}
                <Button asChild variant="outline" className="self-center sm:self-start">
                  <a href={BOND_SIGN_PATH} target="_blank" rel="noreferrer">
                    <ExternalLinkIcon data-icon="inline-start" aria-hidden />
                    {pick(bondCopy.openLinkDemo, "en")}
                  </a>
                </Button>
              </div>
            ) : null}
          </div>
          </div>
        ) : (
          <>
            <DialogHeader className="shrink-0 gap-1.5 border-b border-hairline px-6 py-4 pr-12 text-left">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle
                  ref={titleRef}
                  tabIndex={-1}
                  className="text-body font-semibold text-balance outline-none"
                >
                  {stepTitle}
                </DialogTitle>
                {step === "signed" ? <Badge variant="success">Signed</Badge> : null}
              </div>
              <DialogDescription>{stepDescription}</DialogDescription>
            </DialogHeader>

            <div
              className={cn(
                "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 py-6",
                (step === "method" || step === "instrument") &&
                  "gap-4 bg-muted dark:bg-background",
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
                    You sign the bail bond with your DSC or Aadhaar e-sign.
                    {hasSureties
                      ? " The litigant and sureties then sign from a link."
                      : " The litigant then signs from a link."}
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
                  id="bail-bond-esign-otp"
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
                      Signed bail bond
                    </FieldLabel>
                    <UploadedDocField
                      label="Signed bail bond"
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
                  <p className="flex flex-wrap items-center gap-1 text-body-compact">
                    Need the unsigned bail bond to sign on paper?
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto p-0 underline"
                      onClick={downloadNotice}
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
                      : "Signed copy added to this bail bond."}
                </StatusLine>
              ) : null}
            </div>
          </>
        )}

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
            <Button type="button" variant="outline" onClick={backToMethods}>
              Back
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!file) {
                  setFileError("Upload the signed bail bond to continue.");
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
            <Button
              type="button"
              onClick={() => {
                setStep("done");
                onSubmitted(method);
              }}
            >
              {pick(bondCopy.submitBond, "en")}
            </Button>
          </footer>
        ) : null}

        {step === "done" ? (
          <footer className={FOOTER}>
            <Button type="button" variant="outline" onClick={downloadNotice}>
              <DownloadIcon data-icon="inline-start" aria-hidden />
              Download bail bond
            </Button>
            <Button type="button" onClick={finish}>
              Done
            </Button>
          </footer>
        ) : null}
      </FlowDialogContent>
    </Dialog>
  );
}
