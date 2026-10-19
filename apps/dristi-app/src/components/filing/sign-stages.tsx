"use client";

/**
 * The parts every signing window is built from — the filer's own (`sign-flow-dialog`)
 * and the one a signatory reaches from their link (`/sign`). Both ask the same
 * questions the same way, so the cards, the OTP entry and the settled roster live here
 * once rather than drifting apart in two copies.
 */

import * as React from "react";
import {
  CheckIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  ShieldCheckIcon,
  SignatureIcon,
} from "lucide-react";

import type { Signatory } from "@/lib/filing/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Spinner } from "@/components/ui/spinner";
import { Stepper, StepperItem } from "@/components/ui/stepper";
import { RESOLVE_IN_PLACE } from "@/components/chrome/motion";

/**
 * A stage's column: reading width, at the top of the canvas.
 *
 * No floor under the canvas and no vertical centring in it. The frame's `floor` holds a
 * short stage at a comfortable height so the window does not resize between stages —
 * right where the stages are of a size, wrong here, where "two cards" and "a file plus a
 * roster of OTP rows" are not. Centring 220px of cards in 448px of canvas left a band of
 * empty tint above and below them, which is what the owner read as the padding being off
 * (2026-09-24). Each stage takes its own height now, with the same 24px around it.
 */
export function StageColumn({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">{children}</div>
  );
}

/**
 * **What just happened, on the thing it happened to.**
 *
 * The product settles an act by stamping the record it acted on — a status strip across
 * the top of the card in the status's own muted pair, with the roster underneath — rather
 * than by swapping the stage for a green box (`approve-registrations-dialog`'s
 * `StatusStrip`, owner-approved 2026-09-11). A signature's record is who has signed and
 * who has not, so that is what the card carries.
 */
export function SettledCard({
  headline,
  rows,
  footnote,
}: {
  headline: string;
  rows: Signatory[];
  footnote: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-hairline bg-card shadow-raised",
        RESOLVE_IN_PLACE
      )}
    >
      <div className="flex items-center gap-2 bg-success-muted px-4 py-2.5 text-body-compact text-success-muted-foreground">
        <CircleCheckIcon aria-hidden className="size-4 shrink-0" />
        {/* `role="status"` gets the outcome spoken: focus lands on the header title,
            which announces itself and nothing below it. */}
        <span role="status" className="font-medium">
          {headline}
        </span>
      </div>

      <ul className="flex flex-col px-4">
        {rows.map((s) => (
          <li
            key={s.id}
            className="flex items-center gap-3 border-b border-hairline py-3 last:border-b-0"
          >
            <div className="min-w-0 flex-1">
              <p className="text-body-compact font-semibold text-foreground">
                {s.name}
                {s.you ? (
                  <span className="ps-2 font-medium text-muted-foreground">You</span>
                ) : null}
              </p>
              <p className="text-body-compact text-muted-foreground">{s.role}</p>
            </div>
            {s.status === "signed" && s.oathTaken === false ? (
              <Badge variant="secondary">Oath pending</Badge>
            ) : s.status === "signed" ? (
              <Badge variant="success">
                <CheckIcon aria-hidden />
                {s.oathTaken ? "Signed and sworn" : "Signed"}
              </Badge>
            ) : (
              /* Says what is waiting, not just that something is (owner, 2026-10-13). */
              <Badge variant="secondary">Signature pending</Badge>
            )}
          </li>
        ))}
      </ul>

      <p className="border-t border-hairline px-4 py-3 text-body-compact text-muted-foreground">
        {footnote}
      </p>
    </div>
  );
}

/**
 * One route, as a card that takes it.
 *
 * The card carries the mark, the name and what the route does to everyone else, and
 * pressing it is the choice — there is no separate confirm below, because the sentence
 * the reader just read *is* the confirmation. This is the shape the owner picked out as
 * the right one (2026-09-23), and it is used for both questions the window asks: how the
 * complaint is signed, and which instrument the filer signs it with.
 */
export function ChoiceCard({
  icon,
  tone,
  title,
  onClick,
  children,
}: {
  icon: React.ReactNode;
  /** The tile's fill/foreground pair — a category mark, never a status. */
  tone: string;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-start gap-4 rounded-xl border border-border bg-card p-4 text-left shadow-raised transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span
        aria-hidden
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg",
          tone
        )}
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-body font-semibold text-foreground">{title}</span>
        <span className="text-body-compact text-muted-foreground">{children}</span>
      </span>
      <ChevronRightIcon
        aria-hidden
        className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
      />
    </button>
  );
}

/**
 * The two instruments a person can e-sign with, as cards that each start one, under the
 * question they answer. The question is a heading at the weight the oath stage gives its
 * own sections, so the two acts read alike; it also names the group, so a screen reader
 * hears what the two cards are a choice between.
 */
export function InstrumentChoice({
  onAadhaar,
  onDsc,
}: {
  onAadhaar: () => void;
  onDsc: () => void;
}) {
  const questionId = React.useId();
  return (
    <div role="group" aria-labelledby={questionId} className="flex flex-col gap-3">
      <h3 id={questionId} className="text-body font-semibold">
        How will you e-sign?
      </h3>
      <ChoiceCard
        title="Aadhaar OTP"
        tone="bg-info-muted text-info-muted-foreground"
        icon={<SignatureIcon className="size-5" />}
        onClick={onAadhaar}
      >
        A six-digit code goes to the mobile number registered with your Aadhaar.
      </ChoiceCard>
      <ChoiceCard
        title="My DSC"
        tone="bg-brand-muted text-brand-muted-foreground"
        icon={<ShieldCheckIcon className="size-5" />}
        onClick={onDsc}
      >
        The Digital Signature Certificate already set up on this computer.
      </ChoiceCard>
    </div>
  );
}

