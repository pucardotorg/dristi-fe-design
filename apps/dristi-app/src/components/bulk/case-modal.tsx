"use client";

import * as React from "react";

import { ChromeDialogContent } from "@/components/chrome/app-chrome";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";

import type { BatchView } from "./api";
import { CaseWorkspace } from "./case-workspace";

/**
 * A batch's cases in a window, one at a time: Details to edit, Review to read the case as
 * the single filing shows it, previous and next to move through the batch. Fixed height,
 * so moving between cases never resizes it.
 */
export function CaseModal({
  batch,
  setBatch,
  index,
  onIndex,
}: {
  batch: BatchView;
  setBatch: (b: BatchView) => void;
  /** The case on screen (its place in `batch.cases`), or `null` when closed. */
  index: number | null;
  onIndex: (index: number | null) => void;
}) {
  return (
    <Dialog open={index !== null} onOpenChange={(v) => !v && onIndex(null)}>
      <ChromeDialogContent className="flex h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogDescription className="sr-only">
          One case of the batch. Use the arrow keys to move between cases.
        </DialogDescription>
        {index !== null ? (
          <CaseWorkspace
            batch={batch}
            setBatch={setBatch}
            index={index}
            onIndex={onIndex}
            title={(t) => (
              <DialogTitle className="truncate text-title-s font-semibold">
                {t}
              </DialogTitle>
            )}
            className="h-full"
          />
        ) : null}
      </ChromeDialogContent>
    </Dialog>
  );
}
