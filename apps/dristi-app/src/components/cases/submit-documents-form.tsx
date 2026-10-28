"use client";

import * as React from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  FileTextIcon,
  ImageIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { useRouter } from "next/navigation";

import { FlowDialogContent } from "@/components/chrome/flow-dialog";
import { useBackCloses, useFlowWindow } from "@/components/chrome/flow-window";

import { SelectField, TextField } from "@/components/cases/application-type-fields";
import {
  DocumentPreview,
  DocumentPreviewActions,
} from "@/components/cases/document-preview";
import { Fact, FactGroup } from "@/components/cases/application-record-dialog";
import {
  DiscardFilingDialog,
  FileField,
  focusFirstInvalid,
  isPreviewableImage,
} from "@/components/cases/filing-form-shared";
import { DocumentSignatureDialog } from "@/components/cases/e-sign-dialog";
import {
  PdfViewer,
  localFileSrc,
  parsePdfSrc,
} from "@/components/cases/pdf-viewer";
import { useProfile } from "@/components/shell/profile";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { resolveApplicationViewer } from "@/lib/cases/application-access";
import {
  applicationsFile,
  SUBMISSION_DOCUMENT_TYPES,
  type SubmissionDocumentTypeId,
} from "@/lib/cases/applications";
import { FIXTURE_TODAY } from "@/lib/cases/fixtures";
import { displayName } from "@/lib/cases/names";
import { COURT_PERSON_ID } from "@/lib/cases/documents";
import { findCaseRecord } from "@/lib/cases/party-cases";
import {
  newDocumentSubmissionId,
  newSavedDocumentId,
  saveDocumentSubmission,
  savedDocumentFiles,
  type SavedDocumentSubmission,
} from "@/lib/cases/saved-document-submissions";
import { caseSectionHref } from "@/lib/cases/sections";
import { isViewer, viewerAccess, viewerRepresentation } from "@/lib/cases/viewer";
import { cn } from "@/lib/utils";

/**
 * The one document a submission carries: its type, title and file (DSB-01,
 * DSB-23). One per submission for now (PM, Oct 26), which also settles
 * whether the type is chosen per submission or per document.
 */
type DocumentDraft = {
  id: string;
  type: SubmissionDocumentTypeId | "";
  title: string;
  files: File[];
};

type Errors = { type?: string; title?: string; files?: string };

function emptyDraft(): DocumentDraft {
  return { id: newSavedDocumentId(), type: "", title: "", files: [] };
}

function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

function validate(draft: DocumentDraft): Errors {
  const errors: Errors = {};
  if (!draft.type) errors.type = "Select a document type.";
  if (!draft.title.trim()) errors.title = "Enter a document title.";
  if (draft.files.length === 0) errors.files = "Choose a file.";
  return errors;
}

const TYPE_OPTIONS = SUBMISSION_DOCUMENT_TYPES.map((item) => ({
  value: item.id,
  label: item.label,
}));

/**
 * The route, kept for links that land on it. It is the dialog, standing open
 * over an empty page; leaving it goes to the case's Documents register.
 */
export function SubmitDocumentsForm({
  caseId,
  caseLine,
}: {
  caseId: string;
  caseLine?: React.ReactNode;
}) {
  const router = useRouter();
  const caseHref = caseSectionHref(caseId, "documents");
  return (
    <SubmitDocumentsDialog
      open
      onOpenChange={(open) => {
        if (!open) router.push(caseHref);
      }}
      caseId={caseId}
      caseLine={caseLine}
      onSubmitted={() => router.push(caseHref)}
    />
  );
}

/**
 * Who is filing, and so who signs (DSB-18), read the way Raise application
 * reads it. An advocate or party in person signs their own. A clerk, or
 * someone with office access, never signs: it goes to the advocates they
 * work for on the case, and the first to sign submits it.
 */
