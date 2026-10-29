"use client";

import * as React from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  PenLineIcon,
} from "lucide-react";
import { OutcomeHeader, StatusLine } from "@/components/feedback";

import { ChromeDialogContent } from "@/components/chrome/app-chrome";
import { FlowDialogContent } from "@/components/chrome/flow-dialog";
import { useBackCloses, useFlowWindow } from "@/components/chrome/flow-window";

import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DescriptionList,
  DescriptionRow,
  DescriptionTerm,
  DescriptionDetails,
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UploadedDocField } from "@/components/filing/bail-application-dialog";
import { BondDocument } from "@/components/filing/bond-document";
import { pick, type Locale } from "@/lib/onboarding/content";
import { joinDialog } from "@/lib/join/content";
import type { AccessCase } from "@/lib/access/content";
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
import { ADVOCATE_PROFILE_NAME } from "@/lib/advocate/content";
import { cn } from "@/lib/utils";
import { Identifier } from "@/components/chrome/identifier";

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
 * Stages: details → review (generated Form 37) → sign → submitted. Signing by
 * Aadhaar e-sign sends the litigant and sureties their own signing links; a
 * physically-signed upload carries everyone's signature already and goes
 * straight to court review.
 */

export type BondMode = "task" | "direct" | "edit";

type Stage = "details" | "review" | "sign" | "done";

export type BailBondResult = {
  caseNumber: string;
  bondId: string;
  method: "esign" | "upload";
  edited: boolean;
};

type SuretyDraft = {
  id: number;
  name: string;
  father: string;
  phone: string;
  email: string;
  address1: string;
  city: string;
  pincode: string;
  district: string;
  state: string;
  idProof: File | null;
  solvency: File | null;
};

let draftSeq = 0;
function blankDraft(): SuretyDraft {
  draftSeq += 1;
  return {
    id: draftSeq,
    name: "",
    father: "",
    phone: "",
    email: "",
    address1: "",
    city: "",
    pincode: "",
    district: "",
    state: "",
    idProof: null,
    solvency: null,
  };
}

function draftComplete(draft: SuretyDraft) {
  return (
    draft.name.trim() !== "" &&
    draft.father.trim() !== "" &&
    draft.phone.length === 10 &&
    draft.address1.trim() !== "" &&
    draft.city.trim() !== "" &&
    draft.pincode.length === 6 &&
    draft.district.trim() !== "" &&
    draft.state.trim() !== "" &&
    draft.idProof !== null &&
    draft.solvency !== null
  );
}

/** A magistrate-approved surety: collapsed to a header row, expandable for
 *  the record, with only the contact details open for correction. */
