"use client";

import * as React from "react";
import Link from "next/link";

import { cognizanceDraftKey } from "@/components/employee/cognizance-order-screen";
import { markCognizanceTab } from "@/components/employee/cognizance-return";
import {
  bodyFromBlocks,
  OrderTextComposer,
} from "@/components/employee/order-text-composer";
import { markArrival } from "@/components/employee/use-arrival";
import { useCourtToday } from "@/components/employee/use-court-today";
import { useOrderDraft } from "@/components/employee/use-order-draft";
import { Button } from "@/components/ui/button";
import {
  tabFor,
  type CognizanceAct,
  type CognizanceCase,
} from "@/lib/employee/cognizance";
import {
  cognizanceComposition,
  cognizanceOrderOutcome,
} from "@/lib/employee/cognizance-order";
import { composerContextFor } from "@/lib/employee/order-context";
import {
  buildOrderDocument,
  EMPTY_ORDER_DRAFT,
  type OrderDraft,
} from "@/lib/employee/order-draft";
import {
  subjectCauseTitle,
  subjectFacts,
  subjectReturn,
  type OrderSubject,
} from "@/lib/employee/order-subject";

/**
 * Version B of a cognizance act's order — the text-box composer, outside a hearing: no
 * attendance and no next-hearing card, the act's items loaded with their words in the
 * text, and the next date set through the *Scheduling of hearing date* item's fields.
 */
export function CognizanceOrderScreenB({
  matter,
  act,
}: {
  matter: CognizanceCase;
  act: CognizanceAct;
}) {
  const today = useCourtToday();
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
  const initial = React.useMemo<OrderDraft>(
    () => ({
      ...EMPTY_ORDER_DRAFT,
      blocks: composition.blocks,
      body: bodyFromBlocks(composition.blocks),
    }),
    [composition],
  );
  const [draft, setDraft] = useOrderDraft(
    `text:${cognizanceDraftKey(matter, act)}`,
    initial,
  );

  const paragraphs = (draft.body?.text ?? "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <OrderTextComposer
      heading={subjectCauseTitle(subject)}
      facts={subjectFacts(subject)}
      notice={
        <p className="text-body-compact text-muted-foreground">
          {cognizanceOrderOutcome(matter, act)}
        </p>
      }
      navAction={
        <Button asChild variant="outline" className="w-full shrink-0 sm:w-fit">
          <Link
            href={back.href}
            onClick={() => {
              markArrival("back");
              markCognizanceTab(tabFor(matter));
            }}
          >
            {back.label}
          </Link>
        </Button>
      }
      context={context}
      today={today}
      inHearing={false}
      draft={draft}
      setDraft={setDraft}
      fixedIds={composition.fixedIds}
      showNextHearing={false}
      document={{
        ...buildOrderDocument({
          caseNumber: matter.caseNumber,
          matter: subjectCauseTitle(subject),
          day: today,
          blocks: [],
        }),
        paragraphs,
      }}
    />
  );
}
