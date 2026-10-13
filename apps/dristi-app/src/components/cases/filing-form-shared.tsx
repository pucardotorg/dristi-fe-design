"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  FileTextIcon,
  PlusIcon,
  Trash2Icon,
  UserRoundIcon,
} from "lucide-react";

import { ChromeAlertDialogContent } from "@/components/chrome/app-chrome";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DescriptionDetails,
  DescriptionRow,
  DescriptionTerm,
} from "@/components/ui/description-list";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
  useFieldControlProps,
} from "@/components/ui/field";
import { DocumentSlot } from "@/components/ui/document-slot";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { RequiredMark } from "@/components/filing/form-field";
import { cn } from "@/lib/utils";
import { Identifier } from "@/components/chrome/identifier";

export const MAX_FILING_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_FILE_EXTENSIONS = ["pdf", "jpg", "jpeg", "png"];
const PREVIEWABLE_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png"];
const ACCEPTED_FILE_TYPES =
  ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

function fileExtension(file: File): string {
  return file.name.split(".").pop()?.toLowerCase() ?? "";
}

/** Only the accepted raster types render a real preview; PDFs never do. */
export function isPreviewableImage(file: File): boolean {
  return PREVIEWABLE_IMAGE_EXTENSIONS.includes(fileExtension(file));
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

export function validateSelectedFiles(files: File[]): string | null {
  const unsupported = files.find((file) => {
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    return !ACCEPTED_FILE_EXTENSIONS.includes(extension);
  });
  if (unsupported) {
    return `${unsupported.name} is not a supported file. Choose PDF, JPG, JPEG or PNG.`;
  }

  const tooLarge = files.find((file) => file.size > MAX_FILING_FILE_SIZE);
  if (tooLarge) {
    return `${tooLarge.name} is larger than 10 MB.`;
  }
  return null;
}

export function focusFirstInvalid(container: HTMLElement | null) {
  requestAnimationFrame(() => {
    container
      ?.querySelector<HTMLElement>("[aria-invalid='true']")
      ?.focus();
  });
}

export function useDraftExit(dirty: boolean, href: string) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  function requestExit() {
    if (dirty) setOpen(true);
    else router.push(href);
  }

  /**
   * Discarding and completing both just leave for the case. The difference is
   * intent: only requestExit consults the dirty guard, so finishing the flow
   * never asks whether you meant to throw the draft away.
   */
  function leave() {
    setOpen(false);
    router.push(href);
  }

  return {
    open,
    setOpen,
    requestExit,
    discard: leave,
    complete: leave,
  };
}

/**
 * Shared shell for the filing flows: the way back, the title and description,
 * and an optional prototype banner and case context card that default to on
 * so each flow opts out rather than opting in.
 *
 * There is no step indicator. Raise application was the last flow carrying
 * one, and a two-step counter was never what oriented anybody: on the second
 * step the chosen-type card names the type and offers the way back to the
 * choice, which says the same thing and does something about it.
 */
export function FilingFrame({
  title,
  description,
  caseNumber,
  complainantName,
  onExit,
  showPrototypeBanner = true,
  showCaseContext = true,
  /** "wide" gives a two-column body room; single-column forms stay default. */
  contentWidth = "default",
  children,
}: {
  title: string;
  description: string;
  caseNumber?: string;
  complainantName?: string;
  onExit: () => void;
  showPrototypeBanner?: boolean;
  showCaseContext?: boolean;
  contentWidth?: "default" | "wide";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-col gap-8",
        contentWidth === "wide" ? "max-w-6xl" : "max-w-4xl"
      )}
    >
      <div>
        <Button type="button" variant="ghost" onClick={onExit}>
          <ArrowLeftIcon data-icon="inline-start" aria-hidden />
          Back to case
        </Button>
      </div>

      <header>
        <h1 className="text-title-l font-semibold">{title}</h1>
        <p className="mt-2 max-w-2xl text-body text-muted-foreground">
          {description}
        </p>
      </header>

      {showPrototypeBanner ? (
        <Banner variant="neutral">
          Prototype only — filing details and selected files will not be saved
          or sent.
        </Banner>
      ) : null}

      {showCaseContext && caseNumber ? (
        <Card size="sm" className="hover:bg-card">
          <CardContent className="flex items-start gap-3">
            <UserRoundIcon className="mt-0.5 size-5 shrink-0" aria-hidden />
            <div>
              <p className="text-body-compact text-muted-foreground">
                Case <Identifier value={caseNumber} label="case number" />
              </p>
              <p className="text-body font-medium">
                Filing for Complainant · {complainantName}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {children}
    </div>
  );
}