function LockedSurety({
  index,
  surety,
  phone,
  email,
  onContactChange,
  invalid,
  locale,
}: {
  index: number;
  surety: BondSurety;
  phone: string;
  email: string;
  onContactChange: (patch: { phone?: string; email?: string }) => void;
  invalid: boolean;
  locale: Locale;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-lg bg-surface-sunken"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex min-h-12 w-full items-center gap-3 rounded-lg px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="text-body-compact font-semibold">
              {fillCopy(bondCopy.roleSurety, locale, { n: String(index + 1) })} · {surety.name}
            </p>
            <p className="text-caption text-muted-foreground">
              {pick(bondCopy.fromApplication, locale)}
            </p>
          </div>
          <ChevronDownIcon
            aria-hidden
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
          <span className="sr-only">
            {pick(open ? bondCopy.hideDetails : bondCopy.showDetails, locale)}
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-5 px-4 pb-4">
        <DescriptionList>
          <DescriptionRow className="border-hairline">
            <DescriptionTerm>{pick(bailDialog.suretyFatherLabel, locale)}</DescriptionTerm>
            <DescriptionDetails>{surety.father}</DescriptionDetails>
          </DescriptionRow>
          <DescriptionRow className="border-hairline">
            <DescriptionTerm>{pick(bondCopy.addressLabel, locale)}</DescriptionTerm>
            <DescriptionDetails>{surety.address}</DescriptionDetails>
          </DescriptionRow>
        </DescriptionList>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field data-invalid={invalid && phone.length !== 10}>
            <FieldLabel htmlFor={`bond-locked-${index}-phone`}>
              {pick(bailDialog.phoneLabel, locale)}
            </FieldLabel>
            <Input
              id={`bond-locked-${index}-phone`}
              type="tel"
              inputMode="numeric"
              autoComplete="off"
              value={phone}
              onChange={(event) =>
                onContactChange({ phone: event.target.value.replace(/\D/g, "").slice(0, 10) })
              }
            />
            <FieldError>
              {invalid && phone.length !== 10 ? pick(bailDialog.phoneError, locale) : null}
            </FieldError>
          </Field>
          <Field>
            <FieldLabel htmlFor={`bond-locked-${index}-email`}>
              {pick(bailDialog.emailLabel, locale)}{" "}
              <span className="font-normal text-muted-foreground">
                ({pick(bailDialog.optional, locale)})
              </span>
            </FieldLabel>
            <Input
              id={`bond-locked-${index}-email`}
              type="email"
              autoComplete="off"
              value={email}
              onChange={(event) => onContactChange({ email: event.target.value })}
            />
          </Field>
        </div>
        <p className="text-caption text-pretty text-muted-foreground">
          {pick(bondCopy.lockedSuretyNote, locale)}
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function BailBondDialog({
  open,
  onOpenChange,
  accessCase,
  locale,
  mode,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accessCase: AccessCase;
  locale: Locale;
  mode: BondMode;
  onSubmitted?: (result: BailBondResult) => void;
}) {
  const [stage, setStage] = React.useState<Stage>("details");

  // Direct-mode fields; in task/edit mode the magistrate's terms stand in.
  const [petitionerId, setPetitionerId] = React.useState("");
  const [father, setFather] = React.useState("");
  const [fatherPrefilled, setFatherPrefilled] = React.useState(false);
  const [amount, setAmount] = React.useState("");
  const [bailType, setBailType] = React.useState<"" | "surety" | "personal">("");
  const [count, setCount] = React.useState("2");

  const lockedSureties: BondSurety[] =
    mode === "edit" ? [...BOND_SURETIES, BOND_THIRD_SURETY] : mode === "task" ? BOND_SURETIES : [];
  const [lockedContacts, setLockedContacts] = React.useState(() =>
    lockedSureties.map((entry) => ({ phone: entry.phone, email: entry.email })),
  );

  const missingCount =
    mode === "task" ? Math.max(0, BOND_REQUIRED_SURETIES - BOND_SURETIES.length) : 0;
  const [drafts, setDrafts] = React.useState<SuretyDraft[]>(() =>
    mode === "task" ? Array.from({ length: missingCount }, blankDraft) : [blankDraft(), blankDraft()],
  );
  const [detailsTouched, setDetailsTouched] = React.useState(false);

  const [generating, setGenerating] = React.useState(false);
  const generateTimerRef = React.useRef<number | null>(null);
  const [reviewFullscreen, setReviewFullscreen] = React.useState(false);
  const [downloadNotice, setDownloadNotice] = React.useState(false);

  const [signTab, setSignTab] = React.useState<"esign" | "upload">("esign");
  const [signedFile, setSignedFile] = React.useState<File | null>(null);
  const [esigned, setEsigned] = React.useState(false);
  const [signTouched, setSignTouched] = React.useState(false);
  const [signDownloadNotice, setSignDownloadNotice] = React.useState(false);

  const [method, setMethod] = React.useState<"esign" | "upload">("esign");
  const [copied, setCopied] = React.useState(false);
  const copyTimerRef = React.useRef<number | null>(null);

  const signed = esigned || signedFile !== null;
  const personal = mode === "direct" && bailType === "personal";
  const countValid = /^[1-9]\d*$/.test(count.trim());
  const countN = countValid ? Number.parseInt(count.trim(), 10) : 0;

  const petitionerName =
    mode === "direct"
      ? BAIL_PETITIONERS.find((entry) => entry.id === petitionerId)?.name ?? ""
      : BOND_LITIGANT.name;

  const suretyNames = personal
    ? []
    : [
        ...lockedSureties.map((entry) => entry.name),
        ...drafts.filter(draftComplete).map((entry) => entry.name.trim()),
      ].filter(Boolean);

  React.useEffect(
    () => () => {
      if (generateTimerRef.current !== null) window.clearTimeout(generateTimerRef.current);
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    },
    [],
  );

  // Each stage arrives scrolled to its top (the container otherwise keeps the
  // previous stage's offset).
  const bodyRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [stage]);

  function reset() {
    setStage("details");
    setPetitionerId("");
    setFather("");
    setFatherPrefilled(false);
    setAmount("");
    setBailType("");
    setCount("2");
    setLockedContacts(lockedSureties.map((entry) => ({ phone: entry.phone, email: entry.email })));
    setDrafts(
      mode === "task" ? Array.from({ length: missingCount }, blankDraft) : [blankDraft(), blankDraft()],
    );
    setDetailsTouched(false);
    setGenerating(false);
    if (generateTimerRef.current !== null) window.clearTimeout(generateTimerRef.current);
    generateTimerRef.current = null;
    setReviewFullscreen(false);
    setDownloadNotice(false);
    setSignTab("esign");
    setSignedFile(null);
    setEsigned(false);
    setSignTouched(false);
    setSignDownloadNotice(false);
    setCopied(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  /* A window on a phone, with the phone's Back working as the footer does:
     the previous step, or out from the first one. See the bail application. */
  const { phone } = useFlowWindow();
  useBackCloses(phone && open, () => {
    if (reviewFullscreen) setReviewFullscreen(false);
    else if (stage === "review") setStage("details");
    else if (stage === "sign") setStage("review");
    else handleOpenChange(false);
  });

  function choosePetitioner(id: string) {
    setPetitionerId(id);
    const entry = BAIL_PETITIONERS.find((option) => option.id === id);
    if (entry && (father.trim() === "" || fatherPrefilled)) {
      setFather(entry.father);
      setFatherPrefilled(true);
    }
    setDetailsTouched(false);
  }

  function updateDraft(id: number, patch: Partial<SuretyDraft>) {
    setDrafts((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    );
    setDetailsTouched(false);
  }

  // Direct mode keeps the surety forms in step with the asked-for count.
  function updateCount(next: string) {
    const clean = next.replace(/\D/g, "");
    setCount(clean);
    const n = /^[1-9]\d*$/.test(clean) ? Number.parseInt(clean, 10) : 0;
    setDrafts((current) => {
      if (current.length > n) return current.slice(0, n);
      const grown = [...current];
      while (grown.length < n) grown.push(blankDraft());
      return grown;
    });
    setDetailsTouched(false);
  }

  function startGenerate() {
    setGenerating(true);
    setStage("review");
    generateTimerRef.current = window.setTimeout(() => setGenerating(false), 1400);
  }

  function submitDetails(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDetailsTouched(true);
    const contactsValid = lockedContacts.every((entry) => entry.phone.length === 10);
    if (mode === "direct") {
      if (!petitionerId || !father.trim() || !amount.trim() || !bailType) return;
      if (!personal && (!countValid || !drafts.every(draftComplete))) return;
    } else if (mode === "task") {
      if (!contactsValid || !drafts.every(draftComplete)) return;
    } else if (!contactsValid) {
      return;
    }
    setDetailsTouched(false);
    startGenerate();
  }

  function submitSign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSignTouched(true);
    if (!signed) return;
    setSignTouched(false);
    const usedMethod = esigned ? "esign" : "upload";
    setMethod(usedMethod);
    setStage("done");
    onSubmitted?.({
      caseNumber: accessCase.caseNumber,
      bondId: BOND_ID,
      method: usedMethod,
      edited: mode === "edit",
    });
  }

  function copySignLink() {
    void navigator.clipboard?.writeText(BOND_SIGN_LINK);
    setCopied(true);
    if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    copyTimerRef.current = window.setTimeout(() => setCopied(false), 2000);
  }

  const displayAmount = mode === "direct" ? (amount.trim() ? `₹${amount.trim()}` : "—") : BOND_AMOUNT;
  const displayType = personal
    ? pick(bondCopy.typePersonal, locale)
    : pick(bondCopy.typeSurety, locale);
  const displayCount = mode === "direct" ? (personal ? 0 : countN) : BOND_REQUIRED_SURETIES;

  const headerCopy: { title: string; body: string } =
    stage === "details"
      ? {
          title: pick(bondCopy.title, locale),
          body: pick(
            mode === "task"
              ? bondCopy.taskBody
              : mode === "edit"
                ? bondCopy.editBody
                : bondCopy.directBody,
            locale,
          ),
        }
      : stage === "review"
        ? { title: pick(bondCopy.reviewTitle, locale), body: pick(bondCopy.reviewBody, locale) }
        : { title: pick(bailDialog.signTitle, locale), body: pick(bondCopy.signBody, locale) };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <FlowDialogContent
        ownBack
        lang={locale}
        className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
        onInteractOutside={(event) => event.preventDefault()}
      >
        {/* The bond's outcome takes over the top of the window (skill `feedback-states`). */}
        {stage === "done" ? (
          <OutcomeHeader
            titleFrom="dialog"
            focusTitle
            title={pick(mode === "edit" ? bondCopy.doneTitleEdited : bondCopy.doneTitle, locale)}
            body={pick(
              mode === "edit"
                ? bondCopy.doneBodyEdited
                : method === "esign"
                  ? bondCopy.doneBodyEsign
                  : bondCopy.doneBodyUpload,
              locale,
            )}
          />
        ) : (
          <DialogHeader className="shrink-0 border-b border-hairline px-6 py-5 pr-14 text-left">
            <DialogTitle className="text-title-s font-semibold text-balance">
              {headerCopy.title}
            </DialogTitle>
            <DialogDescription className="text-pretty">{headerCopy.body}</DialogDescription>
            <p className="text-caption text-muted-foreground">
              <Identifier value={accessCase.caseNumber} label="case number" />
              <span aria-hidden> · </span>
              {accessCase.title}
            </p>
          </DialogHeader>
        )}

        <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {/* ------------------------------------------------------ details */}
          {stage === "details" ? (
            <form id="bond-details" noValidate className="flex flex-col gap-6" onSubmit={submitDetails}>
              {mode !== "direct" ? (
                <>
                  {/* The magistrate's terms are the one thing this screen must
                      make unmistakable — a well, not editable controls. */}
                  <div className="flex flex-col gap-3 rounded-lg bg-surface-sunken p-4">
                    <p className="text-caption font-semibold text-muted-foreground">
                      {pick(bondCopy.termsHeading, locale)}
                    </p>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                      <div className="flex flex-col gap-0.5">
                        <p className="text-caption text-muted-foreground">
                          {pick(bondCopy.amountLabel, locale)}
                        </p>
                        <p className="text-body font-semibold tabular-nums">{BOND_AMOUNT}</p>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <p className="text-caption text-muted-foreground">
                          {pick(bondCopy.typeLabel, locale)}
                        </p>
                        <p className="text-body font-semibold">{pick(bondCopy.typeSurety, locale)}</p>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <p className="text-caption text-muted-foreground">
                          {pick(bondCopy.suretiesRequiredLabel, locale)}
                        </p>
                        <p className="text-body font-semibold tabular-nums">
                          {BOND_REQUIRED_SURETIES}
                        </p>
                      </div>
                    </div>
                    <p className="text-caption text-pretty text-muted-foreground">
                      {pick(bondCopy.termsNote, locale)}
                    </p>
                  </div>

                  <DescriptionList>
                    <DescriptionRow className="border-hairline">
                      <DescriptionTerm>{pick(bailDialog.petitionerLabel, locale)}</DescriptionTerm>
                      <DescriptionDetails>{BOND_LITIGANT.name}</DescriptionDetails>
                    </DescriptionRow>
                    <DescriptionRow className="border-hairline">
                      <DescriptionTerm>{pick(bailDialog.fatherLabel, locale)}</DescriptionTerm>
                      <DescriptionDetails>{BOND_LITIGANT.father}</DescriptionDetails>
                    </DescriptionRow>
                  </DescriptionList>

                  {mode === "task" && missingCount > 0 ? (
                    <Banner variant="info">
                      {fillCopy(bondCopy.addMoreNote, locale, {
                        n: String(BOND_REQUIRED_SURETIES),
                        k: String(missingCount),
                      })}
                    </Banner>
                  ) : null}

                  {lockedSureties.map((surety, index) => (
                    <LockedSurety
                      key={surety.name}
                      index={index}
                      surety={surety}
                      phone={lockedContacts[index]?.phone ?? ""}
                      email={lockedContacts[index]?.email ?? ""}
                      onContactChange={(patch) => {
                        setLockedContacts((current) =>
                          current.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
                        );
                        setDetailsTouched(false);
                      }}
                      invalid={detailsTouched}
                      locale={locale}
                    />
                  ))}
                </>
              ) : (
                <>
                  <Field data-invalid={detailsTouched && !petitionerId}>
                    <FieldLabel>{pick(bailDialog.petitionerLabel, locale)}</FieldLabel>
                    <Select value={petitionerId} onValueChange={choosePetitioner}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={pick(bailDialog.petitionerPlaceholder, locale)} />
                      </SelectTrigger>
                      <SelectContent>
                        {BAIL_PETITIONERS.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError>
                      {detailsTouched && !petitionerId
                        ? pick(bailDialog.petitionerError, locale)
                        : null}
                    </FieldError>
                  </Field>

                  <Field data-invalid={detailsTouched && !father.trim()}>
                    <FieldLabel htmlFor="bond-father">{pick(bailDialog.fatherLabel, locale)}</FieldLabel>
                    <Input
                      id="bond-father"
                      value={father}
                      prefilled={fatherPrefilled}
                      onChange={(event) => {
                        setFather(event.target.value);
                        setFatherPrefilled(false);
                        setDetailsTouched(false);
                      }}
                    />
                    <FieldError>
                      {detailsTouched && !father.trim() ? pick(bailDialog.fatherError, locale) : null}
                    </FieldError>
                  </Field>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <Field data-invalid={detailsTouched && !amount.trim()}>
                      <FieldLabel htmlFor="bond-amount">{pick(bondCopy.amountLabel, locale)}</FieldLabel>
                      <Input
                        id="bond-amount"
                        inputMode="numeric"
                        value={amount}
                        onChange={(event) => {
                          setAmount(event.target.value.replace(/[^\d,]/g, ""));
                          setDetailsTouched(false);
                        }}
                      />
                      <FieldError>
                        {detailsTouched && !amount.trim() ? pick(bondCopy.amountError, locale) : null}
                      </FieldError>
                    </Field>

                    <Field data-invalid={detailsTouched && !bailType}>
                      <FieldLabel>{pick(bondCopy.typeLabel, locale)}</FieldLabel>
                      <Select
                        value={bailType}
                        onValueChange={(value) => {
                          setBailType(value as "surety" | "personal");
                          setDetailsTouched(false);
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={pick(bailDialog.typePlaceholder, locale)} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="surety">{pick(bondCopy.typeSurety, locale)}</SelectItem>
                          <SelectItem value="personal">{pick(bondCopy.typePersonal, locale)}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FieldError>
                        {detailsTouched && !bailType ? pick(bailDialog.typeError, locale) : null}
                      </FieldError>
                    </Field>
                  </div>

                  {personal ? (
                    <Banner variant="info">{pick(bondCopy.typePersonalNote, locale)}</Banner>
                  ) : bailType === "surety" ? (
                    <Field data-invalid={detailsTouched && !countValid}>
                      <FieldLabel htmlFor="bond-count">
                        {pick(bondCopy.suretiesRequiredLabel, locale)}
                      </FieldLabel>
                      <Input
                        id="bond-count"
                        inputMode="numeric"
                        className="sm:max-w-32"
                        value={count}
                        onChange={(event) => updateCount(event.target.value)}
                      />
                      <FieldError>
                        {detailsTouched && !countValid
                          ? pick(bondCopy.suretiesRequiredError, locale)
                          : null}
                      </FieldError>
                    </Field>
                  ) : null}
                </>
              )}

              {/* Fresh surety forms — the missing one in task mode, all of
                  them in direct surety mode. */}
              {(mode === "task" || (mode === "direct" && bailType === "surety")) &&
                drafts.map((draft, index) => {
                  const n = String(lockedSureties.length + index + 1);
                  const showInvalid = detailsTouched;
                  return (
                    <fieldset
                      key={draft.id}
                      className="flex min-w-0 flex-col gap-5 rounded-lg bg-surface-sunken p-4"
                    >
                      <legend className="float-left text-body font-semibold">
                        {fillCopy(bailDialog.suretyTitle, locale, { n })}
                      </legend>

                      <Field data-invalid={showInvalid && !draft.name.trim()}>
                        <FieldLabel htmlFor={`bond-draft-${draft.id}-name`}>
                          {pick(bailDialog.fullNameLabel, locale)}
                        </FieldLabel>
                        <Input
                          id={`bond-draft-${draft.id}-name`}
                          value={draft.name}
                          onChange={(event) => updateDraft(draft.id, { name: event.target.value })}
                        />
                        <FieldError>
                          {showInvalid && !draft.name.trim()
                            ? pick(bailDialog.requiredError, locale)
                            : null}
                        </FieldError>
                      </Field>

                      <Field data-invalid={showInvalid && !draft.father.trim()}>
                        <FieldLabel htmlFor={`bond-draft-${draft.id}-father`}>
                          {pick(bailDialog.suretyFatherLabel, locale)}
                        </FieldLabel>
                        <Input
                          id={`bond-draft-${draft.id}-father`}
                          value={draft.father}
                          onChange={(event) => updateDraft(draft.id, { father: event.target.value })}
                        />
                        <FieldError>
                          {showInvalid && !draft.father.trim()
                            ? pick(bailDialog.requiredError, locale)
                            : null}
                        </FieldError>
                      </Field>

                      <div className="grid gap-5 sm:grid-cols-2">
                        <Field data-invalid={showInvalid && draft.phone.length !== 10}>
                          <FieldLabel htmlFor={`bond-draft-${draft.id}-phone`}>
                            {pick(bailDialog.phoneLabel, locale)}
                          </FieldLabel>
                          <Input
                            id={`bond-draft-${draft.id}-phone`}
                            type="tel"
                            inputMode="numeric"
                            autoComplete="off"
                            value={draft.phone}
                            onChange={(event) =>
                              updateDraft(draft.id, {
                                phone: event.target.value.replace(/\D/g, "").slice(0, 10),
                              })
                            }
                          />
                          <FieldError>
                            {showInvalid && draft.phone.length !== 10
                              ? pick(bailDialog.phoneError, locale)
                              : null}
                          </FieldError>
                        </Field>
                        <Field>
                          <FieldLabel htmlFor={`bond-draft-${draft.id}-email`}>
                            {pick(bailDialog.emailLabel, locale)}{" "}
                            <span className="font-normal text-muted-foreground">
                              ({pick(bailDialog.optional, locale)})
                            </span>
                          </FieldLabel>
                          <Input
                            id={`bond-draft-${draft.id}-email`}
                            type="email"
                            autoComplete="off"
                            value={draft.email}
                            onChange={(event) => updateDraft(draft.id, { email: event.target.value })}
                          />
                        </Field>
                      </div>

                      <div className="flex flex-col gap-5">
                        <p className="text-caption font-semibold text-muted-foreground">
                          {pick(bailDialog.addressHeading, locale)}
                        </p>
                        <Field data-invalid={showInvalid && !draft.address1.trim()}>
                          <FieldLabel htmlFor={`bond-draft-${draft.id}-address1`}>
                            {pick(bailDialog.address1Label, locale)}
                          </FieldLabel>
                          <Input
                            id={`bond-draft-${draft.id}-address1`}
                            value={draft.address1}
                            onChange={(event) =>
                              updateDraft(draft.id, { address1: event.target.value })
                            }
                          />
                          <FieldError>
                            {showInvalid && !draft.address1.trim()
                              ? pick(bailDialog.requiredError, locale)
                              : null}
                          </FieldError>
                        </Field>
                        <div className="grid gap-5 sm:grid-cols-2">
                          <Field data-invalid={showInvalid && !draft.city.trim()}>
                            <FieldLabel htmlFor={`bond-draft-${draft.id}-city`}>
                              {pick(bailDialog.cityLabel, locale)}
                            </FieldLabel>
                            <Input
                              id={`bond-draft-${draft.id}-city`}
                              value={draft.city}
                              onChange={(event) => updateDraft(draft.id, { city: event.target.value })}
                            />
                            <FieldError>
                              {showInvalid && !draft.city.trim()
                                ? pick(bailDialog.requiredError, locale)
                                : null}
                            </FieldError>
                          </Field>
                          <Field data-invalid={showInvalid && draft.pincode.length !== 6}>
                            <FieldLabel htmlFor={`bond-draft-${draft.id}-pincode`}>
                              {pick(bailDialog.pincodeLabel, locale)}
                            </FieldLabel>
                            <Input
                              id={`bond-draft-${draft.id}-pincode`}
                              inputMode="numeric"
                              value={draft.pincode}
                              onChange={(event) =>
                                updateDraft(draft.id, {
                                  pincode: event.target.value.replace(/\D/g, "").slice(0, 6),
                                })
                              }
                            />
                            <FieldError>
                              {showInvalid && draft.pincode.length !== 6
                                ? pick(bailDialog.pincodeError, locale)
                                : null}
                            </FieldError>
                          </Field>
                        </div>
                        <div className="grid gap-5 sm:grid-cols-2">
                          <Field data-invalid={showInvalid && !draft.district.trim()}>
                            <FieldLabel htmlFor={`bond-draft-${draft.id}-district`}>
                              {pick(bailDialog.districtLabel, locale)}
                            </FieldLabel>
                            <Input
                              id={`bond-draft-${draft.id}-district`}
                              value={draft.district}
                              onChange={(event) =>
                                updateDraft(draft.id, { district: event.target.value })
                              }
                            />
                            <FieldError>
                              {showInvalid && !draft.district.trim()
                                ? pick(bailDialog.requiredError, locale)
                                : null}
                            </FieldError>
                          </Field>
                          <Field data-invalid={showInvalid && !draft.state.trim()}>
                            <FieldLabel htmlFor={`bond-draft-${draft.id}-state`}>
                              {pick(bailDialog.stateLabel, locale)}
                            </FieldLabel>
                            <Input
                              id={`bond-draft-${draft.id}-state`}
                              value={draft.state}
                              onChange={(event) => updateDraft(draft.id, { state: event.target.value })}
                            />
                            <FieldError>
                              {showInvalid && !draft.state.trim()
                                ? pick(bailDialog.requiredError, locale)
                                : null}
                            </FieldError>
                          </Field>
                        </div>
                      </div>

                      <Field data-invalid={showInvalid && !draft.idProof}>
                        <div className="flex flex-col gap-2">
                          <UploadedDocField
                            label={pick(bailDialog.idProofLabel, locale)}
                            required
                            file={draft.idProof}
                            onFileChange={(file) => updateDraft(draft.id, { idProof: file })}
                            locale={locale}
                          />
                          {!draft.idProof ? (
                            <FieldDescription>{pick(bailDialog.docHelp, locale)}</FieldDescription>
                          ) : null}
                        </div>
                        <FieldError>
                          {showInvalid && !draft.idProof ? pick(bailDialog.idProofError, locale) : null}
                        </FieldError>
                      </Field>

                      <Field data-invalid={showInvalid && !draft.solvency}>
                        <div className="flex flex-col gap-2">
                          <UploadedDocField
                            label={pick(bailDialog.solvencyLabel, locale)}
                            required
                            file={draft.solvency}
                            onFileChange={(file) => updateDraft(draft.id, { solvency: file })}
                            locale={locale}
                          />
                          {!draft.solvency ? (
                            <FieldDescription>{pick(bailDialog.solvencyHint, locale)}</FieldDescription>
                          ) : null}
                        </div>
                        <FieldError>
                          {showInvalid && !draft.solvency
                            ? pick(bailDialog.solvencyError, locale)
                            : null}
                        </FieldError>
                      </Field>
                    </fieldset>
                  );
                })}
            </form>
          ) : null}

          {/* ------------------------------------------------------- review */}
          {stage === "review" ? (
            generating ? (
              <div className="flex min-h-32 flex-col items-center justify-center gap-3 text-center">
                <Spinner className="size-6 text-primary" />
                <p className="text-body-compact font-medium">{pick(bondCopy.generatingBond, locale)}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                <DescriptionList>
                  <DescriptionRow className="border-hairline">
                    <DescriptionTerm>{pick(bondCopy.amountLabel, locale)}</DescriptionTerm>
                    <DescriptionDetails className="tabular-nums">{displayAmount}</DescriptionDetails>
                  </DescriptionRow>
                  <DescriptionRow className="border-hairline">
                    <DescriptionTerm>{pick(bondCopy.typeLabel, locale)}</DescriptionTerm>
                    <DescriptionDetails>{displayType}</DescriptionDetails>
                  </DescriptionRow>
                  <DescriptionRow className="border-hairline">
                    <DescriptionTerm>{pick(bailDialog.petitionerLabel, locale)}</DescriptionTerm>
                    <DescriptionDetails>{petitionerName}</DescriptionDetails>
                  </DescriptionRow>
                  <DescriptionRow className="border-hairline">
                    <DescriptionTerm>{pick(bailDialog.summarySureties, locale)}</DescriptionTerm>
                    <DescriptionDetails className="tabular-nums">
                      {displayCount
                        ? fillCopy(bailDialog.suretiesCount, locale, { count: String(displayCount) })
                        : pick(bailDialog.suretiesNone, locale)}
                    </DescriptionDetails>
                  </DescriptionRow>
                </DescriptionList>

                {downloadNotice ? (
                  <Banner variant="info">{pick(bondCopy.downloadBondPrototype, locale)}</Banner>
                ) : null}

                <BondDocument
                  accessCase={accessCase}
                  suretyNames={suretyNames}
                  locale={locale}
                  onExpand={() => setReviewFullscreen(true)}
                  onDownload={() => setDownloadNotice(true)}
                />

                <Dialog open={reviewFullscreen} onOpenChange={setReviewFullscreen}>
                  <ChromeDialogContent mobileSheet
                    lang={locale}
                    className="inset-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 sm:max-w-none"
                    onInteractOutside={(event) => event.preventDefault()}
                  >
                    <DialogHeader className="shrink-0 border-b border-hairline px-6 py-5 pr-14 text-left">
                      <DialogTitle className="text-title-s font-semibold text-balance">
                        {pick(bondCopy.reviewTitle, locale)}
                      </DialogTitle>
                      <DialogDescription className="text-pretty">
                        {pick(bondCopy.reviewBody, locale)}
                      </DialogDescription>
                    </DialogHeader>
                    <BondDocument
                      accessCase={accessCase}
                      suretyNames={suretyNames}
                      locale={locale}
                      expanded
                    />
                  </ChromeDialogContent>
                </Dialog>
              </div>
            )
          ) : null}

          {/* --------------------------------------------------------- sign */}
          {stage === "sign" ? (
            <form id="bond-sign" noValidate className="flex flex-col gap-5" onSubmit={submitSign}>
              <Field data-invalid={signTouched && !signed}>
                <Tabs
                  value={signTab}
                  onValueChange={(value) => {
                    setSignTab(value as "esign" | "upload");
                    setSignTouched(false);
                  }}
                >
                  <TabsList className="w-full border border-hairline bg-surface-sunken">
                    <TabsTrigger value="esign" className="flex-1">
                      {pick(bailDialog.tabEsign, locale)}
                    </TabsTrigger>
                    <TabsTrigger value="upload" className="flex-1">
                      {pick(bailDialog.tabUploadSigned, locale)}
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="esign" className="flex flex-col gap-4 pt-3">
                    {esigned ? (
                      <StatusLine tone="success">
                        {fillCopy(bailDialog.signedNote, locale, { name: ADVOCATE_PROFILE_NAME })}
                      </StatusLine>
                    ) : (
                      <Banner variant="info">{pick(bailDialog.esignNote, locale)}</Banner>
                    )}
                  </TabsContent>
                  <TabsContent value="upload" className="flex flex-col gap-4 pt-3">
                    {signedFile ? (
                      <StatusLine tone="success">
                        {fillCopy(bailDialog.signedNote, locale, { name: ADVOCATE_PROFILE_NAME })}
                      </StatusLine>
                    ) : (
                      <>
                        {/* This path carries every signature on paper — the
                            litigant's and the sureties' too, not just the
                            advocate's. */}
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <p className="text-body-compact font-medium text-pretty text-foreground">
                            {pick(bondCopy.uploadBondHint, locale)}
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            className="shrink-0"
                            data-icon="inline-start"
                            onClick={() => setSignDownloadNotice(true)}
                          >
                            <DownloadIcon aria-hidden />
                            {pick(bondCopy.downloadBond, locale)}
                          </Button>
                        </div>
                        {signDownloadNotice ? (
                          <Banner variant="info">
                            {pick(bondCopy.downloadBondPrototype, locale)}
                          </Banner>
                        ) : null}
                      </>
                    )}
                    <div className="flex flex-col gap-2">
                      <UploadedDocField
                        label={pick(bondCopy.signedBondLabel, locale)}
                        required
                        file={signedFile}
                        onFileChange={(file) => {
                          setSignedFile(file);
                          setSignTouched(false);
                        }}
                        locale={locale}
                      />
                      {!signedFile ? (
                        <FieldDescription>{pick(bailDialog.docHelp, locale)}</FieldDescription>
                      ) : null}
                    </div>
                  </TabsContent>
                </Tabs>
                <FieldError>
                  {signTouched && !signed ? pick(bailDialog.signError, locale) : null}
                </FieldError>
              </Field>
            </form>
          ) : null}

          {/* --------------------------------------------------------- done */}
          {stage === "done" ? (
            <div className="flex flex-col gap-5">
              <DescriptionList>
                <DescriptionRow className="items-center border-hairline">
                  <DescriptionTerm>{pick(bondCopy.bondIdLabel, locale)}</DescriptionTerm>
                  <DescriptionDetails>
                    <Identifier value={BOND_ID} label="bond number" />
                  </DescriptionDetails>
                </DescriptionRow>
                {method === "esign" ? (
                  <DescriptionRow className="items-center border-hairline">
                    <DescriptionTerm>{pick(bondCopy.signLinkLabel, locale)}</DescriptionTerm>
                    <DescriptionDetails className="flex min-w-0 items-center gap-2">
                      <span className="min-w-0 truncate font-mono text-body-compact">
                        {BOND_SIGN_LINK}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={pick(copied ? bondCopy.copiedLink : bondCopy.copyLink, locale)}
                        onClick={copySignLink}
                      >
                        {copied ? (
                          <CheckIcon className="text-success-ink" aria-hidden />
                        ) : (
                          <CopyIcon aria-hidden />
                        )}
                      </Button>
                    </DescriptionDetails>
                  </DescriptionRow>
                ) : null}
              </DescriptionList>

              {method === "esign" ? (
                /* A secondary act under the facts: centred on a phone, at the right edge
                   from tablet up, where the eye ends the record (owner, Oct 29). */
                <div className="flex flex-col items-center gap-1.5 text-center sm:items-end sm:text-right">
                  {/* The demo stand-in for the SMS/email the parties receive. */}
                  <Button asChild type="button" variant="outline" data-icon="inline-start">
                    <a href={BOND_SIGN_PATH} target="_blank" rel="noreferrer">
                      <ExternalLinkIcon aria-hidden />
                      {pick(bondCopy.openLinkDemo, locale)}
                    </a>
                  </Button>
                  <p className="text-caption text-muted-foreground">
                    {pick(bondCopy.openLinkDemoHint, locale)}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* ------------------------------------------------------------ footer */}
        <footer
          className={cn(
            "flex shrink-0 flex-col-reverse gap-2 border-t border-hairline px-6 py-4 sm:flex-row sm:items-center sm:justify-between",
            /* Under an outcome, the warm band every outcome dialog closes on. */
            stage === "done" && "bg-surface-sunken",
          )}
        >
          {stage === "details" ? (
            <>
              <span aria-hidden className="hidden sm:block" />
              <Button type="submit" form="bond-details" data-icon="inline-end">
                {pick(bondCopy.reviewBond, locale)}
                <ArrowRightIcon aria-hidden />
              </Button>
            </>
          ) : null}

          {stage === "review" ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={generating}
                data-icon="inline-start"
                onClick={() => setStage("details")}
              >
                <ArrowLeftIcon aria-hidden />
                {pick(joinDialog.back, locale)}
              </Button>
              <Button
                type="button"
                disabled={generating}
                data-icon="inline-end"
                onClick={() => setStage("sign")}
              >
                {pick(bondCopy.proceedToSign, locale)}
                <ArrowRightIcon aria-hidden />
              </Button>
            </>
          ) : null}

          {stage === "sign" ? (
            <>
              <Button
                type="button"
                variant="outline"
                data-icon="inline-start"
                onClick={() => {
                  setSignTouched(false);
                  setStage("review");
                }}
              >
                <ArrowLeftIcon aria-hidden />
                {pick(joinDialog.back, locale)}
              </Button>
              {signTab === "esign" && !esigned ? (
                <Button
                  type="button"
                  data-icon="inline-start"
                  onClick={() => {
                    // Prototype: the Aadhaar e-sign round trip succeeds.
                    setEsigned(true);
                    setSignTouched(false);
                  }}
                >
                  <PenLineIcon aria-hidden />
                  {pick(bailDialog.esignAction, locale)}
                </Button>
              ) : (
                <Button type="submit" form="bond-sign" disabled={!signed} data-icon="inline-end">
                  {pick(bondCopy.submitBond, locale)}
                  <ArrowRightIcon aria-hidden />
                </Button>
              )}
            </>
          ) : null}

          {stage === "done" ? (
            <>
              <span aria-hidden className="hidden sm:block" />
              <Button type="button" onClick={() => handleOpenChange(false)}>
                {pick(bailDialog.doneClose, locale)}
              </Button>
            </>
          ) : null}
        </footer>
      </FlowDialogContent>
    </Dialog>
  );
}
