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
 * Stages (order-generation `PND-02`): **Drafting** (not sent for signing). Once sent for
 * signing, an order is in **Awaiting signature** until it is signed and in **Order data
 * to fill** until its order data is complete — in **both at once** while both are
 * outstanding, because the two are worked in parallel (`SND-07`). **Triggered** once it
 * is signed and its order data complete. `inPendingStage` answers "is it in this tab";
 * `pendingOrderStage` names the one stage a badge or a line shows.
 *
 * Every order is here, not only a hearing's: an entry is keyed by the order's own draft
 * key (a hearing id, `cognizance:<case>:<act>`, `application:<id>`) and carries what the
 * list shows about it, recorded when the order is first typed. Its signature lives in
 * `order-signing.ts`, under the same key.
 *
 * Saved in this browser, like the drafts it sits beside (`order-drafts.ts`) and the
 * applications its orders decide: it outlives a reload (owner, 2026-10-14). Nothing here
 * is filed, signed or sent.
 *
 * Read it through `components/employee/use-pending-orders.ts`, never from a render.
 */

import type { CourtId } from "@/lib/court/profiles";
import type { CourtRole } from "./content";
import { seatHolds } from "./seat-roles";
import type { OrderSigning } from "./order-signing";
import { restoreRecord, saveRecord, watchRecord } from "./browser-record";
import { SAMPLE_PENDING_ORDERS } from "./sample-sitting";

/** What the list knows about one order — enough to show it and to reopen it. */
export type PendingOrderMeta = {
  /** The order's draft key — a hearing id, `cognizance:…` or `application:…`. */
  key: string;
  heading: string;
  caseNumber: string;
  /** Where the order comes from: "Hearing · Evidence", "Cognizance", an application. */
  origin: string;
  /** The order's title (`TIT-01`), as the list shows it (`PND-03`). */
  title?: string;
  /** The order screen it is typed on. */
  orderHref: string;
};

export type PendingOrder = PendingOrderMeta & {
  /** Sent for signing from the editor, and not moved back to draft since. */
  sent: boolean;
  /** The steno has marked its workflow complete, and its text has not changed since. */
  workflowComplete: boolean;
  /** Sent for signing at least once — so a later send is a re-send (`SND-08`). */
  everSent?: boolean;
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
  { id: "workflow-to-fill", label: "Order data to fill" },
  { id: "triggered", label: "Triggered" },
];

/* Opens on the demo sitting's orders (`sample-sitting.ts`). */
const OPENING: PendingOrders = Object.freeze({ ...SAMPLE_PENDING_ORDERS });

let orders: PendingOrders = OPENING;
let restored = false;

/* Saved in this browser (`browser-record.ts`), so it outlives a reload. Restored when the
   first component subscribes, or on the first write; the server and hydration read the
   opening value. */
const STORAGE_KEY = "dristi.pending-orders.v1";

function restore(): void {
  if (restored || typeof window === "undefined") return;
  restored = true;
  orders = restoreRecord(STORAGE_KEY, OPENING);
}

/** What the server rendered, and what hydration must agree with. */
export function serverPendingOrders(): PendingOrders {
  return OPENING;
}

const listeners = new Set<() => void>();

export function subscribeToPendingOrders(listener: () => void): () => void {
  listeners.add(listener);
  /* The saved copy loads with the first subscriber — after hydration, so the server and
     the first paint agree — and every subscriber hears it. */
  if (!restored) {
    restore();
    for (const each of listeners) each();
  }
  /* Another tab's save replaces this tab's copy. */
  watchRecord(STORAGE_KEY, () => {
    orders = restoreRecord(STORAGE_KEY, OPENING);
    for (const each of listeners) each();
  });
  return () => {
    listeners.delete(listener);
  };
}

export function readPendingOrders(): PendingOrders {
  return orders;
}

function write(next: PendingOrders) {
  orders = next;
  saveRecord(STORAGE_KEY, orders);
  for (const listener of listeners) listener();
}