/**
 * An open-ended list of uploaded documents, in the DS grammar the rest of the
 * party dialogs use (owner, Sept 2): empty is the DS `DocumentSlot` dashed
 * target, filled is a stack of DS `Attachment` rows with a single "Add more"
 * outline button beneath — the same add affordance as every other repeat list
 * (ContactList, AddressBlockList). The earlier bespoke well with a right-edge
 * "Upload more" read as its own one-off control; this one matches.
 */
export function FileField({
  label,
  description,
  required = false,
  files,
  error,
  onFilesChange,
  onErrorChange,
}: {
  label: string;
  description: string;
  required?: boolean;
  files: File[];
  error?: string;
  onFilesChange: (files: File[]) => void;
  onErrorChange: (error: string | undefined) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const attached = files.length > 0;

  function addFiles(selected: File[]) {
    const validationError = validateSelectedFiles(selected);
    if (validationError) {
      onErrorChange(validationError);
      return;
    }

    const existing = new Set(files.map(fileKey));
    const unique = selected.filter((file) => !existing.has(fileKey(file)));
    if (unique.length !== selected.length) {
      onErrorChange("A selected file has already been added.");
      return;
    }

    onFilesChange([...files, ...unique]);
    onErrorChange(undefined);
  }

  return (
    <Field data-invalid={Boolean(error)}>
      {attached ? (
        <>
          <FieldLabel className="flex items-center gap-1.5">
            <span>{label}</span>
            {required ? null : <RequiredMark optional />}
          </FieldLabel>
          <AttachmentGroup className="flex-col overflow-visible py-0 *:data-[slot=attachment]:w-full">
            {files.map((file) => (
              <Attachment key={fileKey(file)} className="w-full">
                <AttachmentMedia
                  variant={isPreviewableImage(file) ? "image" : "icon"}
                  className="w-20"
                >
                  {isPreviewableImage(file) ? (
                    <FilePreviewImage file={file} />
                  ) : (
                    <FileTextIcon className="size-8" aria-hidden />
                  )}
                </AttachmentMedia>
                <AttachmentContent>
                  <AttachmentTitle>{file.name}</AttachmentTitle>
                  <AttachmentDescription>
                    {formatFileSize(file.size)} · selected locally
                  </AttachmentDescription>
                </AttachmentContent>
                <AttachmentActions>
                  <AttachmentAction
                    type="button"
                    variant="destructive-ghost"
                    size="icon"
                    aria-label={`Remove ${file.name}`}
                    onClick={() =>
                      onFilesChange(
                        files.filter((item) => fileKey(item) !== fileKey(file))
                      )
                    }
                  >
                    <Trash2Icon aria-hidden />
                  </AttachmentAction>
                </AttachmentActions>
              </Attachment>
            ))}
          </AttachmentGroup>
          <Button
            type="button"
            variant="outline"
            className="w-fit"
            onClick={() => inputRef.current?.click()}
          >
            <PlusIcon data-icon="inline-start" aria-hidden />
            Add more
          </Button>
        </>
      ) : (
        <DocumentSlot
          status="empty"
          media="icon"
          label={label}
          required={required}
          optional={!required}
          copy={{ optional: "optional", noFile: "No documents added yet" }}
          onChooseFile={() => inputRef.current?.click()}
        />
      )}

      <FieldDescription className="text-body-compact">
        {description} PDF, JPG, JPEG or PNG; maximum 10 MB per file.
      </FieldDescription>
      <FieldError className="text-body-compact">{error}</FieldError>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_FILE_TYPES}
        tabIndex={-1}
        className="sr-only"
        aria-hidden="true"
        onChange={(event) => {
          addFiles(Array.from(event.target.files ?? []));
          event.currentTarget.value = "";
        }}
      />
    </Field>
  );
}

