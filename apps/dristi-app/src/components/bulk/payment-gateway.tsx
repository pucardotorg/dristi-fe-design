"use client";

import * as React from "react";

import { money } from "@/lib/filing/format";
import { DELIVERY_CHANNEL } from "@/lib/filing/options";
import { StatusLine } from "@/components/feedback";
import {
  PAYMENT_PROCESSING_BODY,
  PAYMENT_PROCESSING_TITLE,
} from "@/components/payment/payment-steps";
import { Button } from "@/components/ui/button";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

/** The court the bulk demo files in: every batch is Gujarat's (`FEES = GUJARAT_FEES`). */
const COURT = "SARAS Court, Ahmedabad";

/** One part of the fee across the cases being paid for. */
export type FeePart = {
  key: "court" | "condonation" | "process" | "delivery";
  label: string;
  sum: number;
  /** How many of the cases pay it. */
  n: number;
  /** The one rate every case pays, or `null` when it varies. */
  rate: number | null;
};

const cases = (n: number) => `${n} ${n === 1 ? "case" : "cases"}`;

/** "₹27 × 197 cases", or just the count when the rate varies by case. */
const basis = (p: FeePart) => `${p.rate !== null ? `${money(p.rate)} × ` : ""}${cases(p.n)}`;

/**
 * A group of the bill, as e-filing's `FeeGroup` draws it: a sunken well with the group's
 * name and total, its lines below; `summary` is the name and total alone.
 */
function FeeWell({
  title,
  total,
  lines,
}: {
  title: React.ReactNode;
  total: number;
  lines?: FeePart[];
}) {
  // A group of one line says its basis beside the name, not the same sum twice.
  const only = lines?.length === 1 ? lines[0] : null;
  if (!lines || only) {
    return (
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-sunken p-4">
        <h3 className="text-body-compact font-semibold text-foreground">
          {title}
          {only ? (
            <span className="font-normal text-muted-foreground tabular-nums"> · {basis(only)}</span>
          ) : null}
        </h3>
        <span className="text-body-compact font-semibold tabular-nums">{money(total)}</span>
      </div>
    );
  }
  return (
    <div className="flex shrink-0 flex-col gap-3 rounded-lg bg-surface-sunken p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-body-compact font-semibold text-foreground">{title}</h3>
        <span className="text-body-compact font-semibold tabular-nums">{money(total)}</span>
      </div>
      <dl className="flex flex-col divide-y divide-hairline">
        {lines.map((line) => (
          <div key={line.key} className="flex items-baseline justify-between gap-4 py-2">
            <dt className="min-w-0 text-body-compact text-foreground">
              {line.label}
              <span className="text-muted-foreground tabular-nums"> · {basis(line)}</span>
            </dt>
            <dd className="shrink-0 text-body-compact font-medium tabular-nums">
              {money(line.sum)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * Pay court fees, as individual e-filing asks it (`sign-section`): the window's title and
 * whom it is payable to, the bill in the same groups, "Payable now", and one Pay button.
 * Fitted to a batch: one court, the fee summed over the cases being paid for.
 */
export function PayCourtFees({
  amount,
  count,
  parts,
  unexplained,
  error,
  onPay,
}: {
  amount: number;
  count: number;
  parts: FeePart[];
  /** Fees recorded before the parts existed: shown as one sum. */
  unexplained: number;
  error: string | null;
  onPay: () => void;
}) {
  const court = parts.filter((p) => p.key === "court" || p.key === "condonation");
  const process = parts.find((p) => p.key === "process");
  const delivery = parts.find((p) => p.key === "delivery");
  return (
    <>
      <DialogHeader>
        <DialogTitle>Pay court fees</DialogTitle>
        <DialogDescription>
          Payable to the {COURT} for <span className="tabular-nums">{cases(count)}</span>.
        </DialogDescription>
      </DialogHeader>

      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
        {court.length ? (
          <FeeWell
            title="Court fees"
            total={court.reduce((n, p) => n + p.sum, 0)}
            lines={court}
          />
        ) : null}
        {process ? <FeeWell title="Process fees" total={process.sum} /> : null}
        {delivery ? (
          <FeeWell title={`Delivery of summons · ${DELIVERY_CHANNEL}`} total={delivery.sum} />
        ) : null}
        {unexplained > 0 ? <FeeWell title="Fees" total={unexplained} /> : null}
      </div>

      <div className="flex items-baseline justify-between gap-4 border-t border-hairline pt-4">
        <span className="text-body font-semibold">Payable now</span>
        <span className="text-title-s font-semibold tabular-nums">{money(amount)}</span>
      </div>

      {error ? <StatusLine tone="error">{error}</StatusLine> : null}

      <Button type="button" size="lg" className="w-full" onClick={onPay}>
        Pay {money(amount)} online
      </Button>
    </>
  );
}

/** The gateway round trip, as e-filing's processing window says it. */
export function PayProcessing() {
  return (
    <div role="status" className="flex flex-col items-center gap-4 py-6 text-center">
      <Spinner className="size-8 text-primary" />
      <DialogTitle className="text-title-s font-semibold">
        {PAYMENT_PROCESSING_TITLE}
      </DialogTitle>
      <DialogDescription className="text-body-compact">
        {PAYMENT_PROCESSING_BODY}
      </DialogDescription>
    </div>
  );
}
