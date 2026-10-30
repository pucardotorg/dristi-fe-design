"use client";

import { useEffect, useRef, useState } from "react";

import { ChromeDialogContent } from "@/components/chrome/app-chrome";

import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionRow,
  DescriptionTerm,
} from "@/components/ui/description-list";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  filingStatusLabel,
  filingStatusVariant,
  type Submission,
} from "@/lib/cases/applications";
import { formatCaseDate } from "@/lib/cases/types";
import { OutcomeHeader } from "@/components/feedback";

/** Dummy court fee, from the legacy portal's payment screen. */
export const COURT_FEE = "₹20";

/**
 * The fee block, shared with Raise application's payment step so the court
 * fee is stated the same way wherever it is asked for. The Nyay Mitra note is
 * part of it: the prototype takes no money, and the offline route is the only
 * one the product has confirmed.
 */
export function CourtFeeSummary() {
  return (
    <div className="flex flex-col gap-4">
      <Banner variant="info">
        Please visit the Nyay Mitra to make this payment offline.
      </Banner>

      {/* The View Case payment dialog's sheet: white, hairline, 14px, figures
          tabular. The dialog around it supplies the well. */}
      <dl className="flex flex-col rounded-lg border border-hairline bg-card px-4 py-1 text-body-compact">
        <div className="flex items-baseline justify-between gap-4 border-b border-hairline py-2.5">
          <dt className="min-w-0 text-muted-foreground">Court fees</dt>
          <dd className="shrink-0 tabular-nums">{COURT_FEE}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 py-2.5 font-semibold">
          <dt>Total</dt>
          <dd className="shrink-0 tabular-nums">{COURT_FEE}</dd>
        </div>
      </dl>
    </div>
  );
}

/**
 * Complete payment for a filing already in the register — the same step Raise
 * application shows after signing, reached from the filing that owes the fee
 * rather than from the end of the filing chain.
 *
 * Only one filing at a time: the fee is per filing, so a paid confirmation
 * over a set would state a total the register cannot yet compute (see
 * BATCH_ACTIONS). Paying is what finishes the electronic workflow, so the
 * filing lands in Completed — the court's own answer is a separate thing the
 * record dialog carries when an order exists.
 */
export function SubmissionPaymentDialog({
  submission,
  onOpenChange,
  onPaid,
}: {
  submission: Submission | null;
  onOpenChange: (submission: Submission | null) => void;
  /** The fee is settled — the register moves this filing on from the well. */
  onPaid: (submissionId: string) => void;
}) {
  return (
    <Dialog
      open={submission !== null}
      onOpenChange={(next) => {
        if (!next) onOpenChange(null);
      }}
    >
      {submission ? (
        <PaymentBody
          key={submission.id}
          submission={submission}
          onPaid={onPaid}
          onClose={() => onOpenChange(null)}
        />
      ) : null}
    </Dialog>
  );
}

function PaymentBody({
  submission,
  onPaid,
  onClose,
}: {
  submission: Submission;
  onPaid: (submissionId: string) => void;
  onClose: () => void;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [paid, setPaid] = useState(false);

  /**
   * The confirmation replaces the dialog's content wholesale; landing focus
   * on the title is what announces it. Initial open keeps Radix's own focus
   * handling — this only runs once the fee is marked paid.
   */
  useEffect(() => {
    if (paid) titleRef.current?.focus();
  }, [paid]);

  function finish() {
    onPaid(submission.id);
    onClose();
  }

  return (
    <ChromeDialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
      {paid ? (
        /* The payment's outcome takes the window over (skill `feedback-states`); the
           negative inset carries the band to the dialog's edges. */
        <OutcomeHeader
          compact
          titleFrom="dialog"
          focusTitle
          className="-mx-6 -mt-6"
          title="Payment"
          body={<>Court fee of {COURT_FEE} paid.</>}
        >
          <Badge variant="success">Paid</Badge>
          <span className="pt-1 text-body-compact text-muted-foreground">{submission.title}</span>
        </OutcomeHeader>
      ) : (
      <DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <DialogTitle
            ref={titleRef}
            tabIndex={-1}
            className="text-title-s font-semibold outline-none"
          >
            Payment
          </DialogTitle>
          <Badge
            variant={paid ? "success" : filingStatusVariant(submission.status)}
          >
            {paid ? "Paid" : filingStatusLabel(submission.status)}
          </Badge>
        </div>
        <DialogDescription className="text-body-compact">
          {submission.title}
        </DialogDescription>
      </DialogHeader>
      )}

      {paid ? (
        <div className="flex flex-col gap-4">
          <DescriptionList className="rounded-lg bg-surface-sunken px-4 py-1">
            <DescriptionRow className="grid-cols-[1fr_auto] items-center border-hairline">
              <DescriptionTerm className="text-body">
                Payment date
              </DescriptionTerm>
              <DescriptionDetails className="text-body">
                {formatCaseDate(new Date().toISOString())}
              </DescriptionDetails>
            </DescriptionRow>
            <DescriptionRow className="grid-cols-[1fr_auto] items-center">
              <DescriptionTerm className="text-body">
                Filing status
              </DescriptionTerm>
              <DescriptionDetails className="text-body font-medium">
                Completed
              </DescriptionDetails>
            </DescriptionRow>
          </DescriptionList>
        </div>
      ) : (
        <CourtFeeSummary />
      )}

      <DialogFooter>
        {paid ? (
          <Button type="button" onClick={finish}>
            Done
          </Button>
        ) : (
          <>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" onClick={() => setPaid(true)}>
              Make payment
            </Button>
          </>
        )}
      </DialogFooter>
    </ChromeDialogContent>
  );
}
