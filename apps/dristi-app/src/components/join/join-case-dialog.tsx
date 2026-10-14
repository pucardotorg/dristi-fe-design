"use client";

import { SUMMONS_FACTS } from "@/lib/summons/content";
import * as React from "react";
import { useRouter } from "next/navigation";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ExternalLinkIcon,
  FileTextIcon,
  SearchIcon,
} from "lucide-react";

import { FlowDialogContent } from "@/components/chrome/flow-dialog";
import { JOIN_DEMO_CASE_ID } from "@/lib/cases/party-cases";
import { useStageFade } from "@/components/chrome/stage-fade";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DocumentSlot } from "@/components/ui/document-slot";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CaseDetails,
  CaseIdentity,
  JOIN_PANEL,
  hasAccusedAdvocate,
} from "@/components/join/case-details";
import { cn } from "@/lib/utils";
import { DownloadCaseFileButton } from "@/components/join/download-case-file-button";
import { JoinedCaseBail } from "@/components/join/joined-case-bail";
import {
  isValidMobile,
  PoaJoinFields,
  poaPartiesFor,
  type PoaSide,
} from "@/components/join/poa-join-fields";
import { pick, type Locale } from "@/lib/onboarding/content";
import {
  DEMO_JOIN_CASE,
  fill,
  joinDialog,
  summonsModal,
  type CaseParty,
  type JoinCase,
} from "@/lib/join/content";

/**
 * Post-login join-a-case dialog.
 *
 * Three entry modes, one flow:
 * · `summons` — the case and its access code come from the summons token. The dialog
 *   opens on the details stage as the auto-modal and the person types nothing.
 * · `manual` — opened from "Join an ongoing case": lookup, then the six-digit access
 *   code (JOIN-13), then details.
 * · `handoff` — an advocate account chose Litigant or PoA holder mid-way through the
 *   advocate dialog (JOIN-20). The case was found and its code verified there, so this
 *   opens on the identity stage with that choice already made.
 *
 * Complainants are linked at e-filing and never join, so this asks at most three
 * things: self or power of attorney, which party, and how you will appear. Join a Case
 * handover V1: no join needs approval — an accused, a party in person (with an
 * affidavit) and a PoA holder all get access when they finish.
 */

type Stage = "lookup" | "code" | "details" | "identity" | "done";

/** The flow's order: each step's drift follows it (forward from the right, back from the left). */
const STAGE_ORDER: readonly Stage[] = ["lookup", "code", "details", "identity", "done"];

export type JoinMode = "summons" | "manual" | "handoff";
export type JoinerKind = "self" | "poa" | "";
type Appearance = "hire" | "advocate" | "self" | "";

export type JoinResult = {
  joinCase: JoinCase;
  /** One party for an accused joining in person; one or more for a PoA holder. */
  parties: CaseParty[];
  kind: "self" | "poa";
  partyInPerson: boolean;
};

const CODE_LENGTH = 6;

function fileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** JOIN-23: the one accused, when there is only one; otherwise no pick. */
function soleAccusedId(joinCase: JoinCase | undefined) {
  return joinCase?.accused.length === 1 ? joinCase.accused[0].id : "";
}

/** JOIN-30: the one party on the PoA holder's side, when there is only one. */
function solePartyIds(joinCase: JoinCase, side: PoaSide) {
  const parties = poaPartiesFor(joinCase, side);
  return parties.length === 1 ? [parties[0].id] : [];
}

