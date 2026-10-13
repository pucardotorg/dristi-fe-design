"use client";

import * as React from "react";
import { CheckIcon, PenToolIcon, WalletIcon } from "lucide-react";

import { getRepository, newCaseFileNumber, newPaymentRef } from "@/lib/filing/data";
import { money } from "@/lib/filing/format";
import { DELIVERY_CHANNEL } from "@/lib/filing/options";
import type { QueueRow } from "@/lib/filing/queue";
import { feeBill, signatories, signingComplete } from "@/lib/filing/selectors";
import type { UserProfile } from "@/lib/filing/types";
import { ChromeDialogContent } from "@/components/chrome/app-chrome";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useCourt } from "@/components/court/court-provider";

type Kind = "sign" | "pay";

/**
 * Bulk sign or bulk pay over the filings queue's own selection — one OTP, or one
 * transaction, across every ticked row, exactly the mechanics `sign-section.tsx` already
 * runs per draft (the same OTP sandbox, the same fields written on payment). Nothing
 * here is a second way either act can happen; this only lets it happen over a set.
 *
 * Each draft still closes on its own write, so a row that no longer qualifies — signed
 * or paid elsewhere while this was open — is simply skipped rather than left half-done.
 * There is no partial-failure branch to report, because neither underlying flow has one
 * to reuse: the single-draft OTP and the single-draft payment both always go through.
 */
