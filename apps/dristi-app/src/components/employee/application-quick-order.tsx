"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { ChromeDialogContent } from "@/components/chrome/app-chrome";
import { quietTrigger } from "@/components/employee/application-order-triggers";
import { ListingDateField } from "@/components/employee/listing-date-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { LifecycleApplication } from "@/lib/applications/lifecycle";
import { partiesLabel, type CaseRecord } from "@/lib/cases/types";
import { applicationOrderHref } from "@/lib/employee/application-order-decision";
import { nextApplicationOrderKey } from "@/lib/employee/application-order-draft";
import {
  applicationOutcomeGaps,
  applicationWorkflow,
  initialApplicationOutcome,
  setApplicationOutcome,
  type ApplicationOutcome,
} from "@/lib/employee/application-outcome";
import { isoDay } from "@/lib/employee/hearings";
import { orderDraftKey } from "@/lib/employee/order-door";
import { EMPTY_ORDER_DRAFT, type OrderDraft } from "@/lib/employee/order-draft";
import { readOrderDraft, writeOrderDraft } from "@/lib/employee/order-drafts";
import { richTextFromPlain } from "@/lib/employee/order-text";
import {
  markOrderReady,
  markOrdersSigned,
  readOrderSigning,
} from "@/lib/employee/order-signing";
import {
  noteOrderDraft,
  sendOrderForSigning,
  setOrderWorkflowComplete,
} from "@/lib/employee/pending-orders";

/** What the panel asked for, as the quick order passes it. */
export type QuickOrderRequest = {
  /** "Onboard and list" — the modal's title. */
  title: string;
  /** The court's standard words for it, editable. */
  text: string;
  /** The panel's answers, written into the order's Application item. */
  answers: Partial<ApplicationOutcome>;
  /** An acceptance that moves the hearing (Postpone, Advance) asks for the new date. */
  needsHearingDate?: boolean;
};

/**
 * The order on an application in a few words, passed without leaving the Applications
 * pop-up (owner, 2026-10-22: bring back the quick order "which let them continue faster
 * onto the next application", with the full order screen a button away).
 *
 * The primary writes a real order under the application's next order key, as the order
 * screen would: its words, the panel's answers as its Application item, its line in
 * Pending orders, sent for signing, its order data complete. The magistrate signs it
 * here, which triggers it, and `ApplicationOrderTriggers` moves the application. Anyone
 * else sends it to the magistrate.
 *
 * *Open in order screen* saves the same order as a draft, not sent, and goes there.
 */
export function ApplicationQuickOrder({
  application,
  record,
  request,
  canSign,
  on,
  hearing,
  view,
  onOpenChange,
  onDone,
}: {
  application: LifecycleApplication;
  record: CaseRecord;
  /** What is being ordered; `null` while the modal is closed. */
  request: QuickOrderRequest | null;
  canSign: boolean;
  /** Today, `YYYY-MM-DD`. */
  on: string;
  hearing: { day: string | undefined };
  /** The list being worked, carried to the order screen for the way back. */
  view: string;
  onOpenChange: (open: boolean) => void;
  onDone: (message: string) => void;
}) {
  /* The last request stays on screen while the modal animates out. */
  const [shown, setShown] = React.useState(request);
  if (request && request !== shown) setShown(request);
  const current = request ?? shown;
  /* Opened from the panel's primary, not from a Radix trigger, so focus is handed back
     to whatever opened it by hand. */
  const opener = React.useRef<HTMLElement | null>(null);

  return (
    <Dialog open={request !== null} onOpenChange={onOpenChange}>
      {current ? (
        <QuickOrderContent
          /* Fired before focus moves in, so the opener is still the focused element. */
          onOpenAutoFocus={() => {
            opener.current = document.activeElement as HTMLElement | null;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (opener.current?.isConnected) opener.current.focus();
            opener.current = null;
          }}
          key={current.title}
          application={application}
          record={record}
          request={current}
          canSign={canSign}
          on={on}
          hearing={hearing}
          view={view}
          onDone={onDone}
        />
      ) : null}
    </Dialog>
  );
}

