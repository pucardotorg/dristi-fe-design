"use client";

import * as React from "react";
import { useId, useMemo, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { useRouter } from "next/navigation";

import { DiscardQuestion, useDiscardGuard } from "@/components/chrome/discard-guard";
import { FlowDialogContent } from "@/components/chrome/flow-dialog";
import { useBackCloses, useFlowWindow } from "@/components/chrome/flow-window";

import { DocumentPreview } from "@/components/cases/document-preview";
import {
  FileField,
  focusFirstInvalid,
} from "@/components/cases/filing-form-shared";
import {
  EMPTY_RICH_TEXT,
  RichTextField,
  type RichTextValue,
} from "@/components/cases/rich-text-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
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
import {
  SUBMISSION_DOCUMENT_TYPES,
  type SubmissionDocumentTypeId,
} from "@/lib/cases/applications";
import { caseSectionHref } from "@/lib/cases/sections";

type DocumentDraft = {
  type: SubmissionDocumentTypeId | "";
  title: string;
  files: File[];
  reason: RichTextValue;
};

type DocumentErrors = {
  type?: string;
  title?: string;
  files?: string;
  reason?: string;
};

const EMPTY_DRAFT: DocumentDraft = {
  type: "",
  title: "",
  files: [],
  reason: EMPTY_RICH_TEXT,
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
}

function validateDocument(draft: DocumentDraft): DocumentErrors {
  const errors: DocumentErrors = {};
  if (!draft.type) errors.type = "Select a document type.";
  if (!draft.title.trim()) errors.title = "Enter a document title.";
  if (draft.files.length === 0) {
    errors.files = "Choose at least one document file.";
  }
  if (!draft.reason.text.trim()) errors.reason = "Enter the reason for filing.";
  return errors;
}

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
      caseLine={caseLine}
      onSubmitted={() => router.push(caseHref)}
    />
  );
}

/**
 * Submit documents, in the filing dialogs' one grammar (the bail application
 * is the reference): a header naming the act and the case, one scrolling
 * column of fields at the DS field sizes, a sunken footer with the two ways
 * out. It used to be a full page with a card of boxed radio pills and 16px
 * labels, the last filing flow still in the old language (owner, Sept 21).
 * On a phone it is the window that slides in, as every workflow is.
 */
