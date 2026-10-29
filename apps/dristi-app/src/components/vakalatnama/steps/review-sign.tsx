"use client";

/**
 * S6 — Review & sign, combined into one screen (like the e-filing sign step): the
 * instrument in the column, a signatures panel beside it, and a "Continue to sign"
 * button that opens the same choose → OTP dialog. Signing is multi-party; each party
 * signs in turn. Fees come after, on the next step.
 */

import * as React from "react";
import {
  CheckIcon,
  ChevronRightIcon,
  SignatureIcon,
  UploadIcon,
} from "lucide-react";

import { ChromeDialogContent } from "@/components/chrome/app-chrome";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

import { FormCard } from "@/components/filing/form-card";
import { VakalatnamaDocument } from "@/components/vakalatnama/document";
import { updateVak } from "@/lib/vakalatnama/store";
import { reconcileSigners } from "@/lib/vakalatnama/signers";
import type { SignMethod, Signer, Vakalatnama, VakStatus } from "@/lib/vakalatnama/types";
import { StatusLine } from "@/components/feedback";

type ModalKey = "choose" | "esign" | "processing" | null;

function nextStatus(signers: Signer[]): VakStatus {
  if (signers.every((s) => s.state === "signed")) return "pending_payment";
  const firstWaiting = signers.find((s) => s.state !== "signed");
  if (firstWaiting?.role === "executant") return "pending_executant_sign";
  if (firstWaiting?.role === "advocate") return "pending_advocate_accept";
  return "pending_attestation";
}