function useDocumentFiler(caseId: string | undefined) {
  const { profileRole, accountName } = useProfile();
  return useMemo(() => {
    const record = caseId ? findCaseRecord(caseId) : undefined;
    if (!record) return null;
    try {
      const file = applicationsFile(record);
      const viewer = resolveApplicationViewer({
        file,
        profile: profileRole,
        accountName,
        isSignedInAdvocate: isViewer,
        fallbackSide: viewerRepresentation(record)[0] ?? "complainant",
      });
      if (!viewer?.personId) return null;
      const self = file.people.find((person) => person.id === viewer.personId);
      const advocates = self?.officeOf
        ? file.people.filter((person) => person.id === self.officeOf)
        : [];
      const party = file.people.find(
        (person) => person.kind === "party" && person.side === viewer.side
      );
      /* Office access is an advocate's way onto a case they are not on the
         nama of; a party in person on a case with no advocate is not that. */
      const handsOff =
        viewer.role === "clerk" ||
        (viewer.role === "advocate" && viewerAccess(record).kind === "office");
      const signers = handsOff ? advocates.map((person) => person.id) : [];
      return {
        /* The same people as Raise application (PM, Oct 26): an advocate,
           a party in person or a clerk. A litigant with an advocate, or a
           PoA holder, does not file; their advocate does. */
        canSubmit:
          viewer.role === "advocate" ||
          viewer.role === "pip" ||
          viewer.role === "clerk",
        personId: viewer.personId,
        signerId: signers[0] ?? viewer.personId,
        signers,
        partyId: viewer.partyId ?? party?.id ?? viewer.personId,
        /** Set when the filer may not sign: whom it goes to. */
        handoffTo: handsOff
          ? advocates.length === 1
            ? displayName(advocates[0].name)
            : "your advocates"
          : undefined,
      };
    } catch {
      return null;
    }
  }, [caseId, profileRole, accountName]);
}

/**
 * Submit documents, in the filing dialogs' one grammar (the bail application
 * is the reference): a header naming the act and the case, one scrolling
 * column of fields at the DS field sizes, a sunken footer with the two ways
 * out. On a phone it is the window that slides in, as every workflow is.
 *
 * One document per submission, with its type, title and file (PM, Oct 26:
 * one per flow for now; no reason for filing). It is signed before it is
 * submitted, and never asks for a fee (DSB-03, DSB-19). Review, then sign
 * it, leave it to sign later, or (a clerk) send it to the advocates who sign.
 */
