"use client";

import { useCallback, useId, useMemo, useRef, useState } from "react";
import { FilePenLineIcon } from "lucide-react";

import { AddSignatureDialog } from "@/components/cases/add-signature-dialog";
import {
  ApplicationTypeFields,
  type FieldActions,
} from "@/components/cases/application-type-fields";
import {
  ApplicationTypePicker,
  ApplicationTypeSearch,
} from "@/components/cases/application-type-picker";
import {
  DiscardFilingDialog,
  focusFirstInvalid,
  useDraftExit,
} from "@/components/cases/filing-form-shared";
import { GeneratedApplicationDialog } from "@/components/cases/generated-application-dialog";
import { Identifier } from "@/components/chrome/identifier";
import { FlowDialogContent } from "@/components/chrome/flow-dialog";
import { useBackCloses, useFlowWindow } from "@/components/chrome/flow-window";
import {
  PAGE_BACK_COLUMN,
  PAGE_BACK_ROW,
  PageBackButton,
} from "@/components/shell/page-back-button";
import { PAGE_TITLE } from "@/components/shell/page-frame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  applicationTypeGuide,
  suggestedApplicationTypes,
} from "@/lib/cases/application-type-guide";
import {
  EMPTY_APPLICATION_DRAFT,
  EMPTY_APPLICATION_ERRORS,
  applicationDraftFrom,
  draftRequestText,
  hasApplicationErrors,
  isApplicationDirty,
  validateApplication,
  type ApplicationDraft,
  type ApplicationErrors,
} from "@/lib/cases/application-draft";
import {
  caseLitigants,
  preselectedRaiser,
  raisingOptions,
} from "@/lib/cases/application-options";
import {
  type ApplicationTypeId,
  type FilingStatus,
  type Submission,
} from "@/lib/cases/applications";
import { typeAvailable } from "@/lib/applications/lifecycle";
import Link from "next/link";
import { caseSectionHref } from "@/lib/cases/sections";
import {
  objectionDeadline,
  resolveApplicationViewer,
  type ApplicationViewer,
} from "@/lib/cases/application-access";
import {
  applicationsFile,
  filingStatusLabel,
  filingStatusVariant,
  quotedOthersTitle,
  submissionTypeLabel,
} from "@/lib/cases/applications";
import { displayName } from "@/lib/cases/names";
import { isViewer, viewerRepresentation } from "@/lib/cases/viewer";
import { useProfile } from "@/components/shell/profile";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useSessionValue } from "@/lib/cases/demo-session";
import {
  newSavedDraftId,
  parseSavedDrafts,
  saveApplicationDraft,
  savedDraftSubmission,
  savedDraftsKey,
} from "@/lib/cases/saved-application-drafts";
import {
  formatCaseDate,
  partiesLabel,
  stageLabel,
  type CaseRecord,
} from "@/lib/cases/types";
import { cn } from "@/lib/utils";

/**
 * Raise application.
 *
 * Submission type is gone: the portal only carried it because one form served
 * both applications and document submissions, and Dristi already splits those
 * into two entry points off Make filings. What is left is the choice that
 * actually branches the form — the application type.
 *
 * Two steps, because they are two different jobs. Choosing the type is a
 * decision: the types are cards that say what each one asks the court for,
 * led by what the case's stage usually calls for and searchable by name.
 * Filling the chosen type's fields is the second, and it happens in a dialog
 * over the chooser (owner, Sept 21: every type files from a modal, as bail
 * does). Closing it returns to the chooser, never to the case.
 *
 * There is no separate review step: Generate application validates the form
 * and opens the generated document, which restates every entered value as
 * the filing — the document is the review. From there the signature dialogs
 * mirror the legacy portal's chain: generated document → Add signature →
 * Upload signed document.
 */
