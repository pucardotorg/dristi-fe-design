"use client";

import * as React from "react";
import { DownloadIcon, FileTextIcon } from "lucide-react";

import type { StoredFileRef } from "@/lib/filing/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

import { fileUrl } from "./api";

/**
 * The document a case was read from, one click away: a PDF as itself, a Word file as its
 * text (browsers cannot show Word), with the file to download either way.
 */
export function OriginalDoc({
  original,
}: {
  original: { file: StoredFileRef; text: string | null };
}) {
  const [open, setOpen] = React.useState(false);
  const pdf = original.file.type === "application/pdf";
  return (
    <>
      <Button
        type="button"
        variant="link"
        size="sm"
        className="h-auto w-fit p-0"
        onClick={() => setOpen(true)}
      >
        <FileTextIcon data-icon="inline-start" aria-hidden />
        Original document
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[85dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <div className="flex shrink-0 items-center gap-3 border-b border-hairline px-6 py-4 pr-12">
            <div className="flex min-w-0 flex-1 flex-col">
              <DialogTitle className="truncate text-body font-semibold">
                {original.file.name}
              </DialogTitle>
              <DialogDescription className="sr-only">
                The document this case was read from
              </DialogDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <a href={fileUrl(original.file.id)} download={original.file.name}>
                <DownloadIcon data-icon="inline-start" aria-hidden />
                Download
              </a>
            </Button>
          </div>
          {pdf ? (
            <iframe
              src={fileUrl(original.file.id)}
              title={original.file.name}
              className="min-h-0 flex-1 bg-surface-sunken"
            />
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto bg-surface-sunken p-4 sm:p-6">
              <div className="mx-auto max-w-2xl rounded-lg border border-hairline bg-card p-6 text-body-compact whitespace-pre-wrap shadow-raised">
                {original.text?.trim() || "This document has no readable text."}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