export function BatchFilingDialog({
  kind,
  rows,
  profile,
  open,
  onOpenChange,
  onFinished,
}: {
  kind: Kind | null;
  rows: QueueRow[];
  profile: UserProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The batch went through (however many rows actually qualified) and can be reread. */
  onFinished: () => void;
}) {
  const courtFees = useCourt().profile.fees;
  const [step, setStep] = React.useState<"confirm" | "success">("confirm");
  const [running, setRunning] = React.useState(false);
  const [otp, setOtp] = React.useState("");
  const [acted, setActed] = React.useState(0);
  /** Filings signed here that still wait on your oath — it cannot be batched. */
  const [sworeLater, setSworeLater] = React.useState(0);
  /* Adjusted during render, not an effect — this derives from a prop change rather than
     synchronising with anything outside React (see the same pattern in BatchActDialog). */
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setStep("confirm");
      setOtp("");
      setActed(0);
      setSworeLater(0);
    }
  }

  const n = rows.length;
  const one = n === 1;
  const total = rows.reduce((sum, row) => sum + (row.amount ?? 0), 0);

  const run = async () => {
    setRunning(true);
    const repo = getRepository();
    const now = new Date().toISOString();
    let done = 0;
    let oathsOwed = 0;
    for (const row of rows) {
      const draft = await repo.getDraft(row.id);
      if (!draft) continue;
      if (kind === "sign") {
        const { complainants, advocates } = signatories(draft, profile);
        const yours = [...complainants, ...advocates].filter(
          (s) => s.you && s.status === "pending"
        );
        if (!yours.length) continue;
        for (const s of yours) draft.sign.signed[s.id] = { at: now, with: "aadhaar" };
        if (yours.some((s) => s.oathTaken === false)) oathsOwed += 1;
      } else {
        // Every signature and every advocate's oath — an oath cannot be batched.
        if (!signingComplete(draft, profile) || draft.sign.paid) continue;
        const bill = feeBill(draft, courtFees);
        draft.sign.paid = true;
        draft.sign.paidAt = now;
        draft.sign.paidAmount = bill.total;
        draft.sign.paymentRef = newPaymentRef();
        draft.sign.caseFileNumber = newCaseFileNumber();
        draft.sign.deliveryChannel = DELIVERY_CHANNEL;
        draft.status = "filed";
        draft.filedAt = now;
      }
      draft.updatedAt = now;
      await repo.putDraft(draft);
      done += 1;
    }
    setActed(done);
    setSworeLater(oathsOwed);
    setRunning(false);
    setStep("success");
  };

  const close = () => {
    if (running) return;
    onOpenChange(false);
    if (step === "success") onFinished();
  };

  return (
    <Dialog
      open={open && !!kind && n > 0}
      onOpenChange={(next) => (next ? undefined : close())}
    >
      <ChromeDialogContent mobileSheet
        className="sm:max-w-md"
        showCloseButton={step === "confirm" && !running}
        onEscapeKeyDown={(e) => running && e.preventDefault()}
        onPointerDownOutside={(e) => running && e.preventDefault()}
        onInteractOutside={(e) => running && e.preventDefault()}
      >
        {!kind ? null : step === "confirm" ? (
          <>
            <DialogHeader>
              <DialogTitle className="tabular-nums">
                {kind === "sign"
                  ? one
                    ? "Sign this document?"
                    : `Sign ${n} documents?`
                  : one
                    ? `Pay ${money(total)}?`
                    : `Pay ${money(total)} for ${n} filings?`}
              </DialogTitle>
              <DialogDescription>
                {kind === "sign"
                  ? one
                    ? "Signed as you, and attached to this filing."
                    : `One OTP signs all ${n}, as you. Each filing closes on its own signature.`
                  : one
                    ? "Charged now, against this filing's own bill."
                    : `One transaction across ${n} filings, each charged its own bill.`}
              </DialogDescription>
            </DialogHeader>

            {kind === "sign" ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="batch-filing-otp" className="text-body-compact font-medium">
                  Aadhaar OTP
                </Label>
                <InputOTP
                  id="batch-filing-otp"
                  maxLength={6}
                  value={otp}
                  onChange={setOtp}
                  containerClassName="gap-2"
                >
                  <InputOTPGroup className="gap-2">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot
                        key={i}
                        index={i}
                        className="size-10 rounded-lg border border-input"
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
                <p className="text-caption text-muted-foreground">
                  Sandbox — any six digits work.
                </p>
              </div>
            ) : (
              <p className="text-caption text-muted-foreground">
                Sandbox payment — no money moves.
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" disabled={running} onClick={close}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={running || (kind === "sign" && otp.length < 6)}
                aria-busy={running || undefined}
                onClick={() => void run()}
                className="tabular-nums"
              >
                {running ? (
                  <>
                    <Spinner data-icon="inline-start" aria-hidden />
                    {kind === "sign" ? "Signing…" : "Paying…"}
                  </>
                ) : kind === "sign" ? (
                  <>
                    <PenToolIcon data-icon="inline-start" aria-hidden />
                    {one ? "Sign" : `Sign ${n} documents`}
                  </>
                ) : (
                  <>
                    <WalletIcon data-icon="inline-start" aria-hidden />
                    Pay {money(total)}
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            {/* The product's confirmation panel (see BatchActDialog): the verb the
                question asked, answered, with the tick under it. The act's own control
                stays off this fill — an outline button reads as white-on-white against
                the success background, which is exactly why the primitive draws its own
                opaque fill instead of inheriting one. */}
            <div className="flex flex-col items-center gap-4 rounded-lg bg-success p-6 text-center">
              <div className="flex flex-col gap-1.5">
                <DialogTitle className="text-title-s font-semibold tabular-nums text-success-foreground">
                  {kind === "sign"
                    ? acted === 0
                      ? "Nothing was signed"
                      : acted === 1
                        ? "Document signed"
                        : `${acted} documents signed`
                    : acted === 0
                      ? "Nothing was paid"
                      : `${money(total)} paid`}
                </DialogTitle>
                <DialogDescription className="text-body-compact text-pretty text-success-foreground">
                  {kind === "sign"
                    ? sworeLater > 0
                      ? acted === 1
                        ? "Your oath is still to be taken on this filing. Open it from this tab to record it."
                        : sworeLater === 1
                          ? "Your oath is still to be taken on one of them. Open it from this tab to record it."
                          : `Your oath is still to be taken on ${sworeLater} of them. Open each from this tab to record it.`
                      : "One OTP covered the set, the same as signing one at a time. A filing still waiting on another party stays on this tab until they sign."
                    : "This is a sandbox — nothing has been sent to a real court."}
                </DialogDescription>
              </div>
              <span className="flex size-10 items-center justify-center rounded-full bg-success-foreground">
                <CheckIcon className="size-6 text-success" aria-hidden />
              </span>
            </div>
            <DialogFooter>
              <Button type="button" onClick={close}>
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </ChromeDialogContent>
    </Dialog>
  );
}
