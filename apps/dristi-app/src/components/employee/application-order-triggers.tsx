"use client";

import * as React from "react";
import { toast } from "sonner";

import { useHearingSession } from "@/components/employee/use-hearing-session";
import { useReaderPostsNextHearing } from "@/components/employee/use-next-hearing-entry";
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
import { hearingById } from "@/lib/employee/hearings";
import { withCausePosting } from "@/lib/employee/order-draft";
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
 *
 * **One tab applies them.** Orders are kept in step across tabs (`browser-record.ts`), so
 * every open court tab sees an order become triggered; only the tab holding the
 * `dristi-order-triggers` lock acts on it, or two tabs would decide the same application
 * twice. Where the browser has no Web Locks, every tab acts, as before.
 */
export function ApplicationOrderTriggers() {
  const ready = useApplicationsReady();
  const apps = useLifecycleApplications();
  const orders = usePendingOrders();
  const signing = useOrderSigning();
  const drafts = useOrderDrafts();
  const session = useHearingSession();
  const readerPosts = useReaderPostsNextHearing();
  /* An outcome that could not be applied is said once, not on every render after. */
  const reported = React.useRef(new Set<string>());
  const leader = useTriggerLock();

  React.useEffect(() => {
    if (!ready || !leader) return;
    const on = today();
    for (const order of Object.values(orders)) {
      if (pendingOrderStage(order, signing) !== "triggered") continue;
      const typed = drafts[editorDraftKey(order.key)] ?? drafts[order.key];
      if (!typed) continue;
      /* A hearing's next date is the cause list's when the reader enters it (owner,
         2026-10-15). */
      const draft = readerPosts && hearingById(order.key)
        ? withCausePosting(typed, session.postings[order.key])
        : typed;
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
  }, [ready, leader, apps, orders, signing, drafts, session, readerPosts]);

  return null;
}

/**
 * Whether this tab holds the lock that applies triggered orders. Held for as long as the
 * tab is open; when it closes, the next tab waiting takes it.
 */
function useTriggerLock(): boolean {
  /* Without Web Locks there is nothing to wait for: every tab acts. Nothing renders
     from this, so the server's `false` cannot disagree with anything on screen. */
  const [held, setHeld] = React.useState<boolean>(
    () => typeof navigator !== "undefined" && !navigator.locks,
  );
  React.useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.locks) return;
    const release = new AbortController();
    navigator.locks
      .request("dristi-order-triggers", { signal: release.signal }, () => {
        setHeld(true);
        return new Promise<void>((resolve) => {
          release.signal.addEventListener("abort", () => resolve());
        });
      })
      .catch(() => {
        /* Aborted while waiting — this tab is going away. */
      });
    return () => {
      release.abort();
      setHeld(false);
    };
  }, []);
  return held;
}