export function SubmitDocumentsDialog({
  open,
  onOpenChange,
  caseId,
  caseLine,
  initial,
  resume,
  court,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * The case it is filed on, so it is kept for this visit and shows on the
   * Documents tab. Without one (a Take action task) it is signed and handed
   * back, and nothing is kept.
   */
  caseId?: string;
  /** Case number and parties, under the description. */
  caseLine?: React.ReactNode;
  /**
   * What the filing already is, when something asked for it — a Take action task
   * that names the document (owner, 2026-10-14). The dialog opens filled with it;
   * only the file, and anything the filer changes, are theirs to add. Mount the
   * dialog per request (a `key`) so a new one starts from its own.
   */
  initial?: { type?: SubmissionDocumentTypeId; title?: string };
  /** A saved draft, reopened by Continue draft. Mount per draft (a `key`). */
  resume?: SavedDocumentSubmission;
  /**
   * Set on the court's case page: a member of the court submits, and signs
   * their own (DSB-04, DSB-18). Signed there and then, so no draft and no
   * sign later.
   */
  court?: { name: string; role: string; court: string };
  onSubmitted: () => void;
}) {
  const partyFiler = useDocumentFiler(court ? undefined : caseId);
  const filer = court
    ? {
        canSubmit: true,
        personId: COURT_PERSON_ID,
        signerId: COURT_PERSON_ID,
        signers: [],
        partyId: COURT_PERSON_ID,
        handoffTo: undefined,
      }
    : partyFiler;
  const formRef = useRef<HTMLFormElement>(null);
  const formId = useId();
  const [start] = useState<DocumentDraft>(() => {
    const saved = resume?.documents[0];
    return saved
      ? {
          id: saved.id,
          type: saved.type,
          title: saved.title,
          files: savedDocumentFiles(saved.id),
        }
      : { ...emptyDraft(), type: initial?.type ?? "", title: initial?.title ?? "" };
  });
  const [draft, setDraft] = useState<DocumentDraft>(start);
  const [errors, setErrors] = useState<Errors>({});
  const [stage, setStage] = useState<"form" | "review" | "sign">("form");
  const [discardOpen, setDiscardOpen] = useState(false);
  const dirty =
    draft.type !== start.type ||
    draft.title.trim() !== start.title.trim() ||
    draft.files !== start.files;

  function update(patch: Partial<DocumentDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch)) delete next[key as keyof Errors];
      return next;
    });
  }

  function closeNow() {
    setDiscardOpen(false);
    setStage("form");
    /* The dialog can stay mounted between filings (Make filings keeps it), so
       the next one gets a new document id; a resumed draft keeps its own. */
    setDraft(resume ? start : { ...start, id: newSavedDocumentId() });
    setErrors({});
    onOpenChange(false);
  }

  /** Closing midway asks first, only when something was entered. */
  function requestClose() {
    if (dirty) setDiscardOpen(true);
    else closeNow();
  }

  /** The review only opens on a clean form; errors surface in place first. */
  function review(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate(draft);
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      focusFirstInvalid(formRef.current);
      return;
    }
    setStage("review");
  }

  /** Keep it for this visit, at the status it stopped at. */
  function keep(status: SavedDocumentSubmission["status"]) {
    if (!caseId || !filer) return;
    saveDocumentSubmission(
      caseId,
      {
        id: resume?.id ?? newDocumentSubmissionId(),
        documents: [
          {
            id: draft.id,
            type: draft.type || "evidence",
            title: draft.title.trim(),
            files: draft.files.map((file) => ({
              label: file.name,
              href: localFileSrc(file),
            })),
          },
        ],
        status,
        createdById: resume?.createdById ?? filer.personId,
        submittedById: filer.signerId,
        signers: filer.signers,
        onBehalfOfId: filer.partyId,
        addedOn: resume?.addedOn ?? new Date().toISOString(),
        submittedOn: status === "submitted" ? FIXTURE_TODAY : undefined,
        byCourt: court,
      },
      new Map([[draft.id, draft.files]])
    );
  }

  function finish(status: SavedDocumentSubmission["status"], message?: string) {
    keep(status);
    if (message) toast(message);
    closeNow();
    onSubmitted();
  }

  function saveDraft() {
    keep("draft");
    toast("Saved as a draft");
    closeNow();
  }

  const { phone } = useFlowWindow();
  useBackCloses(phone && open, () => {
    if (discardOpen) setDiscardOpen(false);
    else if (stage === "review") setStage("form");
    else requestClose();
  });

  if (filer && !filer.canSubmit) {
    return (
      <AdvocateFilesDialog
        open={open}
        onOpenChange={onOpenChange}
        caseLine={caseLine}
      />
    );
  }

  return (
    <>
      {/* One dialog at a time: the form steps aside for the review. */}
      <Dialog
        open={open && stage === "form"}
        onOpenChange={(next) => {
          if (!next) requestClose();
        }}
      >
        <FlowDialogContent
        ownBack
          /* As tall as the review that follows, so a document of many files
             lists them without the box growing; the list scrolls inside it. */
          className="flex h-[calc(100dvh---spacing(12))] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader className="shrink-0 border-b border-hairline px-6 py-4 pr-12 text-left">
            <DialogTitle className="text-title-s font-semibold text-balance">
              Submit documents
            </DialogTitle>
            <DialogDescription className="text-body-compact text-pretty">
              Place an affidavit, a memo or evidence on the case record.
            </DialogDescription>
            {caseLine ? (
              <p className="text-caption text-muted-foreground">{caseLine}</p>
            ) : null}
          </DialogHeader>

          <form
            id={formId}
            ref={formRef}
            noValidate
            onSubmit={review}
            className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-6"
          >
            <SelectField
              label="Document type"
              value={draft.type}
              options={TYPE_OPTIONS}
              placeholder="Choose a type"
              error={errors.type}
              onChange={(value) => update({ type: value as SubmissionDocumentTypeId })}
            />
            <TextField
              label="Document title"
              value={draft.title}
              error={errors.title}
              onChange={(title) => update({ title })}
            />
            <FileField
              required
              compact
              label="Files"
              files={draft.files}
              error={errors.files}
              onFilesChange={(files) => update({ files })}
              onErrorChange={(error) =>
                setErrors((current) => ({ ...current, files: error }))
              }
            />
          </form>

          <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-hairline bg-surface-sunken px-6 py-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={requestClose}>
              Cancel
            </Button>
            <Button type="submit" form={formId}>
              Review submission
            </Button>
          </footer>
        </FlowDialogContent>
      </Dialog>

      <ReviewDialog
        open={open && stage === "review"}
        onOpenChange={(next) => {
          if (!next) setStage("form");
        }}
        draft={draft}
        actionLabel={filer?.handoffTo ? "Send for signature" : "Sign"}
        onAction={() => {
          if (filer?.handoffTo) {
            finish("pending-signature", `Sent to ${filer.handoffTo} to sign`);
          } else {
            setStage("sign");
          }
        }}
        onReturnFocus={() =>
          document
            .querySelector<HTMLElement>(`button[form="${CSS.escape(formId)}"]`)
            ?.focus()
        }
      />

      <DocumentSignatureDialog
        open={open && stage === "sign"}
        onBack={() => setStage("review")}
        onComplete={() => finish("submitted")}
        onSignLater={
          caseId && filer && !court
            ? () => finish("pending-signature", "Saved. Waiting for your signature")
            : undefined
        }
      />

      <DiscardFilingDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        onDiscard={closeNow}
        onSaveDraft={caseId && filer && !court ? saveDraft : undefined}
        noun="document"
        finishIn="Documents"
      />
    </>
  );
}
/**
 * What a litigant with an advocate, or a PoA holder, sees instead of the
 * form: Raise application's own words for the same rule, in this dialog's
 * frame, with the one way out.
 */
