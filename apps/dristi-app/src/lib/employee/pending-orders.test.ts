import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  moveOrderBackToDraft,
  noteOrderTextEdited,
  readPendingOrders,
  sendOrderForSigning,
  setOrderWorkflowComplete,
  inPendingStage,
  pendingOrderCountFor,
  pendingOrderStage,
  type PendingOrder,
} from "./pending-orders";

const order: PendingOrder = {
  key: "cognizance:c-1:notice",
  heading: "A v. B",
  caseNumber: "ST/1/2026",
  origin: "Cognizance",
  orderHref: "/employee/cognizance/c-1/order",
  sent: false,
  workflowComplete: false,
};

describe("pending orders", () => {
  it("triggers once it is both signed and its workflow complete, in either order", () => {
    const signed = { [order.key]: "signed" as const };
    assert.equal(pendingOrderStage(order, {}), "drafting");
    const sent = { ...order, sent: true };
    assert.equal(pendingOrderStage(sent, { [order.key]: "ready" }), "awaiting-signature");
    /* Workflow first: still the magistrate's move; signing then triggers it. */
    const complete = { ...sent, workflowComplete: true };
    assert.equal(pendingOrderStage(complete, {}), "awaiting-signature");
    assert.equal(pendingOrderStage(complete, signed), "triggered");
    /* Signature first: the steno's move; completing then triggers it. */
    assert.equal(pendingOrderStage(sent, signed), "workflow-to-fill");
  });

  it("counts each seat's own move on the rail, from its state's roles, and nothing at zero", () => {
    const orders = { [order.key]: { ...order, sent: true } };
    /* Sent and unsigned: awaiting the signer, and the filler's to fill at the same time
       (`PND-02`). */
    assert.equal(pendingOrderCountFor("magistrate", orders, {}), 1);
    assert.equal(pendingOrderCountFor("typist", orders, {}), 1);
    assert.equal(pendingOrderCountFor("bench-clerk", orders, {}), 1);
    const signed = { [order.key]: "signed" as const };
    assert.equal(pendingOrderCountFor("magistrate", orders, signed), undefined);
    assert.equal(pendingOrderCountFor("typist", orders, signed), 1);
    /* Punjab & Haryana's typist fills nothing; its Ahlmad does (court-roles §3.3). */
    assert.equal(pendingOrderCountFor("typist", orders, signed, "punjab-haryana"), undefined);
    assert.equal(pendingOrderCountFor("ahlmad", orders, signed, "punjab-haryana"), 1);
  });

  it("puts a sent order in Awaiting signature and Order data to fill at once", () => {
    const sent = { ...order, sent: true };
    assert.equal(inPendingStage(sent, {}, "awaiting-signature"), true);
    assert.equal(inPendingStage(sent, {}, "workflow-to-fill"), true);
    assert.equal(inPendingStage({ ...sent, workflowComplete: true }, {}, "workflow-to-fill"), false);
    assert.equal(inPendingStage(order, {}, "workflow-to-fill"), false);
  });

  it("goes back to draft until signed, and editing undoes a completed workflow", () => {
    const meta = { ...order, key: "h-77" };
    sendOrderForSigning(meta);
    setOrderWorkflowComplete("h-77", true, {});
    assert.equal(readPendingOrders()["h-77"].workflowComplete, true);

    moveOrderBackToDraft("h-77", {});
    assert.equal(readPendingOrders()["h-77"].sent, false);
    /* Moving back alone changes nothing about the workflow; editing does. */
    assert.equal(readPendingOrders()["h-77"].workflowComplete, true);
    noteOrderTextEdited("h-77");
    assert.equal(readPendingOrders()["h-77"].workflowComplete, false);

    /* Once signed, it cannot go back, and a completed workflow cannot be reopened. */
    sendOrderForSigning(meta);
    setOrderWorkflowComplete("h-77", true, {});
    const signed = { "h-77": "signed" as const };
    moveOrderBackToDraft("h-77", signed);
    setOrderWorkflowComplete("h-77", false, signed);
    assert.equal(readPendingOrders()["h-77"].sent, true);
    assert.equal(readPendingOrders()["h-77"].workflowComplete, true);
    assert.equal(pendingOrderStage(readPendingOrders()["h-77"], signed), "triggered");
  });

  it("puts completed order data back to not complete when sent for signing again", () => {
    const meta = { ...order, key: "h-78" };
    sendOrderForSigning(meta);
    setOrderWorkflowComplete("h-78", true, {});
    moveOrderBackToDraft("h-78", {});
    assert.equal(readPendingOrders()["h-78"].workflowComplete, true);
    /* `SND-08`: the values stay, but it has to be looked at again. */
    sendOrderForSigning(meta);
    assert.equal(readPendingOrders()["h-78"].workflowComplete, false);
  });
});
