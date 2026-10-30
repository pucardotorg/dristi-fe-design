"use client";

import { seatHolds } from "@/lib/employee/seat-roles";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useCourt, useCourtText } from "@/components/court/court-provider";
import { useApplicationOrderDoor } from "@/components/employee/application-order-screen";
import {
  applicationOutcomeGaps,
  initialApplicationOutcome,
} from "@/lib/employee/application-outcome";
import { useCognizanceOrderDoor } from "@/components/employee/cognizance-order-screen";
import { ListingApplicationDialog } from "@/components/employee/listing-application-dialog";
import {
  applicationFiled,
  useCausePosting,
  type OrderDoor,
} from "@/components/employee/order-door-screen";
import {
  OrderEditorHeader,
  OrderPaperView,
  orderPaperRecitals,
  OrderProgress,
  OrderWorkflowFields,
  withOnboarded,
  decideOnly,
  paperStatus,
} from "@/components/employee/order-editor";
import { useCourtRole } from "@/components/employee/use-court-role";
import {
  OrderMissing,
  useHearingOrderDoor,
} from "@/components/employee/order-screen";
import { CausePostingContext } from "@/components/employee/cause-posting";
import { useReaderPostsNextHearing } from "@/components/employee/use-next-hearing-entry";
import { useOrderDraft } from "@/components/employee/use-order-draft";
import { useOrderSigning } from "@/components/employee/use-order-signing";
import { usePendingOrders } from "@/components/employee/use-pending-orders";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { type LifecycleApplication } from "@/lib/applications/lifecycle";
import {
  useApplicationsReady,
  useLifecycleApplications,
} from "@/lib/applications/store";
import type { CaseRecord } from "@/lib/cases/types";
import { localizeDeep } from "@/lib/court/localize";
import { caseOf } from "@/lib/employee/application-tasks";
import { applicationIdOfOrderKey } from "@/lib/employee/application-order-draft";
import {
  cognizanceCaseById,
  isCognizanceAct,
  type CognizanceAct,
  type CognizanceCase,
} from "@/lib/employee/cognizance";
import { hearingById, type CourtHearing } from "@/lib/employee/hearings";
import {
  listingApplicationLabel,
  type ListingApplication,
} from "@/lib/employee/listing-applications";
import { orderDraftKey, orderInitialDraft } from "@/lib/employee/order-door";
import {
  attendanceRecital,
  nextListingRecital,
  recitalText,
  type Appearance,
  type OrderDraft,
} from "@/lib/employee/order-draft";
import {
  markOrdersSigned,
  returnOrderToDraft,
} from "@/lib/employee/order-signing";
import { missingMandatory } from "@/lib/employee/order-composer";
import { orderTemplate } from "@/lib/employee/order-templates";
import {
  moveOrderBackToDraft,
  pendingOrderStage,
  setOrderWorkflowComplete,
  type PendingOrderStage,
} from "@/lib/employee/pending-orders";

/**
 * One pending order, for the magistrate and the steno alike (owner, 2026-10-14): the
 * order's text on the left, read only; its workflow on the right; where it stands —
 * signature, then workflows — above both. The magistrate signs from here; the steno
 * fills the workflow and, once the order is signed, triggers it.
 *
 * Any order, not only a hearing's: the route carries the order's draft key, and the
 * door that order was typed through is rebuilt from it — a hearing, a cognizance act or
 * an application. It reads and writes the order screen's own draft (`orderDraftKey`), so
 * what was entered on the order screen's Order data switch is here, and the reverse. The workflow can be changed until it is triggered,
 * and not after.
 */
export function PendingOrderScreen({ orderKey }: { orderKey: string }) {
  const { court } = useCourt();
  if (orderKey.startsWith("cognizance:")) {
    const [, caseId, act] = orderKey.split(":");
    const matter = localizeDeep(cognizanceCaseById(caseId), court);
    if (!matter || !isCognizanceAct(act)) return <OrderMissing />;
    return <CognizanceWorkflow key={orderKey} matter={matter} act={act} />;
  }
  if (orderKey.startsWith("application:")) {
    return (
      <ApplicationWorkflow
        applicationId={applicationIdOfOrderKey(orderKey) ?? ""}
        orderKey={orderKey}
      />
    );
  }
  const hearing = localizeDeep(hearingById(orderKey), court);
  if (!hearing) return <OrderMissing />;
  return <HearingWorkflow key={hearing.id} hearing={hearing} />;
}