export function ReviewSignStep({ vak }: { vak: Vakalatnama }) {
  const board = reconcileSigners(vak);
  const signed = board.filter((s) => s.state === "signed").length;
  const pct = board.length ? Math.round((signed / board.length) * 100) : 0;
  const allSigned = board.length > 0 && signed === board.length;
  const nextSigner = board.find((s) => s.state !== "signed");

  const [modal, setModal] = React.useState<ModalKey>(null);
  const [otp, setOtp] = React.useState("");
  const timer = React.useRef<number | null>(null);

  React.useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    []
  );

  const commit = (signerId: string, method: SignMethod) => {
    updateVak(vak.id, (p) => {
      const current = reconcileSigners(p).map((s) =>
        s.id === signerId
          ? { ...s, state: "signed" as const, method, signedAt: new Date().toISOString() }
          : s
      );
      return { ...p, signing: current, status: nextStatus(current) };
    });
  };

  const uploadAllRemaining = () => {
    updateVak(vak.id, (p) => {
      const current = reconcileSigners(p).map((s) =>
        s.state === "signed"
          ? s
          : { ...s, state: "signed" as const, method: "upload" as const, signedAt: new Date().toISOString() }
      );
      return { ...p, signing: current, status: nextStatus(current) };
    });
    setModal(null);
  };

  const verifyEsign = () => {
    if (!nextSigner || otp.length < 6) return;
    const id = nextSigner.id;
    setModal("processing");
    timer.current = window.setTimeout(() => {
      commit(id, "esign");
      setOtp("");
      setModal(null);
    }, 1400);
  };

  const mobileTail = vak.executant.mobile.replace(/\D/g, "").slice(-4);
  const remaining = board.filter((s) => s.state !== "signed").length;

  return (
    <div className="flex flex-col gap-6">
      {allSigned ? (
        <StatusLine tone="success" title="All signatures collected">
          Every party has signed. Continue to pay the fees and complete the vakalatnama.
        </StatusLine>
      ) : null}

      {/* Signatures panel */}
      <FormCard title="Signatures" contentClassName="gap-5">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-caption font-medium text-muted-foreground tabular-nums">
              {signed} of {board.length} signed
            </span>
            {!allSigned && nextSigner ? (
              <Button type="button" size="sm" onClick={() => setModal("choose")}>
                <SignatureIcon aria-hidden />
                Continue to sign
              </Button>
            ) : null}
          </div>
          <Progress value={pct} aria-label={`${signed} of ${board.length} signed`} className="h-1.5" />
        </div>

        <ul className="flex flex-col">
          {board.map((s, i) => {
            const isSigned = s.state === "signed";
            const isNext = s.id === nextSigner?.id;
            return (
              <li
                key={s.id}
                className="flex items-start gap-3 border-b border-hairline py-3 last:border-b-0"
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-caption font-medium tabular-nums",
                    isSigned
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground"
                  )}
                >
                  {isSigned ? <CheckIcon className="size-3.5" /> : i + 1}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-body-compact font-semibold">{s.label}</span>
                  <span className="text-caption text-muted-foreground">{s.certifies}</span>
                  {isSigned ? (
                    <span className="text-caption text-muted-foreground tabular-nums">
                      {s.method === "upload" ? "Uploaded" : "eSign"}
                      {s.signedAt ? ` · ${new Date(s.signedAt).toLocaleString("en-IN")}` : ""}
                    </span>
                  ) : null}
                </div>
                <span className="mt-px shrink-0">
                  {isSigned ? (
                    <Badge variant="success">
                      <CheckIcon aria-hidden />
                      Signed
                    </Badge>
                  ) : isNext ? (
                    <Badge variant="secondary">Up next</Badge>
                  ) : (
                    <Badge variant="secondary">Waiting</Badge>
                  )}
                </span>
              </li>
            );
          })}
        </ul>

        <p className="text-caption text-muted-foreground">
          Non-Aadhaar eSign. Every signature is recorded with who, how and when.
        </p>
      </FormCard>

      {/* The instrument */}
      <VakalatnamaDocument vak={vak} />

      {/* ── Choose how to sign ── */}
      <Dialog open={modal === "choose"} onOpenChange={(open) => !open && setModal(null)}>
        <ChromeDialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>How will {nextSigner?.label} sign?</DialogTitle>
            <DialogDescription>
              {remaining > 1
                ? `${remaining} signatures still to collect.`
                : "The last signature to collect."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                setOtp("");
                setModal("esign");
              }}
              className="group flex w-full items-start gap-4 rounded-xl border border-border p-4 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span
                aria-hidden
                className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-info-muted text-info-muted-foreground"
              >
                <SignatureIcon className="size-5" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-body font-semibold text-foreground">eSign with OTP</span>
                <span className="text-body-compact text-muted-foreground">
                  A one-time code is sent to the signer’s mobile.
                </span>
              </span>
              <ChevronRightIcon
                aria-hidden
                className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              />
            </button>

            <button
              type="button"
              onClick={uploadAllRemaining}
              className="group flex w-full items-start gap-4 rounded-xl border border-border p-4 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span
                aria-hidden
                className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-warning-muted text-warning-muted-foreground"
              >
                <UploadIcon className="size-5" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-body font-semibold text-foreground">
                  Upload a signed copy
                </span>
                <span className="text-body-compact text-muted-foreground">
                  A copy that already carries {remaining > 1 ? "every remaining signature" : "the signature"}.
                </span>
              </span>
              <ChevronRightIcon
                aria-hidden
                className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              />
            </button>
          </div>
        </ChromeDialogContent>
      </Dialog>

      {/* ── eSign OTP ── */}
      <Dialog open={modal === "esign"} onOpenChange={(open) => !open && setModal(null)}>
        <ChromeDialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Enter the OTP</DialogTitle>
            <DialogDescription>
              {mobileTail ? (
                <>
                  Sent to the mobile ending{" "}
                  <strong className="font-semibold text-foreground tabular-nums">
                    {mobileTail}
                  </strong>
                  .
                </>
              ) : (
                "Sent to the signer’s registered mobile."
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-3 py-2">
            <InputOTP
              maxLength={6}
              value={otp}
              onChange={setOtp}
              aria-label="One-time password"
              containerClassName="gap-2"
              autoFocus
            >
              <InputOTPGroup className="gap-2">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot
                    key={i}
                    index={i}
                    className="size-12 rounded-lg border border-input text-title-s font-semibold tabular-nums"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          <Button type="button" size="lg" className="w-full" disabled={otp.length < 6} onClick={verifyEsign}>
            Verify and sign
          </Button>
        </ChromeDialogContent>
      </Dialog>

      {/* ── Processing ── */}
      <Dialog open={modal === "processing"} onOpenChange={() => {}}>
        <ChromeDialogContent className="sm:max-w-xs" showCloseButton={false}>
          <div className="flex flex-col items-center gap-3 py-4">
            <Spinner className="size-6" />
            <p className="text-body-compact text-muted-foreground">Recording the signature…</p>
          </div>
        </ChromeDialogContent>
      </Dialog>
    </div>
  );
}