export function SubmitDocumentsDialog({
  open,
  onOpenChange,
  caseLine,
  initial,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Case number and parties, under the description. */
  caseLine?: React.ReactNode;
  /**
   * What the filing already is, when something asked for it — a Take action task
   * that names the document (owner, 2026-10-14). The dialog opens filled with it;
   * only the files, and anything the filer changes, are theirs to add. Mount the
   * dialog per request (a `key`) so a new one starts from its own.
   */
  initial?: { type?: SubmissionDocumentTypeId; title?: string; reason?: string };
  onSubmitted: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const formId = useId();
  const typeId = useId();
  const reasonLabelId = useId();
  const [start] = useState<DocumentDraft>(() => ({
    ...EMPTY_DRAFT,
    type: initial?.type ?? "",
    title: initial?.title ?? "",
    reason: initial?.reason
      ? { html: `<p>${escapeHtml(initial.reason)}</p>`, text: initial.reason }
      : EMPTY_RICH_TEXT,
  }));
  const [draft, setDraft] = useState<DocumentDraft>(start);
  const [errors, setErrors] = useState<DocumentErrors>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const dirty = useMemo(
    () =>
      Boolean(
        draft.type !== start.type ||
          draft.title.trim() !== start.title.trim() ||
          draft.files.length ||
          draft.reason.text.trim() !== start.reason.text.trim()
      ),
    [draft, start]
  );

  function update<Key extends keyof DocumentDraft>(
    key: Key,
    value: DocumentDraft[Key]
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function closeNow() {
    setPreviewOpen(false);
    setDraft(start);
    setErrors({});
    onOpenChange(false);
  }

  /** Closing midway asks first, only when something was entered. */
  const guard = useDiscardGuard(dirty, closeNow);
  function requestClose() {
    guard.close();
  }

  /** The preview only opens on a clean form; errors surface in place first. */
  function review(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateDocument(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      focusFirstInvalid(formRef.current);
      return;
    }
    setPreviewOpen(true);
  }

  /** Nothing is persisted, so this claims nothing: it closes and hands back. */
  function submit() {
    closeNow();
    onSubmitted();
  }

  const { phone } = useFlowWindow();
  useBackCloses(phone && open, () => {
    if (guard.asking) guard.keep();
    else if (previewOpen) setPreviewOpen(false);
    else requestClose();
  });

  return (
    <>
      {/* One dialog at a time: the form steps aside for the review. */}
      <Dialog
        open={open && !previewOpen}
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
              Submit documents
            </DialogTitle>
            <DialogDescription className="text-body-compact text-pretty">
              Place a memo, an affidavit or another document on the case record.
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
            <Field data-invalid={Boolean(errors.type)}>
              <FieldLabel htmlFor={typeId}>Document type</FieldLabel>
              <Select
                value={draft.type}
                onValueChange={(value) =>
                  update("type", value as SubmissionDocumentTypeId)
                }
              >
                <SelectTrigger
                  id={typeId}
                  className="w-full"
                  aria-invalid={Boolean(errors.type)}
                >
                  <SelectValue placeholder="Choose a type" />
                </SelectTrigger>
                <SelectContent>
                  {SUBMISSION_DOCUMENT_TYPES.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError>{errors.type}</FieldError>
            </Field>

            <Field data-invalid={Boolean(errors.title)}>
              <FieldLabel>Document title</FieldLabel>
              <Input
                value={draft.title}
                aria-invalid={Boolean(errors.title)}
                onChange={(event) => update("title", event.target.value)}
              />
              <FieldDescription>
                A title that tells this document apart from others of its type.
              </FieldDescription>
              <FieldError>{errors.title}</FieldError>
            </Field>

            <FileField
              required
              label="Documents"
              description="Choose related files in the order they should be merged."
              files={draft.files}
              error={errors.files}
              onFilesChange={(files) => update("files", files)}
              onErrorChange={(error) =>
                setErrors((current) => ({ ...current, files: error }))
              }
            />

            <Field data-invalid={Boolean(errors.reason)}>
              <FieldLabel id={reasonLabelId}>Reason for filing</FieldLabel>
              <RichTextField
                compact
                labelId={reasonLabelId}
                value={draft.reason}
                onChange={(reason) => update("reason", reason)}
              />
              <FieldDescription>
                Why this document is being placed on the case record.
              </FieldDescription>
              <FieldError>{errors.reason}</FieldError>
            </Field>
          </form>

          <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-hairline bg-surface-sunken px-6 py-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={requestClose}>
              Cancel
            </Button>
            <Button type="submit" form={formId}>
              Review submission
            </Button>
          </footer>
          <DiscardQuestion guard={guard} />
        </FlowDialogContent>
      </Dialog>

      <DocumentPreviewDialog
        open={open && previewOpen}
        onOpenChange={setPreviewOpen}
        files={draft.files}
        onSubmit={submit}
        onReturnFocus={() =>
          document
            .querySelector<HTMLElement>(`button[form="${CSS.escape(formId)}"]`)
            ?.focus()
        }
      />
    </>
  );
}

function DocumentPreviewDialog({
  open,
  onOpenChange,
  files,
  onSubmit,
  onReturnFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: File[];
  onSubmit: () => void;
  onReturnFocus: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FlowDialogContent
        ownBack
        className="grid-rows-[auto_1fr_auto] max-h-[85dvh] sm:max-w-2xl"
        // Radix's own restore lands on document.body here, so put focus back
        // on the button that opened the dialog explicitly.
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onReturnFocus();
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-title-s font-semibold">
            Review submission
          </DialogTitle>
          <DialogDescription className="text-body-compact">
            Check the files you are filing before you submit.
          </DialogDescription>
        </DialogHeader>

        {/* Remounts with the portal, so the viewer always opens on the first file. */}
        <FilePreview files={files} />

        <DialogFooter>
          <Button type="button" onClick={onSubmit}>
            Submit
          </Button>
        </DialogFooter>
      </FlowDialogContent>
    </Dialog>
  );
}

/**
 * The legacy screen counted pages of one merged PDF. Nothing is merged here,
 * so the indicator names the file actually on screen instead of inventing a
 * page count, and the arrows step through the files in merge order. They sit
 * in the preview's action row beside Download, since stepping and downloading
 * both act on the file currently shown.
 */
function FilePreview({ files }: { files: File[] }) {
  const [index, setIndex] = useState(0);
  const current = files[index];

  if (!current) {
    return (
      <div className="flex min-h-0 flex-col items-center justify-center gap-2 rounded-xl bg-surface-sunken p-6 text-center">
        <p className="text-body font-medium">No files attached</p>
        <p className="text-body-compact text-muted-foreground">
          Go back and add at least one document.
        </p>
      </div>
    );
  }

  return (
    <DocumentPreview
      title={current.name}
      description={
        files.length > 1 ? `File ${index + 1} of ${files.length}` : undefined
      }
      source={{ kind: "file", file: current }}
      height="fill"
      actions={
        files.length > 1 ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Previous file"
              disabled={index === 0}
              onClick={() => setIndex((value) => Math.max(0, value - 1))}
            >
              <ChevronLeftIcon aria-hidden />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Next file"
              disabled={index === files.length - 1}
              onClick={() =>
                setIndex((value) => Math.min(files.length - 1, value + 1))
              }
            >
              <ChevronRightIcon aria-hidden />
            </Button>
          </>
        ) : null
      }
    />
  );
}