function HearingWorkflow({ hearing }: { hearing: CourtHearing }) {
  return <WorkflowDoorScreen door={useHearingOrderDoor(hearing)} />;
}

function CognizanceWorkflow({
  matter,
  act,
}: {
  matter: CognizanceCase;
  act: CognizanceAct;
}) {
  return <WorkflowDoorScreen door={useCognizanceOrderDoor(matter, act)} />;
}

function ApplicationWorkflow({
  applicationId,
  orderKey,
}: {
  applicationId: string;
  orderKey: string;
}) {
  const ready = useApplicationsReady();
  const apps = useLifecycleApplications();
  const application = apps.find((app) => app.id === applicationId);
  const record = application ? caseOf(application) : undefined;
  if (!ready) return null;
  if (!application || !record) return <OrderMissing />;
  return (
    <ApplicationWorkflowDoor
      application={application}
      record={record}
      orderKey={orderKey}
    />
  );
}

function ApplicationWorkflowDoor({
  application,
  record,
  orderKey,
}: {
  application: LifecycleApplication;
  record: CaseRecord;
  orderKey: string;
}) {
  return (
    <WorkflowDoorScreen
      door={useApplicationOrderDoor(application, record, { orderKey })}
    />
  );
}

function WorkflowDoorScreen({ door }: { door: OrderDoor }) {
  const readerPosts = useReaderPostsNextHearing();
  /* A hearing's order takes its next hearing from the cause list (owner, 2026-10-15). */
  return (
    <CausePostingContext.Provider value={Boolean(door.hearing) && readerPosts}>
      <WorkflowDoorBody door={door} />
    </CausePostingContext.Provider>
  );
}

