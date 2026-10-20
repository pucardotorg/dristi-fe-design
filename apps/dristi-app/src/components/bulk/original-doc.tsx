"use client";

import * as React from "react";
import { DownloadIcon, FileTextIcon, Maximize2Icon } from "lucide-react";

import { formatBytes } from "@/lib/filing/files";
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
  variant = "link",
}: {
  original: { file: StoredFileRef; text: string | null };
  /** "tile": a small page of the document itself, where there is room; "link": in a line of text. */
  variant?: "tile" | "link";
}) {
  const [open, setOpen] = React.useState(false);
  const pdf = original.file.type === "application/pdf";
  // The opening of the document, for the page in the tile.
  const opening = (original.text ?? "").slice(0, 600);
  return (
    <>
      {variant === "tile" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Open the original document, ${original.file.name}`}
          className="group flex w-full max-w-64 items-center gap-3 rounded-lg border border-hairline bg-card p-2 pr-3 text-left transition-[border-color,box-shadow] hover:border-primary hover:shadow-raised focus-visible:ring-3 focus-visible:ring-focus-ring focus-visible:outline-none"
        >
          {/* The first page in miniature, with a folded corner: it reads as the paper itself. */}
          <span
            aria-hidden
            className="relative h-16 w-12 shrink-0 overflow-hidden rounded-xs border border-hairline bg-card shadow-sm transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:-rotate-2 motion-reduce:transition-none"
          >
            {opening ? (
              <span className="block p-1 text-[3px] leading-[4px] break-words whitespace-pre-wrap text-muted-foreground">
                {opening}
              </span>
            ) : (
              <span className="flex flex-col gap-0.5 p-1.5">
                {[100, 80, 90, 60, 85, 70, 95, 50].map((w, i) => (
                  <span
                    key={i}
                    className="h-0.5 rounded-full bg-track"
                    style={{ width: `${w}%` }}
                  />
                ))}
              </span>
            )}
            <span className="absolute top-0 right-0 size-2.5 rounded-bl-xs border-b border-l border-hairline bg-surface-sunken" />
            <span className="absolute right-0.5 bottom-0.5 rounded-xs bg-primary px-0.5 text-[6px] leading-[8px] font-semibold text-primary-foreground">
              {original.file.ext}
            </span>
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-body-compact font-medium">
              Original document
            </span>
            <span className="truncate text-caption text-muted-foreground">
              {original.file.name}
            </span>
            <span className="text-caption text-muted-foreground tabular-nums">
              {formatBytes(original.file.size)}
            </span>
          </span>
          <Maximize2Icon
            className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
            aria-hidden
          />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 text-primary underline underline-offset-2 hover:no-underline focus-visible:ring-3 focus-visible:ring-focus-ring focus-visible:outline-none"
        >
          <FileTextIcon className="size-3.5" aria-hidden />
          Original document
        </button>
      )}
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
