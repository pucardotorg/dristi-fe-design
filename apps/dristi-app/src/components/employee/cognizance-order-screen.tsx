"use client";

import * as React from "react";
import Link from "next/link";
import { FileQuestionIcon } from "lucide-react";

import { ARRIVAL } from "@/components/chrome/motion";
import { useCourt, useCourtText } from "@/components/court/court-provider";
import { markCognizanceTab } from "@/components/employee/cognizance-return";
import { COGNIZANCE_PATH } from "@/components/employee/cognizance-table";
import {
  OrderDoorScreen,
  type OrderDoor,
} from "@/components/employee/order-door-screen";
import { markArrival, useArrival } from "@/components/employee/use-arrival";
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
  cognizanceCaseById,
  hasDelay,
  primaryActFor,
  tabFor,
  type CognizanceAct,
  type CognizanceCase,
} from "@/lib/employee/cognizance";
import {
  cognizanceComposition,
  cognizanceOrderOutcome,
} from "@/lib/employee/cognizance-order";
import { localizeDeep } from "@/lib/court/localize";
import { CURRENT_STAFF } from "@/lib/employee/content";
import { counselFor, formatOrderDate } from "@/lib/employee/hearings";
import { composerContextFor } from "@/lib/employee/order-context";
import { EMPTY_ORDER_DRAFT } from "@/lib/employee/order-draft";
import {
  subjectCauseTitle,
  subjectFacts,
  subjectReturn,
  type OrderSubject,
} from "@/lib/employee/order-subject";
import { cn } from "@/lib/utils";

/**
 * The order one cognizance act draws up — the composer's **outside-a-hearing** door
 * (`ORD-06`–`ORD-08`): the same screen as a hearing's order, without Attendance and Next
 * hearing. The act's own order items arrive loaded (`cognizance-order.ts`), all removable, and the next
 * date is the *Scheduling of hearing date* item's to set.
 *
 * Version A, B or C by the Court settings toggle, as on a hearing (`order-door-screen.tsx`).
 */
export function CognizanceOrderScreen({
  caseId,
  act,
}: {
  caseId: string;
  /** `null` when the URL named no act, or one that is not an act. */
  act: CognizanceAct | null;
}) {
  const arrival = useArrival();
  const { court } = useCourt();
  /* The complaint as this court names it (`lib/court/localize.ts`). */
  const matter = localizeDeep(cognizanceCaseById(caseId), court);

  if (!matter) return <OrderMissing />;

  /* No act in the URL means the one this complaint's tab offers. */
  const chosen = act ?? primaryActFor(matter, court);

  return (
    <div className={cn("min-w-0", arrival && ARRIVAL[arrival])}>
      <CognizanceOrder key={`${matter.id}:${chosen}`} matter={matter} act={chosen} />
    </div>
  );
}

function CognizanceOrder({
  matter,
  act,
}: {
  matter: CognizanceCase;
  act: CognizanceAct;
}) {
  const door = useCognizanceOrderDoor(matter, act);
  return <OrderDoorScreen door={door} />;
}

/**
 * A cognizance act's door: the act's order items loaded, every one removable
 * (`cognizanceComposition`), the act's outcome under the title, and the way back to the
 * complaint.
 */
export function useCognizanceOrderDoor(
  matter: CognizanceCase,
  act: CognizanceAct,
): OrderDoor {
  const today = useCourtToday();
  const courtText = useCourtText();
  const { court } = useCourt();
  const subject: OrderSubject = { kind: "cognizance", matter, act };
  const back = subjectReturn(subject);
  const context = React.useMemo(
    () => composerContextFor({ ...matter, stage: "cognizance" }),
    [matter],
  );
  const composition = React.useMemo(
    () => cognizanceComposition(matter, act, context),
    [matter, act, context],
  );
  const initial = React.useMemo(
    () => ({ ...EMPTY_ORDER_DRAFT, blocks: composition.blocks }),
    [composition],
  );

  return {
    draftKey: cognizanceDraftKey(matter, act),
    origin: "Cognizance",
    initial,
    /* Every item the act loads can be removed, the act's own included (owner, 2026-10-13). */
    fixedIds: [],
    heading: subjectCauseTitle(subject),
    facts: subjectFacts(subject),
    courtLine: courtText(`Before the ${CURRENT_STAFF.court}`),
    subLine: `${matter.caseNumber} · ${subjectCauseTitle(subject)} · ${formatOrderDate(today)}`,
    notice: (
      <p className="text-body-compact text-muted-foreground">
        {cognizanceOrderOutcome(matter, act)}
      </p>
    ),
    navAction: (
      <Button asChild variant="outline" className="w-full shrink-0 sm:w-fit">
        <Link
          href={back.href}
          onClick={() => {
            markArrival("back");
            markCognizanceTab(tabFor(matter, court));
          }}
        >
          {back.label}
        </Link>
      </Button>
    ),
    context,
    today,
    document: {
      caseNumber: matter.caseNumber,
      matter: subjectCauseTitle(subject),
    },
    overview: cognizanceOverview(matter),
  };
}

/** The complaint's facts for the case file's Overview tab. */
export function cognizanceOverview(matter: CognizanceCase) {
  const side = (which: "complainant" | "accused") => {
    const counsel = counselFor(matter, which).map((entry) => entry.name);
    return counsel.length
      ? `${matter.parties[which]}, represented by ${counsel.join(", ")}`
      : `${matter.parties[which]}, in person`;
  };
  return [
    { label: "Filing", value: matter.filingNumber },
    { label: "Case", value: matter.caseNumber },
    {
      label: "Filed",
      value: hasDelay(matter) ? "Beyond the month" : "In time",
    },
    { label: "Complainant", value: side("complainant") },
    { label: "Accused", value: side("accused") },
  ];
}

/** The draft store's key for a complaint's order — one per act. */
export function cognizanceDraftKey(matter: CognizanceCase, act: CognizanceAct) {
  return `cognizance:${matter.id}:${act}`;
}

export function OrderMissing() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-8 p-6 md:p-8">
      <Empty className="border-0 p-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileQuestionIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle className="text-title-s font-semibold">
            This complaint is not waiting for cognizance
          </EmptyTitle>
          <EmptyDescription className="text-body">
            An order is drawn up from a complaint on the list of those waiting for
            cognizance. This one is not on it.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link href={COGNIZANCE_PATH}>Back to take cognizance</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
