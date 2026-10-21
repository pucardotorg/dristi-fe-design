"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { ArrowLeftIcon } from "lucide-react";

import {
  HearingDetail,
  HearingsList,
} from "@/components/cases/hearings-register";
import { useRecentRow } from "@/components/cases/register-controls";
import { FlowDialogContent } from "@/components/chrome/flow-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { hearingRecords } from "@/lib/cases/hearing-record";
import { orderHref } from "@/lib/cases/sections";
import type { CaseRecord } from "@/lib/cases/types";
import { Identifier } from "@/components/chrome/identifier";

/**
 * The hearings pop-up (§5.4), opened from Overview's "View All Hearings". One
 * dialog, two steps: the list, then one hearing. Close, Escape, a click outside
 * and the back control all step out of the hearing first; from the list they
 * close the dialog.
 */
export function CaseHearingsDialog({
  record,
  open,
  onOpenChange,
  triggerRef,
  initialHearingId = null,
}: {
  record: CaseRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerRef: RefObject<HTMLAnchorElement | null>;
  /** Opens straight onto one hearing, for a link that names it. */
  initialHearingId?: string | null;
}) {
  const hearings = useMemo(() => hearingRecords(record), [record]);
  const [openId, setOpenId] = useState<string | null>(initialHearingId);
  const openHearing = hearings.find((item) => item.id === openId) ?? null;
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const { recentId, markRecent, recentRowRef } = useRecentRow();

  /* Stepping back marks the row only for the hearing a link opened (a process
     round's linked hearing): that reader never saw the list, so the mark shows
     where the hearing sits in it. A row they opened themselves needs none
     (owner, Sept 18). */
  function stepBack() {
    if (openId !== null && openId === initialHearingId) markRecent(openId);
    setOpenId(null);
  }

  /* A step change inside one dialog is invisible to a screen reader, so the
     hearing's heading takes focus on arrival (ACCESSIBILITY 5). */
  useEffect(() => {
    if (open && openId) headingRef.current?.focus();
  }, [open, openId]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        /* Closing a hearing steps back to the list it belongs to, with its row
           marked, so the reader sees where it sits among the others. Closing
           the list closes the pop-up. */
        if (!next && openHearing) {
          stepBack();
          return;
        }
        onOpenChange(next);
      }}
    >
      <FlowDialogContent
        className="flex max-h-[calc(100dvh---spacing(12))] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
        onCloseAutoFocus={(event) => {
          const trigger = triggerRef.current;
          if (!trigger?.isConnected) return;
          event.preventDefault();
          trigger.focus();
        }}
        onEscapeKeyDown={(event) => {
          if (!openHearing) return;
          event.preventDefault();
          stepBack();
        }}
      >
        <DialogHeader className="gap-1 border-b border-hairline px-6 py-4 text-left">
          <DialogTitle className="text-title-s font-semibold">
            Hearings
          </DialogTitle>
          <p className="text-caption font-medium text-muted-foreground">
            <Identifier value={record.caseNumber} label="case number" />
          </p>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
          {openHearing ? (
            <HearingDetail
              hearing={openHearing}
              orderHref={
                openHearing.order
                  ? orderHref(record.id, openHearing.order.id)
                  : undefined
              }
              headingRef={headingRef}
            />
          ) : (
            <HearingsList
              hearings={hearings}
              onOpen={(hearing) => setOpenId(hearing.id)}
              recentId={recentId}
              recentRowRef={recentRowRef}
            />
          )}
        </div>
        {/* The way back is the footer's left, as in every other stepped dialog. */}
        {openHearing ? (
          <DialogFooter className="mx-0 mb-0 shrink-0 sm:justify-start">
            <Button type="button" variant="outline" onClick={stepBack}>
              <ArrowLeftIcon data-icon="inline-start" aria-hidden />
              All hearings
            </Button>
          </DialogFooter>
        ) : null}
      </FlowDialogContent>
    </Dialog>
  );
}