function QuickOrderContent({
  onOpenAutoFocus,
  onCloseAutoFocus,
  application,
  record,
  request,
  canSign,
  on,
  hearing,
  view,
  onDone,
}: {
  onOpenAutoFocus: () => void;
  onCloseAutoFocus: (event: Event) => void;
  application: LifecycleApplication;
  record: CaseRecord;
  request: QuickOrderRequest;
  canSign: boolean;
  on: string;
  hearing: { day: string | undefined };
  view: string;
  onDone: (message: string) => void;
}) {
  const router = useRouter();
  const textId = React.useId();
  const dateId = React.useId();
  const [text, setText] = React.useState(request.text);
  const [nextHearing, setNextHearing] = React.useState<Date | undefined>(undefined);
  const nextDay = nextHearing ? isoDay(nextHearing) : "";
  const key = nextApplicationOrderKey(application);
  const href = applicationOrderHref(application.id, undefined, view);
  const outcome = setApplicationOutcome(initialApplicationOutcome(), request.answers);
  const answered =
    applicationOutcomeGaps(
      application.status === "pending-review" ? outcome : { ...outcome, onboard: "yes" },
      Boolean(applicationWorkflow(application.type)),
    ).length === 0;
  const ready =
    answered &&
    text.trim().length > 0 &&
    (!request.needsHearingDate || (nextDay !== "" && nextDay > on));

  /** The order as the order screen opens on it: these words, and the item's answers. */
  function draft(): OrderDraft {
    const lines = text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
    const current = readOrderDraft(orderDraftKey(key), EMPTY_ORDER_DRAFT);
    return {
      ...current,
      applicationOutcome: outcome,
      body: {
        html: lines.map((line) => richTextFromPlain(line).html).join(""),
        text: lines.join("\n"),
      },
      ...(request.needsHearingDate && nextDay
        ? { next: "list" as const, nextDate: nextDay }
        : {}),
    };
  }

  function pass() {
    if (!ready) return;
    const meta = {
      key,
      heading: partiesLabel(record),
      caseNumber: record.caseNumber,
      origin: `Application · ${application.typeLabel}`,
      orderHref: href,
    };
    /* Pending orders, its page and the triggers read the order screen's draft. */
    writeOrderDraft(orderDraftKey(key), draft());
    noteOrderDraft(meta);
    sendOrderForSigning(meta);
    markOrderReady(key);
    setOrderWorkflowComplete(key, true, readOrderSigning());
    if (canSign) {
      quietTrigger(key);
      markOrdersSigned([key]);
      onDone("Order signed.");
      return;
    }
    onDone("Sent to the Magistrate for signing.");
  }

  function openInOrderScreen() {
    /* Saved, not sent: the order screen opens on these words and these answers. */
    writeOrderDraft(orderDraftKey(key), draft());
    router.push(href);
  }

  return (
    <ChromeDialogContent
      onOpenAutoFocus={onOpenAutoFocus}
      onCloseAutoFocus={onCloseAutoFocus}
      className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
    >
      <DialogHeader className="shrink-0 p-6 pr-16">
        <DialogTitle className="text-title-s font-semibold">{request.title}</DialogTitle>
        <DialogDescription>
          {application.typeLabel} · {partiesLabel(record)}
        </DialogDescription>
      </DialogHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 pb-6">
        <Field>
          <FieldLabel htmlFor={textId}>Order</FieldLabel>
          <Textarea
            id={textId}
            value={text}
            rows={8}
            onChange={(event) => setText(event.target.value)}
            className="min-h-48"
          />
        </Field>
        {request.needsHearingDate ? (
          <ListingDateField
            id={dateId}
            label="Next hearing"
            value={nextHearing}
            on={on}
            hearing={hearing}
            onChange={setNextHearing}
          />
        ) : null}
      </div>

      <DialogFooter className="mx-0 mb-0 shrink-0 sm:items-center sm:justify-between">
        <Button type="button" variant="outline" onClick={openInOrderScreen}>
          Open in order screen
        </Button>
        <Button type="button" disabled={!ready} onClick={pass}>
          {canSign ? "Sign order" : "Send for signing"}
        </Button>
      </DialogFooter>
    </ChromeDialogContent>
  );
}