/**
 * Renders an accepted image from an object URL.
 *
 * The URL is created and released by the same effect, so it is revoked when
 * the file is removed, when the list unmounts, and on StrictMode's extra
 * mount — the src is set imperatively precisely so create and revoke stay a
 * matched pair without a render-time side effect.
 *
 * alt is empty on purpose: every caller shows the filename as visible text
 * beside or beneath the image, so alt would only repeat it.
 */
export function FilePreviewImage({
  file,
  className,
}: {
  file: File;
  className?: string;
}) {
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const image = imageRef.current;
    if (!image) return;
    const url = URL.createObjectURL(file);
    image.src = url;
    return () => {
      image.removeAttribute("src");
      URL.revokeObjectURL(url);
    };
  }, [file]);

  // eslint-disable-next-line @next/next/no-img-element -- object URL, not a remote asset
  return <img ref={imageRef} alt="" className={className} />;
}

/**
 * A required choice with every option visible at rest — the pattern both
 * filing flows use. A list short enough to read at a glance is faster to read
 * than a dropdown is to open, and someone who does not already know the
 * vocabulary cannot search for a word they have never seen.
 *
 * The pill is a real radio wearing the DS choice treatment: FieldLabel ships
 * has-data-checked:border-primary and bg-brand-muted for exactly this.
 * ToggleGroup in single mode reads as a radiogroup to assistive tech but its
 * arrow keys only move focus, never select — the wrong contract for a
 * required choice.
 *
 * Labels wrap rather than truncate: a translated head runs several times
 * longer than the English, and in a column the pill has no room to grow.
 */
export function ChoicePillGroup<Value extends string>({
  legend,
  options,
  value,
  error,
  orientation = "row",
  onChange,
}: {
  legend: string;
  options: readonly { id: Value; label: string }[];
  value: Value | "";
  error?: string;
  orientation?: "row" | "column";
  onChange: (value: Value) => void;
}) {
  return (
    <Field data-invalid={Boolean(error)}>
      <ChoicePills
        legend={legend}
        options={options}
        value={value}
        error={error}
        orientation={orientation}
        onChange={onChange}
      />
    </Field>
  );
}

/**
 * Split from ChoicePillGroup on purpose: useFieldControlProps reads the Field
 * context, and context reaches descendants — not the component that renders
 * the provider. Called one level up it returns {}, which ships literal
 * "undefined-*" ids and drops the error wiring.
 */
function ChoicePills<Value extends string>({
  legend,
  options,
  value,
  error,
  orientation,
  onChange,
}: {
  legend: string;
  options: readonly { id: Value; label: string }[];
  value: Value | "";
  error?: string;
  orientation: "row" | "column";
  onChange: (value: Value) => void;
}) {
  const fieldProps = useFieldControlProps({});
  const legendId = `${fieldProps.id}-legend`;

  return (
    <FieldSet>
      <FieldLegend id={legendId} className="mb-2 text-body">
        {legend}
      </FieldLegend>
      {/*
        aria-invalid rides the group, not each option: one missed choice is one
        error, and marking every radio paints a red ring per option.
      */}
      <RadioGroup
        {...fieldProps}
        value={value}
        onValueChange={(next: string) => {
          const match = options.find((option) => option.id === next);
          if (match) onChange(match.id);
        }}
        aria-labelledby={legendId}
        className={cn(
          "flex gap-2",
          orientation === "column" ? "flex-col" : "flex-row flex-wrap"
        )}
      >
        {options.map((option) => {
          const id = `${fieldProps.id}-${option.id}`;
          return (
            <FieldLabel
              key={option.id}
              htmlFor={id}
              className={cn(
                "min-h-10 w-full max-w-full items-center gap-3 rounded-lg border border-input bg-card px-4 py-2 text-body has-[:focus-visible]:border-ring has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                // A column fills its rail; a row lets short heads sit together.
                orientation === "row" && "sm:w-auto"
              )}
            >
              <RadioGroupItem id={id} value={option.id} />
              <span className="min-w-0 flex-1 break-words">{option.label}</span>
            </FieldLabel>
          );
        })}
      </RadioGroup>
      <FieldError className="text-body-compact">{error}</FieldError>
    </FieldSet>
  );
}