function AdvocateFilesDialog({
  open,
  onOpenChange,
  caseLine,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseLine?: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FlowDialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="shrink-0 border-b border-hairline px-6 py-4 pr-12 text-left">
          <DialogTitle className="text-title-s font-semibold text-balance">
            Submit documents
          </DialogTitle>
          {caseLine ? (
            <p className="text-caption text-muted-foreground">{caseLine}</p>
          ) : null}
        </DialogHeader>
        <Empty className="px-6 py-12">
          <EmptyHeader className="gap-3">
            <EmptyMedia className="mb-1 size-14 rounded-2xl bg-brand-muted text-brand-muted-foreground">
              <FileTextIcon className="size-7" aria-hidden />
            </EmptyMedia>
            <EmptyTitle className="text-body font-semibold text-foreground">
              Your advocate submits documents for you
            </EmptyTitle>
            <DialogDescription className="text-body-compact text-muted-foreground">
              Once they do, you can see them on the case&apos;s Documents tab.
            </DialogDescription>
          </EmptyHeader>
        </Empty>
        <footer className="flex shrink-0 justify-end border-t border-hairline bg-surface-sunken px-6 py-4">
          <Button type="button" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </footer>
      </FlowDialogContent>
    </Dialog>
  );
}

/**
 * Review, in the record dialogs' frame (owner, Oct 26): the facts on the left
 * with every file listed, the file itself on the right at the height the
 * dialog allows. A document of several files shows them all at once in the
 * list, so none is missed behind the arrows; the arrows, and the arrow keys,
 * still step through them. The halves stack when the dialog is narrow.
 */
