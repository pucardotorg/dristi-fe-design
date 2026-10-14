/**
 * Pending orders — every order typed on the full-page editor (order screen E) that has
 * not yet run its course, for the magistrate and the steno alike (owner, 2026-10-14).
 *
 * Two things must happen before an order's workflows go out — summons, notices, the next
 * listing — and they can happen in either order:
 *
 * - **The magistrate signs it.** Signing issues the order.
 * - **The steno marks its workflow complete** — attendance, the next hearing, the
 *   applications decided — after filling it in, at any time once the order exists.
 *
 * When both are done the workflows are **triggered**, at once and without a further
 * step: an order whose workflow was already complete is triggered by its signature, and
 * a signed order is triggered when its workflow is completed. From then on nothing
 * changes.
 *
 * Until it is signed, an order sent for signing can be **moved back to draft** and edited
 * further. Editing its text after its workflow was completed puts the workflow back to
 * incomplete — it has to be looked at again against the words that changed (owner,
 * 2026-10-14). The steno can also reopen a completed workflow before signing. Nothing
 * compares the text with the workflow; they may differ.
 *
 * Stages, each one person's move: **Drafting** (steno) → **Awaiting signature**
 * (magistrate) → **Workflow to fill** (steno; only a signed order whose workflow is not
 * complete) → **Triggered**.
 *
 * Every order is here, not only a hearing's: an entry is keyed by the order's own draft
 * key (a hearing id, `cognizance:<case>:<act>`, `application:<id>`) and carries what the
 * list shows about it, recorded when the order is first typed. Its signature lives in
 * `order-signing.ts`, under the same key.
 *
 * In memory, like the drafts it sits beside (`order-drafts.ts`): it outlives navigation
 * inside `/employee` and dies on a reload. Nothing here is filed, signed or sent.
 *
 * Read it through `components/employee/use-pending-orders.ts`, never from a render.
 */

import type { CourtRole } from "./content";
import type { OrderSigning } from "./order-signing";

/** What the list knows about one order — enough to show it and to reopen it. */
export type PendingOrderMeta = {
  /** The order's draft key — a hearing id, `cognizance:…` or `application:…`. */
  key: string;
  heading: string;
  caseNumber: string;
  /** Where the order comes from: "Hearing · Evidence", "Cognizance", an application. */
  origin: string;
  /** The order screen it is typed on. */
  orderHref: string;
};

export type PendingOrder = PendingOrderMeta & {
  /** Sent for signing from the editor, and not moved back to draft since. */
  sent: boolean;
  /** The steno has marked its workflow complete, and its text has not changed since. */
  workflowComplete: boolean;
};

/** Every order the editor has started, keyed by draft key, in the order first typed. */
export type PendingOrders = Readonly<Record<string, PendingOrder>>;

export type PendingOrderStage =
  | "drafting"
  | "awaiting-signature"
  | "workflow-to-fill"
  | "triggered";

/** The stages, in the order an order moves through them, with whose move each is. */
export const PENDING_ORDER_STAGES: {
  id: PendingOrderStage;
  label: string;
}[] = [
  { id: "drafting", label: "Drafting" },
  { id: "awaiting-signature", label: "Awaiting signature" },
  { id: "workflow-to-fill", label: "Workflow to fill" },
  { id: "triggered", label: "Triggered" },
];

const OPENING: PendingOrders = Object.freeze({});

let orders: PendingOrders = OPENING;
const listeners = new Set<() => void>();

export function subscribeToPendingOrders(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readPendingOrders(): PendingOrders {
  return orders;
}

function write(next: PendingOrders) {
  orders = next;
  for (const listener of listeners) listener();
}

/** The editor has words in this order: list it, or bring what the list shows up to date. */
export function noteOrderDraft(meta: PendingOrderMeta): void {
  const current = orders[meta.key];
  if (
    current &&
    current.heading === meta.heading &&
    current.caseNumber === meta.caseNumber &&
    current.origin === meta.origin &&
    current.orderHref === meta.orderHref
  )
    return;
  write({
    ...orders,
    [meta.key]: {
      ...meta,
      sent: current?.sent ?? false,
      workflowComplete: current?.workflowComplete ?? false,
    },
  });
}

/** Sent for signing from the editor: the magistrate's move now. */
export function sendOrderForSigning(meta: PendingOrderMeta): void {
  const current = orders[meta.key];
  if (current?.sent) return;
  write({
    ...orders,
    [meta.key]: {
      ...meta,
      sent: true,
      workflowComplete: current?.workflowComplete ?? false,
    },
  });
}

/** Back to draft, to be edited further — only before it is signed. */
export function moveOrderBackToDraft(key: string, signing: OrderSigning): void {
  const current = orders[key];
  if (!current?.sent || signing[key] === "signed") return;
  write({ ...orders, [key]: { ...current, sent: false } });
}

/**
 * The order's words changed. A completed workflow goes back to incomplete: it was
 * completed against words that are no longer the order's.
 */
export function noteOrderTextEdited(key: string): void {
  const current = orders[key];
  if (!current?.workflowComplete) return;
  write({ ...orders, [key]: { ...current, workflowComplete: false } });
}

/**
 * Mark the workflow complete — or, `false`, reopen it. Reopening is only before
 * signing: once signed and complete, the workflows have gone out.
 */
export function setOrderWorkflowComplete(
  key: string,
  complete: boolean,
  signing: OrderSigning,
): void {
  const current = orders[key];
  if (!current || current.workflowComplete === complete) return;
  if (!complete && signing[key] === "signed") return;
  write({ ...orders, [key]: { ...current, workflowComplete: complete } });
}

/** Where one order stands. */
export function pendingOrderStage(
  order: PendingOrder,
  signing: OrderSigning,
): PendingOrderStage {
  const signed = signing[order.key] === "signed";
  if (signed && order.workflowComplete) return "triggered";
  if (signed) return "workflow-to-fill";
  if (!order.sent) return "drafting";
  return "awaiting-signature";
}

export function pendingOrderStageLabel(stage: PendingOrderStage): string {
  return PENDING_ORDER_STAGES.find((entry) => entry.id === stage)?.label ?? stage;
}

/** One order's page: its text, its signature and its workflow. */
export function pendingOrderHref(key: string): string {
  return `/employee/pending-orders/${encodeURIComponent(key)}`;
}

/**
 * The rail's count on Pending orders: what is this seat's move (owner, 2026-10-14) —
 * for the steno, signed orders whose workflows are still to fill; for the magistrate,
 * orders awaiting a signature. Nothing for a seat with no move here, and nothing at zero.
 */
export function pendingOrderCountFor(
  seat: CourtRole,
  orders: PendingOrders,
  signing: OrderSigning,
): number | undefined {
  const stage: PendingOrderStage | null =
    seat === "typist"
      ? "workflow-to-fill"
      : seat === "magistrate"
        ? "awaiting-signature"
        : null;
  if (!stage) return undefined;
  const count = Object.values(orders).filter(
    (order) => pendingOrderStage(order, signing) === stage,
  ).length;
  return count || undefined;
}