/** The editor has words in this order: list it, or bring what the list shows up to date. */
export function noteOrderDraft(meta: PendingOrderMeta): void {
  restore();
  const current = orders[meta.key];
  if (
    current &&
    current.heading === meta.heading &&
    current.caseNumber === meta.caseNumber &&
    current.origin === meta.origin &&
    current.orderHref === meta.orderHref &&
    current.title === meta.title
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
  restore();
  const current = orders[meta.key];
  if (current?.sent) return;
  write({
    ...orders,
    [meta.key]: {
      ...meta,
      sent: true,
      everSent: true,
      /* Sending again after a move back to draft puts completed order data back to not
         complete: its values stay, but it is looked at again against text that may have
         changed (`SND-08`). */
      workflowComplete: current?.everSent ? false : (current?.workflowComplete ?? false),
    },
  });
}

/** A discarded draft leaves the list: it issued nothing and records nothing (`DFT-06`). */
export function removePendingOrder(key: string): void {
  restore();
  const current = orders[key];
  if (!current || current.sent) return;
  const { [key]: _removed, ...rest } = orders;
  void _removed;
  write(rest);
}

/** Back to draft, to be edited further — only before it is signed. */
export function moveOrderBackToDraft(key: string, signing: OrderSigning): void {
  restore();
  const current = orders[key];
  if (!current?.sent || signing[key] === "signed") return;
  write({ ...orders, [key]: { ...current, sent: false } });
}

/**
 * The order's words changed. A completed workflow goes back to incomplete: it was
 * completed against words that are no longer the order's.
 */
export function noteOrderTextEdited(key: string): void {
  restore();
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
  restore();
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

/**
 * Whether an order belongs in a stage's tab. Unlike `pendingOrderStage`, an order sent
 * for signing can be in two at once: Awaiting signature until signed, Order data to fill
 * until its order data is complete (`PND-02`).
 */
export function inPendingStage(
  order: PendingOrder,
  signing: OrderSigning,
  stage: PendingOrderStage,
): boolean {
  const signed = signing[order.key] === "signed";
  if (stage === "triggered") return signed && order.workflowComplete;
  if (stage === "drafting") return !order.sent && !signed;
  if (stage === "awaiting-signature") return order.sent && !signed;
  return (order.sent || signed) && !order.workflowComplete;
}

export function pendingOrderStageLabel(stage: PendingOrderStage): string {
  return PENDING_ORDER_STAGES.find((entry) => entry.id === stage)?.label ?? stage;
}

/**
 * The draft to type after this one, once it is sent for signing: the next order still in
 * Drafting, in the list's own order, after `key` and round again from the top. None when
 * this was the last.
 */
export function nextDraftOrder(
  orders: PendingOrders,
  signing: OrderSigning,
  key: string,
): PendingOrder | null {
  const list = Object.values(orders);
  const at = list.findIndex((order) => order.key === key);
  const after = at < 0 ? list : [...list.slice(at + 1), ...list.slice(0, at)];
  return (
    after.find(
      (order) => order.key !== key && inPendingStage(order, signing, "drafting"),
    ) ?? null
  );
}

/** The Pending orders list, opened on one stage's tab when given. */
export function pendingOrdersHref(tab?: PendingOrderStage): string {
  return tab ? `/employee/pending-orders?tab=${tab}` : "/employee/pending-orders";
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
  court: CourtId = "kerala",
): number | undefined {
  const stage = pendingOrderStageFor(seat, court);
  if (!stage) return undefined;
  const count = Object.values(orders).filter((order) =>
    inPendingStage(order, signing, stage),
  ).length;
  return count || undefined;
}

/**
 * The stage that is this seat's move (`PND-04`), from the roles its state gives it: an
 * order signer's is Awaiting signature, an order data filler's Order data to fill. A
 * seat holding both opens on signing — which one wins is still open in the gap report.
 */
export function pendingOrderStageFor(
  seat: CourtRole,
  court: CourtId,
): PendingOrderStage | null {
  if (seatHolds(seat, court, "order-signer")) return "awaiting-signature";
  if (seatHolds(seat, court, "order-data-filler")) return "workflow-to-fill";
  return null;
}

/** Back to how a fresh browser opens — Reset sandbox data (`sandbox-reset.ts`). */
export function resetPendingOrders(to: PendingOrders = OPENING): void {
  restored = true;
  write(Object.freeze({ ...to }));
}