function ReviewDialog({
  open,
  onOpenChange,
  draft,
  actionLabel,
  onAction,
  onReturnFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: DocumentDraft;
  actionLabel: string;
  onAction: () => void;
  onReturnFocus: () => void;
}) {
  const [index, setIndex] = useState(0);
  /* Opens on the first file each time. */
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setIndex(0);
  }
  const files = draft.files;
  const current = files[Math.min(index, files.length - 1)];
  const title = draft.title.trim();
  const typeLabel =
    SUBMISSION_DOCUMENT_TYPES.find((item) => item.id === draft.type)?.label ?? "";

  function step(by: number) {
    setIndex((value) => Math.min(files.length - 1, Math.max(0, value + by)));
  }

  /* An object URL for a PDF, made once per file and let go when it changes. */
  const currentPdf = useMemo(
    () =>
      current && isPdfFile(current)
        ? parsePdfSrc(localFileSrc(current)).url
        : null,
    [current]
  );
  useEffect(
    () => () => {
      if (currentPdf) URL.revokeObjectURL(currentPdf);
    },
    [currentPdf]
  );

  const header = current ? (
    <div className="flex min-w-0 items-center gap-2 py-1.5 pl-4">
      <h3 className="min-w-0 truncate text-caption font-semibold text-foreground">
        {current.name}
      </h3>
      {files.length > 1 ? (
        <span className="shrink-0 text-caption tabular-nums text-muted-foreground">
          {index + 1} of {files.length}
        </span>
      ) : null}
    </div>
  ) : null;

  const arrows =
    files.length > 1 ? (
      <>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Previous file"
          disabled={index === 0}
          onClick={() => step(-1)}
        >
          <ChevronLeftIcon aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Next file"
          disabled={index === files.length - 1}
          onClick={() => step(1)}
        >
          <ChevronRightIcon aria-hidden />
        </Button>
      </>
    ) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FlowDialogContent
        ownBack
        showCloseButton={false}
        className="flex h-[calc(100dvh---spacing(12))] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
        // Radix's own restore lands on document.body here, so put focus back
        // on the button that opened the dialog explicitly.
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onReturnFocus();
        }}
        onKeyDown={(event) => {
          if (files.length < 2) return;
          const target = event.target as HTMLElement;
          if (target.closest("input, textarea, [contenteditable=true]")) return;
          if (event.key === "ArrowLeft") step(-1);
          else if (event.key === "ArrowRight") step(1);
        }}
      >
        <div className="flex shrink-0 items-start gap-2 border-b border-hairline py-3 pr-3 pl-6">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <DialogTitle className="text-body font-semibold text-pretty">
              Review submission
            </DialogTitle>
            <DialogDescription className="text-body-compact">
              Check the document before it is signed.
            </DialogDescription>
          </div>
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
                  <Fact label="Document title">{title}</Fact>
                </FactGroup>
                <FactGroup columns={2}>
                  <Fact label="Document type">{typeLabel}</Fact>
                  <Fact label="Files">
                    <span className="tabular-nums">{files.length}</span>
                  </Fact>
                </FactGroup>
              </div>

              <div className="flex flex-col gap-1.5 border-t border-hairline pt-3">
                <h3 className="text-caption font-medium text-muted-foreground">
                  Files
                </h3>
                <ul className="-mx-2 flex flex-col gap-0.5">
                  {files.map((file, position) => (
                    <li key={`${file.name}-${file.size}-${file.lastModified}`}>
                      <button
                        type="button"
                        aria-pressed={position === index}
                        onClick={() => setIndex(position)}
                        className={cn(
                          "flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-body-compact outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50",
                          position === index && "bg-accent-strong font-medium"
                        )}
                      >
                        {isPreviewableImage(file) ? (
                          <ImageIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <FileTextIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="min-w-0 break-words">{file.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* The file on the tinted stage the court's reading panes use, as a
                framed sheet that takes the height left over. */}
            <div className="flex min-h-80 min-w-0 flex-1 flex-col bg-muted p-4 dark:bg-background">
              {current && currentPdf ? (
                /* A PDF in the PDF viewer the record dialogs read with, in the
                   same framed sheet the other files get: the shared preview
                   only draws pictures from a file on this computer. */
                <section
                  aria-label={current.name}
                  className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-hairline bg-card"
                >
                  <div className="flex shrink-0 items-stretch justify-between gap-2 border-b border-hairline pr-1.5">
                    {header}
                    <DocumentPreviewActions
                      iconOnly
                      title={current.name}
                      source={{ kind: "file", file: current }}
                      className="self-center"
                    >
                      {arrows}
                    </DocumentPreviewActions>
                  </div>
                  <PdfViewer
                    key={currentPdf}
                    src={currentPdf}
                    title={current.name}
                    className="min-h-64 flex-1 rounded-none"
                  />
                </section>
              ) : current ? (
                <DocumentPreview
                  key={`${current.name}-${current.size}-${current.lastModified}`}
                  title={current.name}
                  source={{ kind: "file", file: current }}
                  variant="quiet"
                  surface="card"
                  height="fill"
                  className="flex-1"
                  header={header}
                  actions={arrows}
                />
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl bg-card p-6 text-center">
                  <p className="text-body font-medium">No files attached</p>
                  <p className="text-body-compact text-muted-foreground">
                    Go back and add at least one file.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-hairline bg-surface-sunken px-6 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Back
          </Button>
          <Button type="button" onClick={onAction}>
            {actionLabel}
          </Button>
        </footer>
      </FlowDialogContent>
    </Dialog>
  );
}
