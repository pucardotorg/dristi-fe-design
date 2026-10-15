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
import {
  sideLabel,
  type CourtTaskKind,
  type LifecycleApplication,
} from "@/lib/applications/lifecycle";
import {
  useApplicationsReady,
  useLifecycleApplications,
} from "@/lib/applications/store";
import { counselFor, partiesLabel, type CaseRecord } from "@/lib/cases/types";
import { caseOf } from "@/lib/employee/application-tasks";
import { CURRENT_STAFF } from "@/lib/employee/content";
import { formatOrderDate, type CourtCounsel } from "@/lib/employee/hearings";
import { composerContextFor } from "@/lib/employee/order-context";
import {
  createItemBlock,
  type ComposerContext,
  type ItemBlock,
} from "@/lib/employee/order-composer";
import type { ApplicationOrderDecision } from "@/lib/employee/application-order-decision";
import { EMPTY_ORDER_DRAFT } from "@/lib/employee/order-draft";

const APPLICATIONS = "/employee/applications";

/**
 * The way back from an application's order: the application itself, in the workstation,
 * on the list its task belongs to — one Applications queue since the two were folded
 * together (owner, 2026-10-07).
 */
function backTo(applicationId: string, kind: CourtTaskKind): { href: string; label: string } {
  return {
    href: `${APPLICATIONS}/${encodeURIComponent(applicationId)}?view=${
      kind === "review" ? "onboard" : "decide"
    }`,
    label: "Back to the application",
  };
}

/** The task an application's order answers: a dismissal before onboarding, else the decision. */
function kindOf(application: LifecycleApplication): CourtTaskKind {
  return application.status === "pending-review" ? "review" : "decide";
}

/**
 * The catalogue item a decision pre-adds (owner, 2026-10-14: "pre-add the items in the
 * workflow"), filled from the application: *Accept application* or *Reject application*
 * with its number and type, or *Dismiss application* with its type, who filed it and when.
 */
function decisionItem(
  application: LifecycleApplication,
  decision: ApplicationOrderDecision,
  context: ComposerContext,
): ItemBlock {
  if (decision === "dismiss") {
    return createItemBlock("dismiss-application", context, {
      applicationId: application.id,
      values: {
        applicationType: application.typeLabel,
        filerType: sideLabel(application.side).toLowerCase(),
        filerName: application.onBehalfOf,
        filingDate: formatOrderDate(application.submittedOn ?? application.createdOn),
      },
    });
  }
  return createItemBlock(
    decision === "accept" ? "accept-application" : "reject-application",
    context,
    {
      applicationId: application.id,
      values: {
        applicationNumber:
          application.applicationNumber ?? application.temporaryId ?? "",
        applicationType: application.typeLabel,
      },
    },
  );
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
}: {
  decision?: ApplicationOrderDecision;
  applicationId: string;
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
      kind={kindOf(application)}
      decision={decision}
    />
  );
}

function ApplicationOrder({
  application,
  record,
  kind,
  decision,
}: {
  application: LifecycleApplication;
  record: CaseRecord;
  kind: CourtTaskKind;
  decision?: ApplicationOrderDecision;
}) {
  const door = useApplicationOrderDoor(application, record, kind, decision);
  return <OrderDoorScreen door={door} />;
}

function counselOf(record: CaseRecord): CourtCounsel[] {
  return (["complainant", "accused"] as const).flatMap((side) =>
    counselFor(record, side).map((name) => ({ name, side })),
  );
}

export function useApplicationOrderDoor(
  application: LifecycleApplication,
  record: CaseRecord,
  kind: CourtTaskKind,
  decision?: ApplicationOrderDecision,
): OrderDoor {
  const today = useCourtToday();
  const courtText = useCourtText();
  const matter = partiesLabel(record);
  const back = backTo(application.id, kind);
  const context = React.useMemo(
    () =>
      composerContextFor({
        caseNumber: record.caseNumber,
        parties: record.parties,
        counsel: counselOf(record),
      }),
    [record],
  );
  const initial = React.useMemo(
    () =>
      decision
        ? {
            ...EMPTY_ORDER_DRAFT,
            blocks: [decisionItem(application, decision, context)],
          }
        : EMPTY_ORDER_DRAFT,
    [application, decision, context],
  );

  return {
    draftKey: `application:${application.id}`,
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
    overview: [
      { label: "Case", value: record.caseNumber },
      { label: "Application", value: application.typeLabel },
      { label: "Raised by", value: application.raisedBy ?? application.createdByName },
      { label: "On behalf of", value: application.onBehalfOf },
    ],
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