export function JoinCaseDialog({
  open,
  onOpenChange,
  mode,
  summonsCase,
  initialKind = "",
  locale,
  onJoined,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: JoinMode;
  /** The case already resolved — from the summons token, or handed over by the
   *  advocate dialog. Required in summons and handoff modes. */
  summonsCase?: JoinCase;
  /** Handoff only: the choice the person made in the advocate dialog. */
  initialKind?: JoinerKind;
  locale: Locale;
  onJoined: (result: JoinResult) => void;
}) {
  const initialStage: Stage =
    mode === "summons" ? "details" : mode === "handoff" ? "identity" : "lookup";
  /* Each step fades softly into the next (`useStageFade`), its content drifting a
     hint the way the person is going; the height changes while the window is clear,
     so nothing resizes in view (owner, Oct 6). */
  const {
    stage,
    setStage,
    resetStage,
    changed: stageChanged,
    panelStyle,
    sceneClassName,
  } = useStageFade<Stage>(initialStage, STAGE_ORDER);
  /* Focus follows the stage: the footer button just pressed is gone, so the
     title takes focus rather than the page. */
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  React.useEffect(() => {
    if (!stageChanged) return;
    const active = document.activeElement;
    if (!active || active === document.body || !active.isConnected) {
      titleRef.current?.focus();
    }
  }, [stage, stageChanged]);
  const [joinCase, setJoinCase] = React.useState<JoinCase | undefined>(summonsCase);

  const [code, setCode] = React.useState("");
  const [codeTouched, setCodeTouched] = React.useState(false);

  const [query, setQuery] = React.useState("");
  const [queryTouched, setQueryTouched] = React.useState(false);
  const [lookupMiss, setLookupMiss] = React.useState(false);

  const [kind, setKind] = React.useState<JoinerKind>(initialKind);
  const [partyId, setPartyId] = React.useState(() =>
    initialKind ? soleAccusedId(summonsCase) : "",
  );
  const [appearance, setAppearance] = React.useState<Appearance>("");
  const [identityTouched, setIdentityTouched] = React.useState(false);
  // PoA holder (§9b): summons are served on the accused, so that side is pre-selected
  // on summons entry (JOIN-63).
  const initialPoaSide: PoaSide = mode === "summons" ? "accused" : "";
  const [poaSide, setPoaSide] = React.useState<PoaSide>(initialPoaSide);
  const [poaPartyIds, setPoaPartyIds] = React.useState<string[]>(() =>
    initialKind === "poa" && summonsCase ? solePartyIds(summonsCase, initialPoaSide) : [],
  );
  const [poaFiles, setPoaFiles] = React.useState<Record<string, File | null>>({});
  const [poaPhones, setPoaPhones] = React.useState<Record<string, string>>({});
  const [pipFile, setPipFile] = React.useState<File | null>(null);
  const pipInputRef = React.useRef<HTMLInputElement>(null);

  const [doneNotice, setDoneNotice] = React.useState<"" | "advocate">("");
  const router = useRouter();
  /* File bail application opens the application form at Bail, in place of
     this window (the join is done; this window closes when the form does). */
  const [bailOpen, setBailOpen] = React.useState(false);
  const [downloadNotice, setDownloadNotice] = React.useState(false);

  const party = joinCase?.accused.find((entry) => entry.id === partyId);
  // A duplicate self-join is blocked by the party's own account (JOIN-24). A PoA join
  // is blocked per party, only by another PoA holder (JOIN-31) — see PoaJoinFields.
  const blocked = kind === "self" && Boolean(party?.hasJoined);
  const poaSelected = joinCase
    ? poaPartiesFor(joinCase, poaSide).filter((entry) => poaPartyIds.includes(entry.id))
    : [];
  const poaBlocked = poaSelected.some((entry) => entry.poaHolderJoined);
  // Parties not yet on the case need a number entered for them (JOIN-34).
  const poaNeedPhone = poaSelected.filter((entry) => !entry.hasJoined);
  const poaComplete =
    Boolean(poaSide) &&
    poaSelected.length > 0 &&
    !poaBlocked &&
    poaSelected.every((entry) => Boolean(poaFiles[entry.id])) &&
    poaNeedPhone.every((entry) => isValidMobile(poaPhones[entry.id]));
  // The accused side already has an advocate on record — when so, "Add advocate" is
  // never the success action, and party in person is not offered (JOIN-27): the
  // advocate's joining already linked the accused's account.
  const accusedAdvocateJoined = joinCase ? hasAccusedAdvocate(joinCase) : false;
  // Success-modal primary action, decided by how the party said they will appear.
  const doneAction: "bail" | "advocate" | "case" =
    appearance === "self"
      ? "bail"
      : appearance === "hire" && !accusedAdvocateJoined
        ? "advocate"
        : "case";

  function reset() {
    resetStage(initialStage);
    setJoinCase(summonsCase);
    setQuery("");
    setQueryTouched(false);
    setLookupMiss(false);
    setCode("");
    setCodeTouched(false);
    setKind(initialKind);
    setPartyId(initialKind ? soleAccusedId(summonsCase) : "");
    setAppearance("");
    setIdentityTouched(false);
    setPoaSide(initialPoaSide);
    setPoaPartyIds(
      initialKind === "poa" && summonsCase ? solePartyIds(summonsCase, initialPoaSide) : [],
    );
    setPoaFiles({});
    setPoaPhones({});
    setPipFile(null);
    setDoneNotice("");
    setDownloadNotice(false);
  }

  /* Partway through, the close asks first (owner, 2026-10-13), in this window's own
     header and footer — never a second modal. */
  const [leaving, setLeaving] = React.useState(false);
  const entered =
    stage === "code" || stage === "identity" || (stage === "details" && mode !== "summons");

  /* View case opens the joined case in Cases, as on the advocate side (owner,
     2026-10-13) — not a placeholder note. */
  function viewCase() {
    handleOpenChange(false);
    router.push(`/cases/${JOIN_DEMO_CASE_ID}`);
  }

  function handleOpenChange(next: boolean) {
    if (!next && entered && !leaving) {
      setLeaving(true);
      titleRef.current?.focus();
      return;
    }
    if (!next) {
      setLeaving(false);
      reset();
    }
    onOpenChange(next);
  }

  function submitLookup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQueryTouched(true);
    const trimmed = query.trim();
    if (trimmed.length < 4) {
      setLookupMiss(false);
      return;
    }
    // Prototype lookup: a plausible number resolves to the demo case; a number with
    // no digits exercises the not-in-CIS path (cases reach the system with a lag).
    if (!/\d/.test(trimmed)) {
      setLookupMiss(true);
      return;
    }
    setLookupMiss(false);
    setJoinCase(DEMO_JOIN_CASE);
    // The code gates the case details; the code stage shows only title, number and
    // court so the person can confirm it is the right case (JOIN-10/11).
    setStage("code");
  }

  function submitCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCodeTouched(true);
    if (code.length !== CODE_LENGTH) return;
    setStage("details");
  }

  function chooseKind(next: JoinerKind) {
    setKind(next);
    setIdentityTouched(false);
    setAppearance("");
    // JOIN-23/30: a single party is chosen for the person; the step still shows it.
    setPartyId(soleAccusedId(joinCase));
    setPoaPartyIds(joinCase ? solePartyIds(joinCase, poaSide) : []);
  }

  function choosePoaSide(next: PoaSide) {
    setPoaSide(next);
    setPoaPartyIds(joinCase ? solePartyIds(joinCase, next) : []);
    setIdentityTouched(false);
  }

  function submitIdentity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIdentityTouched(true);
    if (!joinCase || !kind) return;
    if (kind === "self") {
      if (!party || blocked || !appearance) return;
      if (appearance === "self" && !pipFile) return;
    }
    if (kind === "poa" && !poaComplete) return;
    setStage("done");
    onJoined({
      joinCase,
      parties: kind === "poa" ? poaSelected : party ? [party] : [],
      kind,
      partyInPerson: kind === "self" && appearance === "self",
    });
  }

  const isSummonsIntro = mode === "summons" && stage === "details";

  return (
    <>
    <Dialog open={open && !bailOpen} onOpenChange={handleOpenChange}>
      <FlowDialogContent
        lang={locale}
        rise
        sheet
        style={panelStyle}
        className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
        // A click outside never closes it (FlowDialogContent), which also keeps the PoA
        // party combobox's portalled list clickable. Escape closes the list first.
        onEscapeKeyDown={(event) => {
          if (document.querySelector('[data-slot="combobox-content"]')) event.preventDefault();
        }}
      >
        {/* The same header on every stage, the outcome included (owner, Oct 6):
            only the words change, so the outcome reads as this window settling. */}
        <DialogHeader className="shrink-0 gap-2 border-b border-hairline p-6 pr-16 text-left">
          <DialogTitle
            ref={titleRef}
            tabIndex={-1}
            className="text-title-s font-semibold text-balance outline-none"
          >
            {leaving ? (
              pick(joinDialog.leaveTitle, locale)
            ) : (
              <>
                {stage === "done"
                  ? pick(joinDialog.joinedTitle, locale)
                  : isSummonsIntro
                    ? pick(summonsModal.heading, locale)
                    : pick(joinDialog.title, locale)}
              </>
            )}
          </DialogTitle>
          <DialogDescription className="text-body-compact text-pretty text-muted-foreground">
            {leaving ? (
              pick(joinDialog.leaveBody, locale)
            ) : (
              <>
                {stage === "done"
                  ? fill(
                      kind === "poa" ? joinDialog.poaJoinedBody : joinDialog.joinedBody,
                      locale,
                      {
                        name:
                          kind === "poa"
                            ? poaSelected.map((entry) => entry.name).join(", ")
                            : (party?.name ?? ""),
                      },
                    )
                  : isSummonsIntro
                    ? pick(summonsModal.body, locale)
                    : stage === "lookup"
                      ? pick(joinDialog.lookupBody, locale)
                      : stage === "code"
                        ? pick(joinDialog.codeBody, locale)
                        : stage === "details"
                          ? pick(joinDialog.detailsBody, locale)
                          : pick(joinDialog.identityBody, locale)}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* The stage: warm canvas, white panels. It hugs each step's height, which
            changes while the window is faded out (`useStageFade`). */}
        <div
          className={cn(
            "relative flex min-h-0 flex-col overflow-hidden bg-muted dark:bg-background",
            "shrink",
          )}
        >
        <div
          key={stage}
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-y-auto",
            sceneClassName,
          )}
        >
        <div className="flex flex-col p-4 sm:p-6">
          {/* ------------------------------------------------------- lookup */}
          {stage === "lookup" ? (
            <form
              id="join-lookup"
              noValidate
              className={JOIN_PANEL}
              onSubmit={submitLookup}
            >
              <Field data-invalid={queryTouched && query.trim().length < 4}>
                <FieldLabel>{pick(joinDialog.lookupLabel, locale)}</FieldLabel>
                <Input
                  autoFocus
                  value={query}
                  placeholder={pick(joinDialog.lookupPlaceholder, locale)}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setQueryTouched(false);
                    setLookupMiss(false);
                  }}
                />
                <FieldError>
                  {queryTouched && query.trim().length < 4
                    ? pick(joinDialog.lookupError, locale)
                    : null}
                </FieldError>
              </Field>
              {lookupMiss ? (
                <Banner variant="warning" className="items-start">{pick(joinDialog.lookupMiss, locale)}</Banner>
              ) : null}
            </form>
          ) : null}

          {/* --------------------------------------------------- access code */}
          {stage === "code" && joinCase ? (
            <form id="join-code" noValidate className="flex flex-col gap-4" onSubmit={submitCode}>
              {/* Before the code: title, case number and court only — no amount
                  (JOIN-11). Everything deeper stays behind the code. */}
              <CaseIdentity
                joinCase={joinCase}
                locale={locale}
                lead={pick(joinDialog.codeCaseLead, locale)}
              />
              <Banner variant="info" className="items-start">{pick(joinDialog.codeNote, locale)}</Banner>
              <div className={JOIN_PANEL}>
              <Field data-invalid={codeTouched && code.length !== CODE_LENGTH}>
                <FieldLabel>{pick(joinDialog.codeLabel, locale)}</FieldLabel>
                <InputOTP
                  maxLength={CODE_LENGTH}
                  pattern={REGEXP_ONLY_DIGITS}
                  inputMode="numeric"
                  value={code}
                  onChange={(value) => {
                    setCode(value);
                    setCodeTouched(false);
                  }}
                >
                  <InputOTPGroup className="w-full">
                    {Array.from({ length: CODE_LENGTH }, (_, index) => (
                      <InputOTPSlot
                        key={index}
                        index={index}
                        className="h-12 w-auto flex-1 text-body font-semibold"
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
                <FieldError>
                  {codeTouched && code.length !== CODE_LENGTH
                    ? pick(joinDialog.codeError, locale)
                    : null}
                </FieldError>
              </Field>
              </div>
            </form>
          ) : null}

          {/* ------------------------------------------------------ details */}
          {stage === "details" && joinCase ? (
            <div className="flex flex-col gap-4">
              <CaseDetails joinCase={joinCase} locale={locale} />
              <Banner variant="info" className="items-start">{pick(joinDialog.acknowledgeNote, locale)}</Banner>
              {downloadNotice ? (
                <Banner variant="info" className="items-start">
                  {pick(joinDialog.downloadCaseFilePrototype, locale)}
                </Banner>
              ) : null}
            </div>
          ) : null}

          {/* ----------------------------------------------------- identity */}
          {stage === "identity" && joinCase ? (
            <form
              id="join-identity"
              noValidate
              className={cn(JOIN_PANEL, "gap-6")}
              onSubmit={submitIdentity}
            >
              <Field data-invalid={identityTouched && !kind}>
                <FieldLabel className="block w-full text-body font-semibold leading-snug">
                  {pick(joinDialog.whoLegend, locale)}
                </FieldLabel>
                <RadioGroup
                  value={kind}
                  onValueChange={(value) => chooseKind(value as JoinerKind)}
                  className="flex flex-col gap-1"
                >
                  <div className="flex min-h-10 items-center gap-2">
                    <RadioGroupItem value="self" id="join-kind-self" />
                    <Label htmlFor="join-kind-self">
                      {pick(joinDialog.whoSelf, locale)}
                    </Label>
                  </div>
                  <div className="flex min-h-10 items-center gap-2">
                    <RadioGroupItem value="poa" id="join-kind-poa" />
                    <Label htmlFor="join-kind-poa">
                      {pick(joinDialog.whoPoa, locale)}
                    </Label>
                  </div>
                </RadioGroup>
                <FieldError>
                  {identityTouched && !kind
                    ? pick(joinDialog.whichError, locale)
                    : null}
                </FieldError>
                <Accordion type="single" collapsible>
                  <AccordionItem value="accused-explain" className="border-b-0">
                    <AccordionTrigger className="py-2 text-caption text-muted-foreground">
                      {pick(joinDialog.accusedExplainTitle, locale)}
                    </AccordionTrigger>
                    <AccordionContent className="text-body-compact text-muted-foreground">
                      {pick(joinDialog.accusedExplainBody, locale)}
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="poa-explain" className="border-b-0">
                    <AccordionTrigger className="py-2 text-caption text-muted-foreground">
                      {pick(joinDialog.poaExplainTitle, locale)}
                    </AccordionTrigger>
                    <AccordionContent className="text-body-compact text-muted-foreground">
                      {pick(joinDialog.poaExplainBody, locale)}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </Field>

              {kind === "self" ? (
                <Field data-invalid={identityTouched && !partyId}>
                  <FieldLabel className="block w-full text-body font-semibold leading-snug">
                    {pick(joinDialog.whichSelfLabel, locale)}
                  </FieldLabel>
                  <Select
                    value={partyId}
                    onValueChange={(value) => {
                      setPartyId(value);
                      setIdentityTouched(false);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={pick(joinDialog.whichPlaceholder, locale)}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {joinCase.accused.map((entry) => (
                        <SelectItem key={entry.id} value={entry.id}>
                          {entry.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError>
                    {identityTouched && !partyId
                      ? pick(joinDialog.whichError, locale)
                      : null}
                  </FieldError>
                  {party && !blocked ? (
                    <FieldDescription>
                      {fill(joinDialog.mappingNote, locale, { name: party.name })}
                    </FieldDescription>
                  ) : null}
                </Field>
              ) : null}

              {party && blocked ? (
                <Banner variant="warning" className="items-start">
                  {fill(joinDialog.alreadyJoined, locale, { name: party.name })}
                </Banner>
              ) : null}

              {kind === "self" && party && !blocked ? (
                <Field data-invalid={identityTouched && !appearance} className="gap-4">
                  <FieldLabel className="block w-full text-body font-semibold leading-snug">
                    {pick(joinDialog.appearLegend, locale)}
                  </FieldLabel>
                  <RadioGroup
                    value={appearance}
                    onValueChange={(value) => {
                      setAppearance(value as Appearance);
                      setIdentityTouched(false);
                    }}
                    className="flex flex-col gap-3"
                  >
                    <div className="flex items-start gap-2">
                      <RadioGroupItem value="hire" id="join-appear-hire" className="mt-2.5" />
                      <div className="flex min-w-0 flex-col items-start gap-0.5">
                        <div className="flex min-h-10 items-center gap-1">
                          <Label htmlFor="join-appear-hire" className="text-left leading-snug">
                            {pick(joinDialog.appearHire, locale)}
                          </Label>
                          {/* Straight to free legal aid at the District Legal Services
                              Authority (owner, 2026-10-14), not a note about it. */}
                          <Button asChild variant="link" size="sm" className="h-auto px-1">
                            <a href={joinDialog.findAdvocateHref} target="_blank" rel="noreferrer">
                              {pick(joinDialog.openBarCouncil, locale)}
                              <span className="sr-only"> (opens in a new tab)</span>
                              <ExternalLinkIcon data-icon="inline-end" aria-hidden />
                            </a>
                          </Button>
                        </div>
                        <Label htmlFor="join-appear-hire" className="text-caption font-normal text-muted-foreground">
                          {pick(joinDialog.appearHireHint, locale)}
                        </Label>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <RadioGroupItem
                        value="advocate"
                        id="join-appear-advocate"
                        className="mt-2.5"
                      />
                      <Label
                        htmlFor="join-appear-advocate"
                        className="flex min-h-10 flex-col items-start justify-center gap-0.5 text-left leading-snug"
                      >
                        {pick(joinDialog.appearAdvocate, locale)}
                        <span className="text-caption font-normal text-muted-foreground">
                          {pick(joinDialog.appearAdvocateHint, locale)}
                        </span>
                      </Label>
                    </div>
                    {accusedAdvocateJoined ? null : (
                      <div className="flex items-start gap-2">
                        <RadioGroupItem
                          value="self"
                          id="join-appear-self"
                          className="mt-2.5"
                        />
                        <Label
                          htmlFor="join-appear-self"
                          className="flex min-h-10 flex-col items-start justify-center gap-0.5 text-left leading-snug"
                        >
                          {pick(joinDialog.appearSelf, locale)}
                          <span className="text-caption font-normal text-muted-foreground">
                            {pick(joinDialog.appearSelfHint, locale)}
                          </span>
                        </Label>
                      </div>
                    )}
                  </RadioGroup>
                  {accusedAdvocateJoined ? (
                    <FieldDescription>
                      {pick(joinDialog.appearSelfUnavailable, locale)}
                    </FieldDescription>
                  ) : null}
                  <FieldError>
                    {identityTouched && !appearance
                      ? pick(joinDialog.appearError, locale)
                      : null}
                  </FieldError>
                </Field>
              ) : null}

              {/* JOIN-27: a party in person uploads an affidavit; access is immediate. */}
              {kind === "self" && party && !blocked && appearance === "self" ? (
                <Field data-invalid={identityTouched && !pipFile}>
                  <FieldLabel>{pick(joinDialog.pipDocLabel, locale)}</FieldLabel>
                  <input
                    ref={pipInputRef}
                    type="file"
                    className="hidden"
                    tabIndex={-1}
                    aria-hidden="true"
                    accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        setPipFile(file);
                        setIdentityTouched(false);
                      }
                    }}
                  />
                  <DocumentSlot
                    status={pipFile ? "filled" : "empty"}
                    media="icon"
                    label={pick(joinDialog.pipDocLabel, locale)}
                    required
                    filename={pipFile?.name}
                    meta={pipFile ? fileSize(pipFile.size) : undefined}
                    thumbnail={<FileTextIcon className="size-5" aria-hidden />}
                    onChooseFile={() => pipInputRef.current?.click()}
                    copy={{
                      optional: locale === "ml" ? "നിർബന്ധമല്ല" : "Optional",
                      noFile:
                        locale === "ml"
                          ? "ഫയൽ തിരഞ്ഞെടുത്തിട്ടില്ല"
                          : "No file chosen yet",
                      chooseFile: locale === "ml" ? "ഫയൽ തിരഞ്ഞെടുക്കുക" : "Choose file",
                    }}
                  />
                  <FieldDescription>{pick(joinDialog.pipDocHelp, locale)}</FieldDescription>
                  <FieldError>
                    {identityTouched && !pipFile ? pick(joinDialog.pipDocError, locale) : null}
                  </FieldError>
                </Field>
              ) : null}

              {kind === "poa" ? (
                <PoaJoinFields
                  joinCase={joinCase}
                  locale={locale}
                  side={poaSide}
                  onSideChange={choosePoaSide}
                  partyIds={poaPartyIds}
                  onPartyIdsChange={(ids) => {
                    setPoaPartyIds(ids);
                    setIdentityTouched(false);
                  }}
                  files={poaFiles}
                  onFileChange={(id, file) => {
                    setPoaFiles((current) => ({ ...current, [id]: file }));
                    setIdentityTouched(false);
                  }}
                  phones={poaPhones}
                  onPhoneChange={(id, value) => {
                    setPoaPhones((current) => ({ ...current, [id]: value }));
                    setIdentityTouched(false);
                  }}
                  touched={identityTouched}
                />
              ) : null}
            </form>
          ) : null}

          {/* --------------------------------------------------------- done */}
          {stage === "done" && joinCase ? (
            <div className="flex flex-col gap-4">
              {/* JOIN-64: numbers entered for parties are texted; each links on its
                  owner's confirmation at sign-in, not here. */}
              {kind === "poa" && poaNeedPhone.length ? (
                <Banner variant="info" className="items-start">
                  {fill(joinDialog.smsSentNote, locale, {
                    numbers: poaNeedPhone.map((entry) => poaPhones[entry.id]).join(", "),
                  })}
                </Banner>
              ) : null}
              <CaseDetails
                joinCase={joinCase}
                locale={locale}
                compact
                outcome={fill(
                  kind === "poa" ? joinDialog.poaJoinedBand : joinDialog.joinedBand,
                  locale,
                  {
                    name:
                      kind === "poa"
                        ? poaSelected.map((entry) => entry.name).join(", ")
                        : (party?.name ?? ""),
                  },
                )}
              />

              {/* What to do next, as a line of guidance (owner, 2026-10-14): an advocate
                  joins with the access code, so the litigant passes it on. */}
              {appearance === "advocate" || appearance === "hire" ? (
                <p className="text-body-compact text-pretty text-muted-foreground">
                  {fill(
                    appearance === "advocate" ? joinDialog.nextShareCode : joinDialog.nextFindLawyer,
                    locale,
                    /* The code they typed; arriving by the summons link, the summons's own. */
                    { code: code || SUMMONS_FACTS.accessCode },
                  )}
                </p>
              ) : null}

              {doneNotice ? (
                <Banner variant="info" className="items-start">
                  {pick(
                    joinDialog.addAdvocatePrototype,
                    locale,
                  )}
                </Banner>
              ) : null}
            </div>
          ) : null}
        </div>
        </div>
        </div>

        {/* ------------------------------------------------------------ footer */}
        <footer
          className="flex shrink-0 flex-col-reverse gap-2 border-t border-hairline px-6 pt-4 pb-[calc(--spacing(4)+env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between"
        >
          {leaving ? (
            <>
              <Button type="button" variant="outline" onClick={() => setLeaving(false)}>
                {pick(joinDialog.leaveStay, locale)}
              </Button>
              <Button type="button" onClick={() => handleOpenChange(false)}>
                {pick(joinDialog.leaveGo, locale)}
              </Button>
            </>
          ) : (
            <>
              {stage === "lookup" ? (
                <>
                  <span aria-hidden className="hidden sm:block" />
                  <Button type="submit" form="join-lookup" data-icon="inline-start">
                    <SearchIcon aria-hidden />
                    {pick(joinDialog.search, locale)}
                  </Button>
                </>
              ) : null}

              {stage === "code" ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStage("lookup")}
                    data-icon="inline-start"
                  >
                    <ArrowLeftIcon aria-hidden />
                    {pick(joinDialog.back, locale)}
                  </Button>
                  <Button type="submit" form="join-code" data-icon="inline-end">
                    {pick(joinDialog.codeVerify, locale)}
                    <ArrowRightIcon aria-hidden />
                  </Button>
                </>
              ) : null}

              {stage === "details" ? (
                <>
                  {mode === "manual" ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStage("code")}
                      data-icon="inline-start"
                    >
                      <ArrowLeftIcon aria-hidden />
                      {pick(joinDialog.back, locale)}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleOpenChange(false)}
                    >
                      {pick(summonsModal.dismiss, locale)}
                    </Button>
                  )}
                  {/* Download sits next to the primary action as a compact icon; the label
                      rides in its hover tooltip. */}
                  <div className="flex items-center gap-2">
                    <DownloadCaseFileButton
                      label={pick(joinDialog.downloadCaseFile, locale)}
                      onClick={() => setDownloadNotice(true)}
                    />
                    {/* Stacked footer on a phone: the primary fills the row beside
                        the icon, as wide as the Back button under it. */}
                    <Button
                      type="button"
                      className="flex-1 sm:flex-none"
                      onClick={() => setStage("identity")}
                      data-icon="inline-end"
                    >
                      {pick(summonsModal.cta, locale)}
                      <ArrowRightIcon aria-hidden />
                    </Button>
                  </div>
                </>
              ) : null}

              {stage === "identity" ? (
                <>
                  {mode === "handoff" ? (
                    <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                      {pick(joinDialog.close, locale)}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStage("details")}
                      data-icon="inline-start"
                    >
                      <ArrowLeftIcon aria-hidden />
                      {pick(joinDialog.back, locale)}
                    </Button>
                  )}
                  <Button
                    type="submit"
                    form="join-identity"
                    disabled={kind === "self" ? blocked : poaBlocked}
                    data-icon="inline-end"
                  >
                    {pick(joinDialog.joinSubmit, locale)}
                    <ArrowRightIcon aria-hidden />
                  </Button>
                </>
              ) : null}

              {stage === "done" ? (
                doneAction === "case" ? (
                  // No further action — Back to home, then View case as the primary.
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleOpenChange(false)}
                    >
                      {pick(joinDialog.backHome, locale)}
                    </Button>
                    <Button
                      type="button"
                      onClick={viewCase}
                      data-icon="inline-end"
                    >
                      {pick(joinDialog.viewCase, locale)}
                      <ArrowRightIcon aria-hidden />
                    </Button>
                  </>
                ) : (
                  // A next step (bail / add advocate) is the primary; View case is secondary.
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={viewCase}
                    >
                      {pick(joinDialog.viewCase, locale)}
                    </Button>
                    <Button
                      type="button"
                      onClick={() =>
                        doneAction === "bail" ? setBailOpen(true) : setDoneNotice(doneAction)
                      }
                      data-icon="inline-end"
                    >
                      {pick(
                        doneAction === "bail" ? joinDialog.fileBail : joinDialog.addAdvocate,
                        locale,
                      )}
                      <ArrowRightIcon aria-hidden />
                    </Button>
                  </>
                )
              ) : null}
            </>
          )}
        </footer>
      </FlowDialogContent>
    </Dialog>
    {bailOpen && joinCase && party ? (
      <JoinedCaseBail
        joinCase={joinCase}
        accused={[party.name]}
        as="pip"
        onClose={() => {
          setBailOpen(false);
          handleOpenChange(false);
        }}
        onViewCase={() => router.push(`/cases/${JOIN_DEMO_CASE_ID}`)}
      />
    ) : null}
    </>
  );
}