/** The Aadhaar OTP, six boxes and a resend. Sandbox: any six digits are accepted. */
export function OtpEntry({
  id,
  value,
  onChange,
  resent,
  onResend,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  resent: boolean;
  onResend: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <InputOTP
        id={id}
        maxLength={6}
        value={value}
        onChange={onChange}
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
      <Button
        type="button"
        variant="link"
        className="h-auto p-0 text-body-compact"
        onClick={onResend}
      >
        {resent ? "Sent again" : "Send it again"}
      </Button>
      <p className="text-body-compact text-muted-foreground">
        Sandbox — any six digits work.
      </p>
    </div>
  );
}

/**
 * A DSC is read off the signer's own machine, and the utility takes a beat to answer, so
 * this says it is looking rather than presenting a certificate it never went to find.
 */
export function DscLookup({ found, holder }: { found: boolean; holder: string }) {
  return (
    /* The height is held across both states so the footer does not jump. */
    <div aria-live="polite" className="flex min-h-20 flex-col justify-center">
      {found ? (
        <div className="flex items-start gap-3 rounded-lg border border-hairline bg-card p-4">
          <ShieldCheckIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-success-ink" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="truncate text-body-compact font-medium">
              {holder || "Certificate found on this computer"}
            </p>
            <p className="text-body-compact text-muted-foreground">
              {holder
                ? "Class 3 individual certificate, found on this computer"
                : "Class 3 individual certificate"}
            </p>
            <p className="text-body-compact text-muted-foreground">
              Sandbox — no certificate store is read.
            </p>
          </div>
        </div>
      ) : (
        <p className="flex items-center gap-3 text-body-compact text-muted-foreground">
          <Spinner className="size-4 shrink-0" aria-hidden />
          Looking for a certificate on this computer&hellip;
        </p>
      )}
    </div>
  );
}

export type TrailStep = { label: string; state: "done" | "current" | "next" };

/** The DS stepper's state for each of ours. */
const STEPPER_STATUS = {
  done: "complete",
  current: "current",
  next: "upcoming",
} as const;

/** What each state is called aloud — the mark alone is a shape, not a word. */
const SPOKEN_STATE = {
  done: "done",
  current: "current step",
  next: "next",
} as const;

/*
 * The DS stepper drawn the way the product's dialogs already draw it (the Add-people
 * dialogs' band, registration's journey row): each mark centred over its name, the
 * connector running from one circle's edge to the next. The DS default hangs every mark
 * at the left of its half, which with two steps leaves the second circle alone in the
 * middle of the row. Names stay visible at every width — two short ones fit a phone.
 */
const CENTRED_TRAIL = cn(
  "w-full",
  "[&_[data-slot=stepper-item]]:items-center",
  "[&_[data-slot=stepper-item]>div:first-child]:relative [&_[data-slot=stepper-item]>div:first-child]:justify-center",
  "[&_[data-slot=stepper-connector]]:absolute [&_[data-slot=stepper-connector]]:top-4 [&_[data-slot=stepper-connector]]:left-[calc(50%+1rem)] [&_[data-slot=stepper-connector]]:mx-0 [&_[data-slot=stepper-connector]]:w-[calc(100%-2rem)] [&_[data-slot=stepper-connector]]:min-w-0 [&_[data-slot=stepper-connector]]:flex-none",
  "[&_[data-slot=stepper-item]>div:last-child]:w-full [&_[data-slot=stepper-item]>div:last-child]:pr-0 [&_[data-slot=stepper-item]>div:last-child]:text-center"
);

/**
 * A complainant's signing, where the state asks for an oath, is two acts — the
 * e-signature (or, on paper, the OTP confirmation), then the oath — and both are named
 * up front, so the oath never arrives as a surprise after the person thinks they are done.
 *
 * It heads the stage it belongs to, across the column, in the same place on both acts:
 * the reader sees the mark move from the first circle to the second rather than hunting
 * for a small row between a notice and a question (owner, 2026-10-06: the earlier inline
 * trail "looks off"). It is the DS `Stepper` — a fixed, forward-only sequence the person
 * is completing, which is what that primitive is for. The room under it (`pb-2`, on top
 * of the column's own gap) is what sets it apart from the question it introduces.
 *
 * Each step says its state in words as well as in its mark, and the current one carries
 * `aria-current="step"`.
 */
export function StepTrail({ steps }: { steps: TrailStep[] }) {
  return (
    <Stepper aria-label="Your steps" className={cn(CENTRED_TRAIL, "pb-2")}>
      {steps.map((step, i) => (
        <StepperItem
          key={step.label}
          step={i + 1}
          status={STEPPER_STATUS[step.state]}
          aria-current={step.state === "current" ? "step" : undefined}
          title={step.label}
        >
          <span className="sr-only">, {SPOKEN_STATE[step.state]}</span>
        </StepperItem>
      ))}
    </Stepper>
  );
}