export function ReviewRow({
  term,
  className,
  children,
}: {
  term: string;
  /** For a caller whose rows sit in a well and need a quieter rule than border. */
  className?: string;
  children: ReactNode;
}) {
  return (
    <DescriptionRow
      className={cn(
        "grid-cols-1 sm:grid-cols-[minmax(8rem,11rem)_1fr]",
        className
      )}
    >
      <DescriptionTerm className="text-body-compact">{term}</DescriptionTerm>
      <DescriptionDetails className="min-w-0 text-body-compact">
        {children}
      </DescriptionDetails>
    </DescriptionRow>
  );
}

/**
 * Footer actions. Save draft sits beside the primary so the two ways forward
 * read as one pair; Cancel (and Back on review) stay on the opposite end.
 * Exactly one bg-primary in this region — Save draft is outline.
 */
export function PrototypeActions({
  review = false,
  reviewLabel,
  finalLabel,
  onBack,
  onCancel,
}: {
  /** Stepped flows pass true on the review step; single-step forms omit it. */
  review?: boolean;
  reviewLabel: string;
  finalLabel?: string;
  onBack?: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          onClick={onCancel}
        >
          Cancel
        </Button>
        {review ? (
          <Button
            type="button"
            variant="ghost"
            className="w-full sm:w-auto"
            onClick={onBack}
          >
            Back
          </Button>
        ) : null}
      </div>

      {review ? (
        <div className="flex flex-col items-stretch gap-1 sm:items-end">
          <Button
            type="button"
            disabled
            aria-describedby="filing-submit-unavailable"
            className="w-full sm:w-auto"
          >
            {finalLabel}
          </Button>
          <p
            id="filing-submit-unavailable"
            className="text-body-compact text-muted-foreground sm:text-right"
          >
            Saving, signing and payment are not connected yet.
          </p>
        </div>
      ) : (
        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            disabled
            className="w-full sm:w-auto"
          >
            Save draft
          </Button>
          <Button type="submit" className="w-full sm:w-auto">
            {reviewLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Closing a filing midway. Where the flow can keep a draft (`onSaveDraft`),
 * saving is the main answer and discarding the second (owner, Sept 24):
 * someone who typed something and closed the dialog more often means "not
 * now" than "throw it away". Without it, the old discard confirmation.
 * Escape and the scrim still mean "keep editing".
 */
export function DiscardFilingDialog({
  open,
  onOpenChange,
  onDiscard,
  onSaveDraft,
  noun = "application",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDiscard: () => void;
  onSaveDraft?: () => void;
  /** What is being filed, for the title: "application", "objection". */
  noun?: string;
}) {
  if (onSaveDraft) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <ChromeAlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save this {noun} as a draft?</AlertDialogTitle>
            <AlertDialogDescription>
              Finish it later from Applications.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button type="button" variant="outline" onClick={onDiscard}>
              Discard
            </Button>
            <Button type="button" onClick={onSaveDraft}>
              Save as draft
            </Button>
          </AlertDialogFooter>
        </ChromeAlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <ChromeAlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard this application?</AlertDialogTitle>
          <AlertDialogDescription>
            Anything you entered will be lost.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep editing</AlertDialogCancel>
          <AlertDialogAction variant="destructive-solid" onClick={onDiscard}>
            Discard
          </AlertDialogAction>
        </AlertDialogFooter>
      </ChromeAlertDialogContent>
    </AlertDialog>
  );
}
