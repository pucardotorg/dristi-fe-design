"use client";

import * as React from "react";
import Link from "next/link";
import { FileQuestionIcon } from "lucide-react";

import { useCourtText } from "@/components/court/court-provider";
import {
  OrderDoorScreen,
  type OrderDoor,
} from "@/components/employee/order-door-screen";
import { useCourtToday } from "@/components/employee/use-court-today";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { LifecycleApplication } from "@/lib/applications/lifecycle";
import {
  useApplicationsReady,
  useLifecycleApplications,
} from "@/lib/applications/store";
import { partiesLabel, type CaseRecord } from "@/lib/cases/types";
import {
  applicationHref,
  type ApplicationOrderDecision,
} from "@/lib/employee/application-order-decision";
import {
  applicationOrderContext,
  decisionItem,
  nextApplicationOrderKey,
} from "@/lib/employee/application-order-draft";
import {
  applicationWorkflow,
  initialApplicationOutcome,
} from "@/lib/employee/application-outcome";
import { caseOf, nextHearingOf } from "@/lib/employee/application-tasks";
import { CURRENT_STAFF } from "@/lib/employee/content";
import { formatOrderDate } from "@/lib/employee/hearings";
import { EMPTY_ORDER_DRAFT } from "@/lib/employee/order-draft";

const APPLICATIONS = "/employee/applications";

/**
 * The way back from an application's order: the application itself, in the workstation,
 * on the list it was being worked in — carried in the order's URL rather than guessed
 * from the application's state.
 */
function backTo(applicationId: string, view?: string): { href: string; label: string } {
  return { href: applicationHref(applicationId, view), label: "Back to the application" };
}

/**
 * The order on one application — the composer's door from the application flow.
 *
 * **A shortcut, for now** (owner, 2026-10-13): where the application dialog used to
 * draft a one-line dismissal, acceptance or rejection in place, it opens the real order
 * screen instead. It opens with the dialog's decision pre-added as its catalogue item
 * (`decisionItem`), or empty when no decision was made there (Decide now), and the draft
 * is the composer's own, kept under this application's key. Nothing here writes back to the
 * application: what the order says and when it is signed are the composer's, and the
 * application's own status moves only from its dialog.
 *
 * Version A, B or C by the Court settings toggle, as on a hearing (`order-door-screen.tsx`).
 */
export function ApplicationOrderScreen({
  applicationId,
  decision,
  view,
}: {
  decision?: ApplicationOrderDecision;
  applicationId: string;
  /** The list the workstation was working, for the way back. */
  view?: string;
}) {
  const ready = useApplicationsReady();
  const apps = useLifecycleApplications();
  const application = apps.find((app) => app.id === applicationId);
  const record = application ? caseOf(application) : undefined;

  /* The store is this browser's, so the server and the first paint have nothing yet. */
  if (!ready) return null;
  if (!application || !record) return <OrderMissing />;
  return (
    <ApplicationOrder
      application={application}
      record={record}
      decision={decision}
      view={view}
    />
  );
}

function ApplicationOrder({
  application,
  record,
  decision,
  view,
}: {
  application: LifecycleApplication;
  record: CaseRecord;
  decision?: ApplicationOrderDecision;
  view?: string;
}) {
  const door = useApplicationOrderDoor(application, record, { decision, view });
  return <OrderDoorScreen door={door} />;
}

/**
 * The door onto an application's order. `decision` pre-adds its catalogue item to an
 * order nobody has started; a draft already saved under the key — the workstation's
 * quick order, say — opens as it was left. `view` is the list the way back returns to.
 */
export function useApplicationOrderDoor(
  application: LifecycleApplication,
  record: CaseRecord,
  {
    decision,
    view,
    orderKey,
  }: {
    decision?: ApplicationOrderDecision;
    view?: string;
    /** An order already under way (Pending orders); otherwise the next to pass. */
    orderKey?: string;
  } = {},
): OrderDoor {
  const today = useCourtToday();
  const courtText = useCourtText();
  const matter = partiesLabel(record);
  const back = backTo(application.id, view);
  const context = React.useMemo(
    () => applicationOrderContext(record, nextHearingOf(application, today)),
    [record, application, today],
  );
  /* The Application item is in the order data from the start (owner, 2026-10-16), so
     it is answered before the order data can be complete — onboarding, the listing
     date and the call for objections included (owner, 2026-10-21). */
  const initial = React.useMemo(
    () => ({
      ...EMPTY_ORDER_DRAFT,
      applicationOutcome: initialApplicationOutcome(),
      blocks: decision ? [decisionItem(application, decision, context)] : [],
    }),
    [application, decision, context],
  );
  const applicationItem = React.useMemo(
    () => ({
      label: application.typeLabel,
      onboarded: application.status !== "pending-review",
      workflow: applicationWorkflow(application.type),
    }),
    [application],
  );
  const draftKey = orderKey ?? nextApplicationOrderKey(application);

  return {
    applicationItem,
    draftKey,
    origin: `Application · ${application.typeLabel}`,
    initial,
    fixedIds: [],
    heading: matter,
    facts: [
      { label: "Application", value: application.typeLabel },
      { label: "Case", value: record.caseNumber, identifier: true },
      ...(application.applicationNumber
        ? [{ label: "Number", value: application.applicationNumber, identifier: true }]
        : application.temporaryId
          ? [{ label: "Temporary ID", value: application.temporaryId, identifier: true }]
          : []),
    ],
    courtLine: courtText(`Before the ${CURRENT_STAFF.court}`),
    subLine: `${record.caseNumber} · ${matter} · ${formatOrderDate(today)}`,
    navAction: (
      <Button asChild variant="outline" className="w-full shrink-0 sm:w-fit">
        <Link href={back.href}>{back.label}</Link>
      </Button>
    ),
    context,
    today,
    document: { caseNumber: record.caseNumber, matter },
  };
}

function OrderMissing() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-8 p-6 md:p-8">
      <Empty className="border-0 p-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileQuestionIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle className="text-title-s font-semibold">
            This application is not in this browser
          </EmptyTitle>
          <EmptyDescription className="text-body">
            Applications are kept in the browser they were filed from. Open the order
            from the application in the queue.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link href={APPLICATIONS}>Back to applications</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
