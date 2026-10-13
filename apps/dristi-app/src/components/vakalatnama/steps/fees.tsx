"use client";

/**
 * S7 — fees, the final step. Paid online (no stamps); amounts indicative until verified
 * (PAY-02). Paying completes the vakalatnama: it is sealed with its audit trail and, for
 * a not-yet-filed matter, given its case number.
 */

import * as React from "react";
import { CheckCircle2Icon, InfoIcon } from "lucide-react";

import { FormCard } from "@/components/filing/form-card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { VakalatnamaDocument } from "@/components/vakalatnama/document";
import { updateVak } from "@/lib/vakalatnama/store";
import { reconcileSigners } from "@/lib/vakalatnama/signers";
import { feesTotal, rupee } from "@/lib/vakalatnama/format";
import type { Vakalatnama } from "@/lib/vakalatnama/types";
import { Identifier } from "@/components/chrome/identifier";
import { useCourt } from "@/components/court/court-provider";

function boundNumber(vak: Vakalatnama): string | undefined {
  if (vak.scope.type !== "specific" || vak.scope.caseState !== "not_filed") return undefined;
  const n = (Date.now() % 1_000_000).toString().padStart(6, "0");
  return `KL-${n}-${new Date().getFullYear()}`;
}

function FeeRow({ label, note, amount }: { label: string; note?: string; amount: number }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <div className="flex flex-col">
        <span className="text-body">{label}</span>
        {note ? <span className="text-caption text-muted-foreground">{note}</span> : null}
      </div>
      <span className="text-body font-medium tabular-nums">{rupee(amount)}</span>
    </div>
  );
}

export function FeesStep({ vak: stored }: { vak: Vakalatnama }) {
  /* The vakalatnama carries Kerala's figures from when it was drawn. Another state's
     court (Settings) charges its own — schedules 2 and 3 of the payment logic — so the
     step shows and totals those instead. */
  const { court, profile } = useCourt();
  const vak: Vakalatnama =
    court === "kerala" ? stored : { ...stored, fees: { ...stored.fees, ...profile.fees.join } };
  const total = feesTotal(vak);
  const executed = vak.status === "executed";

  const pay = () =>
    updateVak(vak.id, (p) => ({
      ...p,
      fees: { ...p.fees, paid: true },
      status: "executed",
      boundCaseNumber: p.boundCaseNumber ?? boundNumber(p),
    }));

  if (executed) {
    const board = reconcileSigners(vak);
    return (
      <div className="flex flex-col gap-6">
        <Alert variant="success">
          <CheckCircle2Icon aria-hidden />
          <AlertTitle>Vakalatnama executed</AlertTitle>
          <AlertDescription>
            Fees paid and all parties signed. The instrument is sealed with its audit trail
            {vak.boundCaseNumber ? (
              <>
                {" "}
                and carries case number{" "}
                {/* Inside a `role="alert"` sentence — the face, not a control. */}
                <Identifier value={vak.boundCaseNumber} label="case number" copyable={false} />
              </>
            ) : null}
            . Sandbox — no real payment or signature service was used.
          </AlertDescription>
        </Alert>

        <VakalatnamaDocument vak={vak} />

        <FormCard title="Audit trail" description="What was signed, how, and when.">
          <div className="divide-y divide-hairline">
            {board.map((s) => (
              <div key={s.id} className="flex items-baseline justify-between gap-4 py-2">
                <span className="text-body-compact">{s.label}</span>
                <span className="text-caption tabular-nums text-muted-foreground">
                  {s.method === "upload" ? "Uploaded" : "eSign"}
                  {s.signedAt ? ` · ${new Date(s.signedAt).toLocaleString("en-IN")}` : ""}
                </span>
              </div>
            ))}
          </div>
        </FormCard>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <FormCard title="Fees" description="Paid online — no stamps to affix.">
        <div className="rounded-lg bg-surface-sunken p-4">
          <div className="divide-y divide-hairline">
            <FeeRow label="Court fee" amount={vak.fees.courtFee} />
            <FeeRow
              label="Advocates’ Welfare Fund"
              note="Contribution due on a vakalatnama"
              amount={vak.fees.welfareFund}
            />
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-border pt-3">
            <span className="text-body font-semibold">Total</span>
            <span className="text-title-s font-semibold tabular-nums">{rupee(total)}</span>
          </div>
        </div>

        <Alert>
          <InfoIcon aria-hidden />
          <AlertTitle>Amounts to be confirmed</AlertTitle>
          <AlertDescription>
            These figures are indicative. The court fee and welfare-fund contribution are
            confirmed against the current schedule before filing.
          </AlertDescription>
        </Alert>

        <div className="flex items-center gap-3">
          <Button type="button" onClick={pay}>
            Pay {rupee(total)} &amp; complete
          </Button>
          <span className="text-caption text-muted-foreground">Sandbox — no card needed</span>
        </div>
      </FormCard>
    </div>
  );
}
