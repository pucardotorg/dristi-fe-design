"use client";

/**
 * The Add-people dialogs' upload control.
 *
 * Empty = the DS DocumentSlot (dashed target, Choose file). Filled = the DS
 * Attachment row, the same grammar the e-filing shared forms use: thumbnail
 * (tap for the full-screen preview), label over filename and size centred
 * beside it, and Change/Remove riding the row's right edge instead of a
 * second line under the box (owner's call, Sept 1 — the right side was dead
 * space and the slot's top-aligned text read off-balance).
 */

import * as React from "react";
import { Maximize2Icon } from "lucide-react";

import {
  Attachment,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment";
import { Button } from "@/components/ui/button";
import { DocumentSlot } from "@/components/ui/document-slot";
import type { Locale } from "@/lib/onboarding/content";
import {
  DocumentPreviewDialog,
  DocumentThumbnailButton,
  useObjectUrl,
} from "@/components/document-preview";

export const MAX_FILE_SIZE = 10 * 1024 * 1024;

export const UPLOAD_HELP = "Upload a JPG, JPEG, PNG or PDF up to 10 MB.";

function fileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * A review row's document value: the filename with an enlarge control
 * opening the full-screen preview (PM, Sept 2 — a bare name in review gave
 * no way back to what was attached).
 */
export function ReviewDocValue({ file }: { file: File | null }) {
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const url = useObjectUrl(file);
  if (!file) return null;
  return (
    <span className="flex min-w-0 items-center gap-1">
      <span className="min-w-0 truncate">{file.name}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="shrink-0 text-muted-foreground"
        aria-label={`View ${file.name}`}
        onClick={() => setPreviewOpen(true)}
      >
        <Maximize2Icon aria-hidden />
      </Button>
      <DocumentPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        file={file}
        url={url}
        locale="en"
        copy={{
          title: file.name,
          description: "Check the document is readable before continuing.",
          alt: file.name,
        }}
      />
    </span>
  );
}

export function UploadedDocField({
  label,
  required = false,
  file,
  onFileChange,
  copy,
  locale = "en",
}: {
  label: string;
  required?: boolean;
  file: File | null;
  onFileChange: (file: File | null) => void;
  /** Bilingual hosts (registration, bail) pass their own strings; the case
      flows' English defaults stand otherwise. */
  copy?: {
    changeFile?: string;
    remove?: string;
    noFile?: string;
    chooseFile?: string;
    optional?: string;
    previewDescription?: string;
    previewAlt?: string;
  };
  /** The preview's language, for a host that speaks the viewer's. */
  locale?: Locale;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const url = useObjectUrl(file);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
        onChange={(event) => {
          const next = event.target.files?.[0];
          if (next && next.size <= MAX_FILE_SIZE) onFileChange(next);
          // The same file can be picked again after a remove.
          event.target.value = "";
        }}
      />
      {file ? (
        <Attachment className="w-full">
          <AttachmentMedia className="w-14">
            <DocumentThumbnailButton
              file={file}
              url={url}
              locale={locale}
              onOpen={() => setPreviewOpen(true)}
              className="size-full rounded-md"
            />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>{label}</AttachmentTitle>
            <AttachmentDescription>
              {file.name} · {fileSize(file.size)}
            </AttachmentDescription>
          </AttachmentContent>
          {/* The join flow's own Change file / Remove link pair, riding
              the row's right edge rather than a line under the box
              (owner, Sept 1). */}
          <AttachmentActions className="gap-4 pr-2">
            <Button
              type="button"
              variant="link"
              className="h-auto p-0"
              onClick={() => inputRef.current?.click()}
            >
              {copy?.changeFile ?? "Change file"}
            </Button>
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-destructive-ink"
              onClick={() => onFileChange(null)}
            >
              {copy?.remove ?? "Remove"}
            </Button>
          </AttachmentActions>
        </Attachment>
      ) : (
        <DocumentSlot
          status="empty"
          media="icon"
          label={label}
          required={required}
          onChooseFile={() => inputRef.current?.click()}
          copy={
            copy?.noFile || copy?.chooseFile || copy?.optional
              ? {
                  noFile: copy.noFile,
                  chooseFile: copy.chooseFile,
                  optional: copy.optional,
                }
              : undefined
          }
        />
      )}
      <DocumentPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        file={file}
        url={url}
        locale={locale}
        copy={{
          title: label,
          description:
            copy?.previewDescription ??
            "Check the document is readable before continuing.",
          alt: copy?.previewAlt ?? label,
        }}
      />
    </>
  );
}

/**
 * Choose a new file for something already filed but not yet signed (a memo,
 * an affidavit). The upload row's own picker and limits, as a button.
 */
export function ReplaceFileButton({
  onFile,
  label = "Replace file",
  className,
}: {
  onFile: (file: File) => void;
  label?: string;
  className?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
        onChange={(event) => {
          const next = event.target.files?.[0];
          if (next && next.size <= MAX_FILE_SIZE) onFile(next);
          event.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        className={className}
        onClick={() => inputRef.current?.click()}
      >
        {label}
      </Button>
    </>
  );
}