function WorkflowDoorBody({ door }: { door: OrderDoor }) {
  const router = useRouter();
  const courtText = useCourtText();
  const seat = useCourtRole();
  const { court } = useCourt();
  const pending = usePendingOrders();
  const signing = useOrderSigning();
  const entry = pending[door.draftKey];
  const stage = entry ? pendingOrderStage(entry, signing) : "drafting";
  const appearances = door.hearing?.appearances;
  const initial = React.useMemo(
    () => orderInitialDraft(door.initial),
    [door.initial],
  );
  const [stored, setDraft] = useOrderDraft(orderDraftKey(door.draftKey), initial);
  const draft = useCausePosting(door, stored);
  const [openApplication, setOpenApplication] =
    React.useState<ListingApplication | null>(null);
  const [ask, setAsk] = React.useState<"sign" | "complete" | null>(null);
  const listing = door.hearing?.applications ?? [];
  const complete = Boolean(entry?.workflowComplete);
  const signed = signing[door.draftKey] === "signed";
  /* From the roles this seat holds in its state (court-roles §3): signing is the order
     signer's (`SGN-01`); filling, completing and reopening the order data the order data
     filler's (`ROL-02`); moving the order back to draft the order drafter's (`SND-05`).
     Everyone else reads. */
  const filler = seatHolds(seat, court, "order-data-filler");
  const canSign =
    seatHolds(seat, court, "order-signer") && stage === "awaiting-signature";
  const canFill = filler && Boolean(entry) && !complete && stage !== "triggered";
  const canComplete = canFill;
  const canReopen = filler && complete && !signed;
  const canMoveBack =
    seatHolds(seat, court, "order-drafter") && stage === "awaiting-signature";
  const summary = triggerSummary(draft, appearances, listing);

  function askComplete() {
    /* `CMP-02`: only a mandatory field left unanswered holds the order data back. The
       next hearing is settled before the order is sent for signing (`SND-03`), so it is
       not checked again here. An application's order waits on its Application item. */
    if (
      door.applicationItem &&
      applicationOutcomeGaps(
        withOnboarded(
          draft.applicationOutcome ?? initialApplicationOutcome(),
          door.applicationItem.onboarded,
        ),
        Boolean(door.applicationItem.workflow),
      ).length > 0
    ) {
      toast(
        `Application · ${door.applicationItem.label} has questions still to answer. Use its pencil to answer them.`,
      );
      return;
    }
    const unfilled = draft.blocks.find(
      (block) =>
        block.kind === "item" && missingMandatory(block, door.context).length > 0,
    );
    if (unfilled && unfilled.kind === "item") {
      toast(
        `${orderTemplate(unfilled.type).label} has mandatory details still to fill. Use its pencil to fill them.`,
      );
      return;
    }
    setAsk("complete");
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <OrderEditorHeader heading={door.heading} facts={door.facts} />

      <div className="flex min-w-0 flex-1 flex-col gap-4 bg-muted p-6 md:p-8 dark:bg-background">
        <OrderProgress stage={stage} workflowComplete={complete} />
        <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
          <OrderPaperView
            frame={{
              courtLine: door.courtLine,
              subLine: door.subLine,
              signatory: courtText("Judicial Magistrate of the First Class"),
            }}
            value={draft.body ?? { html: "", text: "" }}
            status={paperStatus(stage)}
            parts={orderPaperRecitals(draft, appearances)}
          />
          <div className="min-w-0">
            <OrderWorkflowFields
              draft={draft}
              setDraft={setDraft}
              today={door.today}
              applications={listing.map((application) => ({
                id: application.id,
                number: application.number,
                type: listingApplicationLabel(application),
                filed: applicationFiled(application),
                decision: draft.applications[application.id],
              }))}
              onOpenApplication={(id) =>
                setOpenApplication(
                  listing.find((entry) => entry.id === id) ?? null,
                )
              }
              context={door.context}
              applicationItem={door.applicationItem}
              purpose={door.hearing?.purpose}
              inHearing={Boolean(door.hearing)}
              fixedIds={door.fixedIds}
              disabled={!canFill}
              orderKey={door.draftKey}
            />
          </div>
        </div>
      </div>

      <footer className="sticky bottom-0 z-30 border-t border-hairline bg-card px-6 py-3 md:px-8 md:py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex min-h-10 items-center text-body-compact text-muted-foreground">
            {stageLine(stage, complete)}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {canMoveBack ? (
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-fit"
                onClick={() => {
                  moveOrderBackToDraft(door.draftKey, signing);
                  returnOrderToDraft(door.draftKey);
                  toast(
                    "Back to draft. Send it for signing again when it is ready.",
                  );
                  if (entry) router.push(entry.orderHref);
                }}
              >
                Move back to draft
              </Button>
            ) : null}
            {canReopen ? (
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-fit"
                onClick={() =>
                  setOrderWorkflowComplete(door.draftKey, false, signing)
                }
              >
                Reopen order data
              </Button>
            ) : null}
            {canSign ? (
              <Button
                type="button"
                className="w-full sm:w-fit"
                onClick={() => setAsk("sign")}
              >
                Sign order
              </Button>
            ) : canComplete ? (
              <Button
                type="button"
                className="w-full sm:w-fit"
                onClick={askComplete}
              >
                Mark order data complete
              </Button>
            ) : null}
          </div>
        </div>
      </footer>

      <AlertDialog
        open={ask !== null}
        onOpenChange={(open) => {
          if (!open) setAsk(null);
        }}
      >
        <AlertDialogContent>
          {ask === "sign" ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Sign this order?</AlertDialogTitle>
                <AlertDialogDescription>
                  {complete
                    ? "Your signature issues the order, and its order data is triggered at once: it has been completed."
                    : "Your signature issues the order. Its order data is triggered once it has been completed."}{" "}
                  This cannot be reversed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Back</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    markOrdersSigned([door.draftKey]);
                    toast(
                      complete
                        ? "Signed and issued. Its order data has been triggered."
                        : "Signed and issued. Its order data is still to be completed.",
                    );
                  }}
                >
                  Sign
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {signed
                    ? "Complete and trigger this order data?"
                    : "Mark this order data complete?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {signed
                    ? "The order is signed, so this is what goes out now. It can no longer change after."
                    : "This is what goes out when the magistrate signs. It can be reopened until then."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <ul className="flex flex-col gap-2 text-body-compact">
                {summary.map((line, index) => (
                  <li key={index} className="flex flex-col gap-0.5">
                    <span className="text-muted-foreground">{line.label}</span>
                    <span>{line.value}</span>
                  </li>
                ))}
              </ul>
              <AlertDialogFooter>
                <AlertDialogCancel>Back</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    setOrderWorkflowComplete(door.draftKey, true, signing);
                    toast(
                      signed
                        ? "Order data complete, and triggered."
                        : "Order data complete. It is triggered when the order is signed.",
                    );
                    router.push("/employee/pending-orders");
                  }}
                >
                  {signed ? "Complete and trigger" : "Mark complete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>

      {door.hearing ? (
        <ListingApplicationDialog
          hearing={door.hearing.hearing}
          application={openApplication}
          onOpenChange={setOpenApplication}
          onAllow={(application) =>
            decideOnly(setDraft, application.id, "allowed")
          }
          onDismiss={(application) =>
            decideOnly(setDraft, application.id, "dismissed")
          }
          onReturnFocus={() =>
            window.document
              .getElementById(`order-application-${openApplication?.id ?? ""}`)
              ?.focus()
          }
        />
      ) : null}
    </div>
  );
}

