"use client";

import * as React from "react";
import { CheckIcon } from "lucide-react";

import {
  DescriptionDetails,
  DescriptionList,
  DescriptionRow,
  DescriptionTerm,
} from "@/components/ui/description-list";
import { Spinner } from "@/components/ui/spinner";

/**
 * The two screens every payment passes through after Pay, shared so a fee reads the same
 * wherever it is paid: joining a case, a bail application, any application raised on a
 * case (owner, 2026-10-12: "reuse that wherever you can"). The window around them owns
 * the title ("Processing payment…", "Payment successful") and the buttons; these are the
 * bodies.
 *
 * e-filing's own court-fee payment (`sign-section`) is the pattern these follow.
 */

export const PAYMENT_PROCESSING_TITLE = "Processing payment…";
export const PAYMENT_PROCESSING_BODY =
  "Please don't close or refresh this window while we confirm your payment.";
export const PAYMENT_SUCCESS_TITLE = "Payment successful";

/** How long the sandbox gateway takes to answer — e-filing's figure. */
export const GATEWAY_MS = 2600;

/** The gateway round trip: a spinner, and the sandbox said in place. */
export function PaymentProcessing({ note = "Sandbox payment. No money moves." }: { note?: string }) {
  return (
    <div role="status" className="flex min-h-32 flex-col items-center justify-center gap-3 text-center">
      <Spinner className="size-8 text-primary" />
      <p className="text-body-compact text-muted-foreground">{note}</p>
    </div>
  );
}

/** The receipt: the amount under a tick, then what was paid for and its reference. */
export function PaymentReceipt({
  amount,
  rows,
}: {
  amount: string;
  rows: { label: string; value: React.ReactNode }[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-success text-success-foreground">
          <CheckIcon className="size-6" aria-hidden />
        </span>
        <p className="text-title-s font-semibold tabular-nums">{amount}</p>
      </div>
      <DescriptionList className="rounded-xl bg-surface-sunken px-4 py-1">
        {rows.map((row) => (
          <DescriptionRow key={row.label} className="border-hairline">
            <DescriptionTerm>{row.label}</DescriptionTerm>
            <DescriptionDetails>{row.value}</DescriptionDetails>
          </DescriptionRow>
        ))}
      </DescriptionList>
    </div>
  );
}
