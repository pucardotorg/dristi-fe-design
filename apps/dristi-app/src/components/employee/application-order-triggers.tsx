"use client";

import * as React from "react";
import { toast } from "sonner";

import { useOrderDrafts } from "@/components/employee/use-order-draft";
import { useOrderSigning } from "@/components/employee/use-order-signing";
import { usePendingOrders } from "@/components/employee/use-pending-orders";
import {
  draftOrder,
  signOrder,
  type LifecycleApplication,
} from "@/lib/applications/lifecycle";
import {
  allotOrderId,
  applyStep,
  today,
  useApplicationsReady,
  useLifecycleApplications,
} from "@/lib/applications/store";
import {
  applicationOrderOutcomes,
  outcomeApplies,
  outcomeHearingDate,
  type ApplicationOrderKind,
} from "@/lib/employee/application-order-outcome";
import { editorDraftKey } from "@/lib/employee/order-drafts";
import { pendingOrderStage } from "@/lib/employee/pending-orders";

const SETTLED: Record<ApplicationOrderKind, string> = {
  accept: "accepted",
  reject: "rejected",
  dismiss: "dismissed",
};

/**
 * Applies each triggered order's application items to the applications they decide
 * (`lib/employee/application-order-outcome.ts`). Mounted once, by the court area, so an
 * order triggers its applications wherever it was signed or completed — Pending orders,
 * its own page, or in bulk.
 *
 * The order is signed by the magistrate in Pending orders, so it is the magistrate's
 * signature the application records. Renders nothing.
 */
export function ApplicationOrderTriggers() {
  const ready = useApplicationsReady();
  const apps = useLifecycleApplications();
  const orders = usePendingOrders();
  const signing = useOrderSigning();
  const drafts = useOrderDrafts();
  /* An outcome that could not be applied is said once, not on every render after. */
  const reported = React.useRef(new Set<string>());

  React.useEffect(() => {
    if (!ready) return;
    const on = today();
    for (const order of Object.values(orders)) {
      if (pendingOrderStage(order, signing) !== "triggered") continue;
      const draft = drafts[editorDraftKey(order.key)] ?? drafts[order.key];
      if (!draft) continue;
      for (const outcome of applicationOrderOutcomes(draft.blocks)) {
        const application = apps.find((app) => app.id === outcome.applicationId);
        if (!application || !outcomeApplies(outcome, application)) continue;
        const result = applyStep(application.id, (app: LifecycleApplication) =>
          signOrder(
            draftOrder(
              app,
              "magistrate",
              {
                kind: outcome.kind,
                text: draft.body?.text ?? "",
                newHearingOn: outcomeHearingDate(outcome, app, draft),
              },
              on,
            ),
            "magistrate",
            allotOrderId(),
            on,
          ),
        );
        const label = `${application.typeLabel} application`;
        const id = `${order.key}:${application.id}`;
        if (result.ok) {
          toast(`${label} ${SETTLED[outcome.kind]} by the signed order.`);
        } else if (!reported.current.has(id)) {
          reported.current.add(id);
          toast.error(`${label} could not be ${SETTLED[outcome.kind]}: ${result.error}`);
        }
      }
    }
  }, [ready, apps, orders, signing, drafts]);

  return null;
}