export function RaiseApplicationForm({
  record,
  resume = null,
  backHref,
  objectTo,
  inPlace,
  initialType,
  filer,
}: {
  record: CaseRecord;
  /** A saved draft reopened from the register; null starts a new filing. */
  resume?: Submission | null;
  /** Set when the filer came from the rail's case list; absent, back is the case. */
  backHref?: string;
  /**
   * The other side's application a File objection task points at. Opens
   * straight on an Objection against it: Objection is never offered in the
   * picker (ALC-12), so this is its only way in.
   */
  objectTo?: string;
  /**
   * Opened over the page the filer is already on (the case's Applications
   * tab: Continue draft, File objection) rather than on its own page. Only
   * the dialogs render, and every way out calls `onClose`, so the page under
   * the dialog never changes (owner, Sept 24: "a dialog box shouldn't change
   * the page underneath").
   */
  inPlace?: {
    onClose: () => void;
    /** The signing chain's last button, when it leads somewhere other than Done. */
    done?: { label: string; onClick: () => void };
  };
  /**
   * Opens straight on this type's fields, as a task that names the
   * application does (the joined case's File bail application).
   */
  initialType?: ApplicationTypeId;
  /**
   * Who is filing, when the case is not one the profile can be found on —
   * a case joined a moment ago that this browser has no file for yet.
   */
  filer?: ApplicationViewer;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const formId = useId();
  const router = useRouter();
  const { profileRole, accountName } = useProfile();
  /* Who is filing decides two things here (PRD "Users and actions"): a
     litigant or PoA holder does not raise applications at all, and a clerk
     drafts but never signs, so their chain ends on the hand-off. */
  const seat = useMemo(() => {
    try {
      const file = applicationsFile(record);
      const viewer =
        filer ??
        resolveApplicationViewer({
          file,
          profile: profileRole,
          accountName,
          isSignedInAdvocate: isViewer,
          fallbackSide: viewerRepresentation(record)[0] ?? "complainant",
        });
      const self = viewer?.personId
        ? file.people.find((person) => person.id === viewer.personId)
        : undefined;
      const advocate = self?.officeOf
        ? file.people.find((person) => person.id === self.officeOf)
        : undefined;
      const party = file.people.find(
        (person) => person.kind === "party" && person.side === viewer?.side
      );
      return {
        role: viewer?.role ?? null,
        side: viewer?.side,
        signer: advocate ? displayName(advocate.name) : undefined,
        /* Who a saved draft is drafted by, raised by and filed for. */
        personId: viewer?.personId,
        signerId: advocate?.id ?? viewer?.personId,
        partyId: viewer?.partyId ?? party?.id,
      };
    } catch {
      return {
        role: null,
        side: undefined,
        signer: undefined,
        personId: undefined,
        signerId: undefined,
        partyId: undefined,
      };
    }
  }, [record, profileRole, accountName, filer]);
  const filedForSide: ApplicationDraft["filedForSide"] = seat.side ?? "";
  const canRaise =
    seat.role === "advocate" || seat.role === "pip" || seat.role === "clerk";
  /* PRD "Every application": who can raise it, and for whom. */
  const raising = useMemo(() => raisingOptions(record, seat), [record, seat]);
  /* Each type's "Available when" (PRD "Application types"): bail for the
     accused, condonation for the complainant, advance and postpone only
     with a hearing scheduled. A type that cannot be filed is not offered. */
  const hearingScheduled = Boolean(record.nextHearing);
  const available = useCallback(
    (type: ApplicationTypeId) =>
      !seat.side || typeAvailable(type, { side: seat.side, hearingScheduled }),
    [seat.side, hearingScheduled]
  );
  /*
    A resumed draft arrives with its type already chosen, so it opens on the
    fields — asking someone to re-pick the type they picked yesterday is the
    whole reason "Continue draft" was worth wiring. The picker is still one
    click away on the Change type button.
  */
  const [draft, setDraft] = useState<ApplicationDraft>(() => ({
    ...(resume
      ? applicationDraftFrom(resume)
      : objectTo
        ? { ...EMPTY_APPLICATION_DRAFT, type: "objection", objectionToId: objectTo }
        : initialType
          ? { ...EMPTY_APPLICATION_DRAFT, type: initialType }
          : EMPTY_APPLICATION_DRAFT),
    filedForSide,
  }));
  /*
    Raised by starts on the filer (or, for a clerk, their advocate), and
    Litigant on the only one there is (PRD "Every application"). Read
    through while the draft leaves them empty, rather than written in, so
    they follow the profile as it settles after hydration and a choice the
    filer made is never overwritten.
  */
  const raisedById =
    draft.raisedById || preselectedRaiser(raising.raisedBy, seat);
  const litigantChoices = raising.litigantsFor(raisedById);
  const litigantId =
    draft.litigantId ||
    (litigantChoices.length === 1 ? litigantChoices[0].id : "");
  const raisedByPerson = raising.raisedBy.find(
    (person) => person.id === raisedById
  );
  /* The side is read from who is filing at render time, not frozen into
     the draft, because the profile settles only after hydration. */
  const filedDraft = useMemo<ApplicationDraft>(
    () => ({ ...draft, filedForSide, raisedById, litigantId }),
    [draft, filedForSide, raisedById, litigantId]
  );
  /* Only the person selected in Raised by signs (ALC-28). Anyone else —
     a clerk, or an advocate raising it for a colleague — hands it to them. */
  const handoffTo =
    seat.role === "clerk" ||
    (raisedByPerson && raisedByPerson.id !== seat.personId)
      ? (raisedByPerson?.name ?? seat.signer ?? "your advocate")
      : undefined;
  /* Edit Litigant Details checks the fields of the side the edited
     litigant is on. */
  const editSide = caseLitigants(record).find(
    (item) => item.id === draft.editLitigantId
  )?.side;

  const [errors, setErrors] = useState<ApplicationErrors>(
    EMPTY_APPLICATION_ERRORS
  );
  /** Choosing the type is step one; its fields are step two. */
  const [stage, setStage] = useState<"type" | "details">(
    (resume || objectTo || initialType) && draft.type ? "details" : "type"
  );
  const objecting = draft.type === "objection";
  /* The application an objection answers, for the dialog's header. */
  const objectionTarget = useMemo(() => {
    if (!objecting) return null;
    const target = applicationsFile(record).submissions.find(
      (item) => item.id === draft.objectionToId
    );
    if (!target) return null;
    return {
      label: [
        submissionTypeLabel(target.type),
        target.applicationNumber ?? target.temporaryId,
      ]
        .filter(Boolean)
        .join(" · "),
      typeLabel:
        quotedOthersTitle(target) ??
        `${submissionTypeLabel(target.type)} application`,
      /* How a sentence names it: "the other side's bail application", or an
         Others application by its own title, never re-cased. */
      inSentence: quotedOthersTitle(target)
        ? `application ${quotedOthersTitle(target)}`
        : `${submissionTypeLabel(target.type).toLowerCase()} application`,
      decision: target.decisionOn ? formatCaseDate(target.decisionOn) : undefined,
      due: target.decisionOn
        ? formatCaseDate(objectionDeadline(target.decisionOn))
        : undefined,
    };
  }, [objecting, record, draft.objectionToId]);
  const [generatedOpen, setGeneratedOpen] = useState(false);
  const [signatureOpen, setSignatureOpen] = useState(false);
  /** What the filer typed into the header search; it re-orders the cards. */
  const [query, setQuery] = useState("");
  const chosen = applicationTypeGuide(
    draft.type || "application-others"
  );
  const caseHref = caseSectionHref(record.id, "applications");
  /* Anything typed, the chosen type aside: opening a form and closing it
     again untouched should not ask whether to throw work away. */
  const typedAnything = useMemo(
    () => isApplicationDirty({ ...draft, type: "" }),
    [draft]
  );
  // Only its leave-page guard is used now; every way out of the flow stays
  // on this page.
  useDraftExit(typedAnything, caseHref);

  const actions: FieldActions = {
    update(key, value) {
      setDraft((current) => {
        const next = { ...current, [key]: value };
        /* Litigant's options are the people Raised by represents, so they
           refresh with it, landing on the only one when there is one. */
        if (key === "raisedById") {
          const litigants = raising.litigantsFor(value as string);
          next.litigantId = litigants.some((item) => item.id === current.litigantId)
            ? current.litigantId
            : litigants.length === 1
              ? litigants[0].id
              : "";
        }
        return next;
      });
      setErrors((current) => ({
        fields: Object.fromEntries(
          Object.entries(current.fields).filter(
            ([name]) => name !== key && !name.startsWith(`${String(key)}.`)
          )
        ),
      }));
    },
    setError(key, error) {
      setErrors((current) => ({
        fields: { ...current.fields, [key]: error },
      }));
    },
  };

  /**
   * Choosing is what moves you on — a chosen type with a Next button beside it
   * asks the same question twice.
   *
   * Switching type keeps what was already typed: the other type's fields are
   * simply not validated, reviewed or filed. Comparing two forms should not
   * cost the work you did in the first.
   */
  function chooseType(type: ApplicationTypeId) {
    actions.update("type", type);
    setStage("details");
  }

  /** The generated document only opens on a clean form — errors surface in place first. */
  function generate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateApplication(filedDraft, { editSide });
    setErrors(nextErrors);
    if (hasApplicationErrors(nextErrors)) {
      focusFirstInvalid(formRef.current);
      return;
    }
    setGeneratedOpen(true);
  }

  function returnFocusToGenerate() {
    // The button lives in the dialog's footer, tied to the form by id.
    document
      .querySelector<HTMLElement>(`button[form="${CSS.escape(formId)}"]`)
      ?.focus();
  }

  const [discardOpen, setDiscardOpen] = useState(false);

  /**
   * Keep what was typed as a Draft the filer can continue from the
   * Applications register (owner, Sept 24). Kept for this visit only; see
   * `saved-application-drafts.ts`. A resumed draft keeps its id, so saving it
   * again replaces it rather than adding a second row.
   */
  function saveDraft() {
    if (recordFiling({ status: "draft" })) {
      toast("Saved as a draft", {
        description: "Finish it later from Applications.",
      });
    }
    closeForm();
  }

  /**
   * Put the filing in the Applications register (this browser only), at the
   * status it stopped at: a draft, waiting for a signature (the advocate's,
   * for a clerk), waiting for payment, or paid and with the court. Keeps a
   * resumed draft's id, so it moves on rather than appearing twice.
   * Returns whether it could be recorded (the filer must be someone on the
   * case).
   */
  function recordFiling(
    stop:
      | { status: "draft" | "pending-signature" | "pending-payment" }
      | { status: "paid"; temporaryId: string }
  ): boolean {
    if (!draft.type || !seat.personId || !seat.signerId) return false;
    const paid = stop.status === "paid";
    saveApplicationDraft(record.id, {
        id: resume?.id ?? newSavedDraftId(),
        type: draft.type,
        title:
          draft.type === "application-others" && draft.title.trim()
            ? draft.title.trim()
            : submissionTypeLabel(draft.type),
        request: draftRequestText(filedDraft),
        objectionToId: draft.objectionToId || null,
        createdById: resume?.createdById ?? seat.personId,
        submittedById: raisedById || (resume?.submittedById ?? seat.signerId),
        onBehalfOfId:
          litigantId || (resume?.onBehalfOfId ?? seat.partyId ?? seat.personId),
        addedOn: resume?.addedOn ?? new Date().toISOString(),
        status: paid
          ? objecting
            ? "submitted"
            : "pending-review"
          : (stop.status as FilingStatus),
        submittedOn: paid ? new Date().toISOString().slice(0, 10) : undefined,
        temporaryId: paid && "temporaryId" in stop ? stop.temporaryId : undefined,
      });
    return true;
  }

  /** Back to the chooser with a clean slate. An objection has no chooser to
   *  return to (it is never picked there), so it goes back to the case's
   *  Applications, where its task lives. */
  function closeForm() {
    setDiscardOpen(false);
    if (inPlace) {
      inPlace.onClose();
      return;
    }
    if (objecting) {
      router.push(caseHref);
      return;
    }
    setDraft({
      ...EMPTY_APPLICATION_DRAFT,
      filedForSide,
      raisedById: draft.raisedById,
      litigantId: draft.litigantId,
    });
    setErrors(EMPTY_APPLICATION_ERRORS);
    setStage("type");
  }

  function requestCloseForm() {
    if (typedAnything) setDiscardOpen(true);
    else closeForm();
  }

  /* One dialog at a time, as the signing chain already works: the form steps
     aside for the generated document and returns if that is closed. */
  const formOpen = stage === "details" && !generatedOpen && !signatureOpen;

  /* On a phone the form is a window that slides in, and the phone's own Back
     is its Cancel: it meets the same discard warning. The later steps (the
     generated document, signing) each step back to the one before. */
  const flow = useFlowWindow();
  useBackCloses(flow.phone && stage === "details", () => {
    if (discardOpen) setDiscardOpen(false);
    else if (signatureOpen) {
      setSignatureOpen(false);
      setGeneratedOpen(true);
    } else if (generatedOpen) setGeneratedOpen(false);
    else requestCloseForm();
  });
  const formTitle = objecting
    ? "Objection"
    : draft.type === "application-others"
      ? "Other application"
      : /application$/i.test(chosen.label)
        ? chosen.label
        : `${chosen.label} application`;
  const formDescription = objecting
    ? objectionTarget?.due
      ? `Object to the other side's ${objectionTarget.inSentence}. File it by the end of ${objectionTarget.due}.`
      : "Object to the other side's application."
    : chosen.description;

  if (!canRaise) {
    return (
      <div className="flex w-full flex-col gap-6">
        <div className={PAGE_BACK_ROW}>
          <div className={PAGE_BACK_COLUMN}>
            <PageBackButton
              href={backHref ?? caseHref}
              label={backHref ? "Back to cases list" : "Back to case"}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className={cn(PAGE_TITLE, "flex min-h-8 items-center")}>
              Raise application
            </h1>
            <p className="text-body-compact text-muted-foreground">
              <Identifier value={record.caseNumber} label="case number" />
              <span aria-hidden> · </span>
              {partiesLabel(record)}
            </p>
          </div>
        </div>
        {/* The copy the owner kept; only the look changed (Sept 24): no
            dashed box, a larger brand tile, a real heading, and the way to
            the Applications tab the description points at. */}
        <Empty className="py-12 sm:py-16">
          <EmptyHeader className="gap-3">
            <EmptyMedia className="mb-1 size-14 rounded-2xl bg-brand-muted text-brand-muted-foreground">
              <FilePenLineIcon className="size-7" aria-hidden />
            </EmptyMedia>
            <EmptyTitle className="text-title-s font-semibold text-foreground">
              Your advocate raises applications for you
            </EmptyTitle>
            <EmptyDescription className="text-body-compact">
              When one is filed on your behalf, you can pay its court fee from
              the case&apos;s Applications tab.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" asChild>
              <Link href={caseHref}>Go to Applications</Link>
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  return (
    <>
      {inPlace ? null : (
      <div className="flex w-full flex-col gap-6">
        {/* Keyed to the column, not the viewport: on a portrait tablet the rail
            is still open, and a viewport rule put the search beside a heading
            that then broke onto two lines. */}
        <header className="@container">
          <div className="flex flex-col gap-4 @2xl:flex-row @2xl:items-end @2xl:justify-between @2xl:gap-8">
            {/* The arrow hangs in its own column, so the case line starts on
                the heading's edge, not under the arrow. */}
            <div className={PAGE_BACK_ROW}>
              <div className={PAGE_BACK_COLUMN}>
                <PageBackButton
                  href={backHref ?? caseHref}
                  label={backHref ? "Back to cases list" : "Back to case"}
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                {/* Not "Raise application" again: reached from the rail, the page
                    before this one already carries that name (owner, Sept 21). */}
                <h1 className={cn(PAGE_TITLE, "flex min-h-8 items-center")}>
                  Choose application type
                </h1>
                {/* Which case this files into. Reached from the rail, nothing
                    else on the screen says so. */}
                <p className="text-body-compact text-muted-foreground">
                  <Identifier value={record.caseNumber} label="case number" />
                  <span aria-hidden> · </span>
                  {partiesLabel(record)}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* A step clear of the heading above and the types below, so it
            stands alone as the way in (owner, Oct 8). */}
        <div className="mx-auto w-full max-w-2xl pt-6 pb-6">
          <ApplicationTypeSearch query={query} onQueryChange={setQuery} />
        </div>

        <ApplicationTypePicker
          value=""
          query={query}
          suggested={suggestedApplicationTypes(
            record.stage,
            record.disposal !== undefined
          )}
          stageName={stageLabel(record.stage)}
          onChoose={chooseType}
          available={available}
        />
      </div>
      )}

      {/*
        Every type files from a dialog over the chooser, in the shell the bail
        flow set: fixed header naming the ask and the case, a scrolling body of
        that type's fields, a sunken footer holding the two ways out.
      */}
      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) requestCloseForm();
        }}
      >
        <FlowDialogContent
        ownBack
          className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader className="shrink-0 border-b border-hairline px-6 py-4 pr-12 text-left">
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle className="text-title-s font-semibold text-balance">
                {formTitle}
              </DialogTitle>
              {/* The same status chip the register uses, so the row you clicked
                  and the dialog you landed in are recognisably one filing: a
                  draft, or one reopened before signing (owner, Oct 8). */}
              {resume ? (
                <Badge variant={filingStatusVariant(resume.status)}>
                  {filingStatusLabel(resume.status)}
                </Badge>
              ) : null}
            </div>
            <DialogDescription className="text-pretty">
              {formDescription}
            </DialogDescription>
            <p className="text-caption text-muted-foreground">
              <Identifier value={record.caseNumber} label="case number" />
              <span aria-hidden> · </span>
              {partiesLabel(record)}
              {resume ? ` · Started ${formatCaseDate(resume.addedOn)}` : null}
            </p>
          </DialogHeader>

          <form
            id={formId}
            ref={formRef}
            noValidate
            onSubmit={generate}
            className="min-h-0 flex-1 overflow-y-auto px-6 py-6"
          >
            <ApplicationTypeFields
              draft={filedDraft}
              errors={errors}
              record={record}
              actions={actions}
              raisedByOptions={raising.raisedBy}
              litigantOptions={litigantChoices}
            />
          </form>

          <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-hairline bg-surface-sunken px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant="outline" onClick={requestCloseForm}>
              Cancel
            </Button>
            <Button type="submit" form={formId}>
              {objecting ? "Generate objection" : "Generate application"}
            </Button>
          </footer>
        </FlowDialogContent>
      </Dialog>

      <GeneratedApplicationDialog
        open={generatedOpen}
        onOpenChange={setGeneratedOpen}
        draft={filedDraft}
        record={record}
        onAddSignature={() => {
          setGeneratedOpen(false);
          setSignatureOpen(true);
        }}
        onReturnFocus={returnFocusToGenerate}
        signLabel={handoffTo ? "Send for signature" : undefined}
      />

      <AddSignatureDialog
        open={signatureOpen}
        onOpenChange={setSignatureOpen}
        draft={filedDraft}
        record={record}
        onBack={() => {
          setSignatureOpen(false);
          setGeneratedOpen(true);
        }}
        // Finishing returns to the chooser, not the case (owner, Sept 21):
        // someone filing several applications files the next from here, and
        // the confirmation has already said where this one waits.
        onComplete={(outcome) => {
          setSignatureOpen(false);
          // Into the register at the status the chain stopped at; a resumed
          // draft moves on under the same id.
          recordFiling(outcome);
          closeForm();
        }}
        onReturnFocus={returnFocusToGenerate}
        handoffTo={handoffTo}
        done={inPlace?.done}
        objection={
          objecting && objectionTarget
            ? {
                target: objectionTarget.typeLabel,
                inSentence: objectionTarget.inSentence,
                decision: objectionTarget.decision,
              }
            : undefined
        }
      />

      <DiscardFilingDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        onDiscard={closeForm}
        onSaveDraft={seat.personId ? saveDraft : undefined}
        noun={objecting ? "objection" : "application"}
      />
    </>
  );
}

/**
 * The page's entry point. A draft saved during this visit is not known to
 * the server, so `?draft=` that the server could not resolve is looked up
 * here, in the visit's memory, and the form remounts on it.
 */
export function RaiseApplicationEntry({
  draftId,
  resume = null,
  ...props
}: Omit<React.ComponentProps<typeof RaiseApplicationForm>, "resume"> & {
  draftId?: string;
  resume?: Submission | null;
}) {
  const savedRaw = useSessionValue(savedDraftsKey(props.record.id));
  const saved =
    !resume && draftId
      ? parseSavedDrafts(savedRaw).find((item) => item.id === draftId)
      : undefined;
  const resumed = resume ?? (saved ? savedDraftSubmission(saved) : null);
  return (
    <RaiseApplicationForm
      key={resumed?.id ?? "new"}
      {...props}
      resume={resumed}
    />
  );
}