/** One line under the order: where it stands, and whose move it is. */
function stageLine(stage: PendingOrderStage, complete: boolean): string {
  if (stage === "drafting")
    return complete
      ? "Being typed. Its order data is complete."
      : "Being typed. Not yet sent for signing.";
  if (stage === "awaiting-signature")
    return complete
      ? "Awaiting the magistrate’s signature. Its order data is complete, so signing triggers it."
      : "Awaiting the magistrate’s signature. The order data can be filled meanwhile.";
  if (stage === "workflow-to-fill")
    return "Signed and issued. Its order data is triggered once it is marked complete.";
  return "Signed, and its order data triggered. Nothing here can change.";
}

/** What triggering sends, in words — the steno's last look before it goes. */
function triggerSummary(
  draft: OrderDraft,
  appearances: Appearance[] | undefined,
  listing: ListingApplication[],
): { label: string; value: string }[] {
  const lines: { label: string; value: string }[] = [];
  if (appearances) {
    const recital = attendanceRecital(appearances, draft.marks);
    const unmarked = appearances.filter(
      (appearance) => !draft.marks[appearance.id],
    ).length;
    lines.push({
      label: "Attendance",
      value:
        recital.map(recitalText).join(". ") +
          (unmarked
            ? `${recital.length ? ". " : ""}${unmarked} not marked`
            : "") || "Nobody marked",
    });
  }
  /* Only a hearing's order sets a next hearing (owner, 2026-10-22). */
  if (appearances) lines.push({
    label: "Next hearing",
    /* "28 Oct 2026. Purpose: Evidence" — the line's own label is this one's. */
    value:
      nextListingRecital(draft)
        .map((line) =>
          line.label === "Next hearing" ? line.value : recitalText(line),
        )
        .join(". ") || "Not set",
  });
  /* The catalogue's items, each with what it sets moving. */
  for (const block of draft.blocks) {
    if (block.kind !== "item") continue;
    const template = orderTemplate(block.type);
    lines.push({
      label: template.label,
      value: template.workflow ?? "Recorded in the order",
    });
  }
  for (const application of listing) {
    const decision = draft.applications[application.id];
    lines.push({
      label: listingApplicationLabel(application),
      value: decision
        ? decision === "allowed"
          ? "Allowed"
          : "Dismissed"
        : "Not decided",
    });
  }
  return lines;
}
