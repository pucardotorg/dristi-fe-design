"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { ChromeDialogContent } from "@/components/chrome/app-chrome";
import { DiscardQuestion, useDiscardGuard } from "@/components/chrome/discard-guard";
import { quietTrigger } from "@/components/employee/application-order-triggers";
import { ListingDateField } from "@/components/employee/listing-date-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import {
  acceptanceNeedsHearingDate,
  type LifecycleApplication,
} from "@/lib/applications/lifecycle";
import type { CaseRecord } from "@/lib/cases/types";
import {
  applicationOrderHref,
  type ApplicationOrderDecision,
} from "@/lib/employee/application-order-decision";
import {
  applicationOrderContext,
  applicationOrderKey,
  applicationOrderMeta,
  decisionItem,
  quickOrderDraft,
} from "@/lib/employee/application-order-draft";
import { isoDay } from "@/lib/employee/hearings";
import { orderDraftKey } from "@/lib/employee/order-door";
import { writeOrderDraft } from "@/lib/employee/order-drafts";
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

const TITLES: Record<ApplicationOrderDecision, string> = {
  accept: "Accept application",
  reject: "Reject application",
  dismiss: "Dismiss application",
};

const SETTLED: Record<ApplicationOrderDecision, string> = {
  accept: "accepted",
  reject: "rejected",
  dismiss: "dismissed",
};

/** What the bench has typed into one decision's order, kept while it moves between them. */
export type QuickOrderEntry = { text?: string; nextHearing?: Date };

/**
 * The order on an application in the court's standard words, passed without leaving the
 * workstation — the one modal on it, with nothing opened on top of it.
 *
 * The words are the catalogue's for the decision (`decisionItem`), filled as the order
 * screen fills them, and may be edited. An acceptance that moves the hearing (Postpone,
 * Advance) also asks for the new date, as the order's next hearing.
 *
 * The primary writes a real order under the application's key, the way the full-page
 * editor would: its draft, its line in Pending orders, sent for signing, its workflow
 * complete (the decision is its only item, and it is answered). The magistrate signs it
 * here, which triggers it, and `ApplicationOrderTriggers` decides the application with
 * these words as its order. Anyone else sends it to the magistrate.
 *
 * *Open in order screen* saves the same order as a draft, in the shape of whichever order
 * screen will open, and goes there.
 */
export function ApplicationQuickOrder({
  application,
  record,
  decision,
  entry,
  onEntry,
  canSign,
  on,
  hearing,
  view,
  onOpenChange,
  onDone,
}: {
  application: LifecycleApplication;
  record: CaseRecord;
  /** The decision being ordered; `null` while the modal is closed. */
  decision: ApplicationOrderDecision | null;
  entry: QuickOrderEntry | undefined;
  onEntry: (decision: ApplicationOrderDecision, entry: QuickOrderEntry) => void;
  canSign: boolean;
  /** Today, `YYYY-MM-DD`. */
  on: string;
  hearing: { day: string | undefined };
  /** The list being worked, carried to the order screen for the way back. */
  view: string;
  onOpenChange: (open: boolean) => void;
  onDone: (message: string) => void;
}) {
  /* The words of the last decision opened stay on screen while the modal animates out. */
  const [shown, setShown] = React.useState(decision);
  if (decision && decision !== shown) setShown(decision);
  const kind = decision ?? shown;
  /* Opened from the panel's primary, not from a Radix trigger, so focus is handed back
     to whatever opened it by hand. */
  const opener = React.useRef<HTMLElement | null>(null);

  return (
    <Dialog open={decision !== null} onOpenChange={onOpenChange}>
      {kind ? (
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
          key={kind}
          application={application}
          record={record}
          decision={kind}
          entry={entry}
          onEntry={(next) => onEntry(kind, next)}
          canSign={canSign}
          on={on}
          hearing={hearing}
          view={view}
          onClose={() => onOpenChange(false)}
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
  decision,
  entry,
  onEntry,
  canSign,
  on,
  hearing,
  view,
  onClose,
  onDone,
}: {
  onOpenAutoFocus: () => void;
  onCloseAutoFocus: (event: Event) => void;
  application: LifecycleApplication;
  record: CaseRecord;
  decision: ApplicationOrderDecision;
  entry: QuickOrderEntry | undefined;
  onEntry: (entry: QuickOrderEntry) => void;
  canSign: boolean;
  on: string;
  hearing: { day: string | undefined };
  view: string;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const router = useRouter();
  const textId = React.useId();
  const dateId = React.useId();
  /* One item for the life of the modal, so its id — the mark on the order's words — holds. */
  const [item] = React.useState(() =>
    decisionItem(application, decision, applicationOrderContext(record)),
  );
  const text = entry?.text ?? item.text;
  const needsDate = decision === "accept" && acceptanceNeedsHearingDate(application.type);
  const nextDay = entry?.nextHearing ? isoDay(entry.nextHearing) : "";
  const ready =
    text.trim().length > 0 && (!needsDate || (nextDay !== "" && nextDay > on));
  /* The panel keeps the words across a close, so discarding is what puts the catalogue's
     words back. */
  const guard = useDiscardGuard(text !== item.text || Boolean(entry?.nextHearing), () => {
    onEntry({});
    onClose();
  });
  const key = applicationOrderKey(application.id);
  const href = applicationOrderHref(application.id, decision, view);

  function pass() {
    if (!ready) return;
    const meta = applicationOrderMeta(application, record, href);
    /* Pending orders, its page and the triggers read the full-page editor's draft. */
    writeOrderDraft(
      orderDraftKey(key),
      quickOrderDraft(item, text, needsDate ? nextDay : undefined),
    );
    noteOrderDraft(meta);
    sendOrderForSigning(meta);
    markOrderReady(key);
    setOrderWorkflowComplete(key, true, readOrderSigning());
    if (canSign) {
      quietTrigger(key);
      markOrdersSigned([key]);
      onDone(`Order signed. The application is ${SETTLED[decision]}.`);
      return;
    }
    onDone("Sent to the Magistrate for signing.");
  }

  function openInOrderScreen() {
    /* Saved for the order screen that will open, under its own key, so it opens on these
       words rather than on the catalogue's. Not sent. */
    writeOrderDraft(
      orderDraftKey(key),
      quickOrderDraft(item, text, needsDate && nextDay ? nextDay : undefined),
    );
    router.push(href);
  }

  return (
    <ChromeDialogContent
      aria-describedby={undefined}
      onOpenAutoFocus={onOpenAutoFocus}
      onCloseAutoFocus={onCloseAutoFocus}
      className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
      {...guard.contentProps}
      {...guard.outsideProps}
    >
      <DialogHeader className="shrink-0 p-6 pr-16">
        <DialogTitle className="text-title-s font-semibold">{TITLES[decision]}</DialogTitle>
      </DialogHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 pb-6">
        <Field>
          <FieldLabel htmlFor={textId}>Order</FieldLabel>
          <Textarea
            id={textId}
            value={text}
            rows={8}
            onChange={(event) => onEntry({ ...entry, text: event.target.value })}
            className="min-h-48"
          />
        </Field>
        {needsDate ? (
          <ListingDateField
            id={dateId}
            label="Next hearing"
            value={entry?.nextHearing}
            on={on}
            hearing={hearing}
            onChange={(nextHearing) => onEntry({ ...entry, nextHearing })}
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
      <DiscardQuestion guard={guard} />
    </ChromeDialogContent>
  );
}
