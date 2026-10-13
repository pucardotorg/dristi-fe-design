import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_SIGN_ORDER_FILTERS,
  SIGN_ORDER_PENDING_COUNT,
  SIGN_ORDER_QUEUE,
  SIGN_ORDER_STATUSES,
  SIGN_ORDER_TYPES,
  buildSignOrderDocument,
  filterSignOrders,
  signOrderDocumentText,
  signOrderStatusLabel,
  signOrderTypeLabel,
  signSelectedOrders,
} from "./sign-orders";

const PENDING = SIGN_ORDER_QUEUE.filter(
  (order) => order.status === "pending-signature",
);

describe("SIGN_ORDER_QUEUE", () => {
  it("is long enough to page, and the rail's count is the pending rows only", () => {
    assert.equal(SIGN_ORDER_QUEUE.length, 24);
    assert.equal(PENDING.length, 18);
    assert.equal(SIGN_ORDER_PENDING_COUNT, PENDING.length);
  });

  it("runs newest first, so the queue is worked from what was just drawn up", () => {
    const dates = SIGN_ORDER_QUEUE.map((order) => order.addedOn);
    assert.deepEqual(
      dates,
      [...dates].sort((a, b) => b.localeCompare(a)),
    );
  });

  it("holds a row for every title the preview can write", () => {
    const titlesInQueue = new Set(SIGN_ORDER_QUEUE.map((order) => order.type));
    for (const type of SIGN_ORDER_TYPES) {
      assert.ok(
        titlesInQueue.has(type.id),
        `the catalogue offers ${type.id} but the queue has none`,
      );
    }
  });

  it("holds a row in both states the status filter offers", () => {
    const statusesInQueue = new Set(
      SIGN_ORDER_QUEUE.map((order) => order.status),
    );
    for (const status of SIGN_ORDER_STATUSES) {
      assert.ok(
        statusesInQueue.has(status.id),
        `the filter offers ${status.id} but the queue has none`,
      );
    }
  });

  it("carries four separate orders in one case — the reason the title is the row's emphasis", () => {
    const inOneCase = SIGN_ORDER_QUEUE.filter(
      (order) => order.caseNumber === "ST/606/2026",
    );
    assert.equal(inOneCase.length, 4);
    assert.equal(new Set(inOneCase.map((order) => order.type)).size, 4);
  });

  it("stamps a signed date on a signed order and none on a pending one", () => {
    for (const order of SIGN_ORDER_QUEUE) {
      if (order.status === "signed") {
        assert.ok(order.signedOn, `${order.id} is signed with no date`);
        assert.ok(
          order.signedOn! >= order.addedOn,
          `${order.id} was signed before it was drawn up`,
        );
      } else {
        assert.equal(order.signedOn, undefined);
      }
    }
  });

  it("does not reuse a case number from another court-side queue", () => {
    /* The queues are separate demo fixtures on purpose — a number in two of them reads
       as one case in two places. These blocks are this queue's own. */
    for (const order of SIGN_ORDER_QUEUE) {
      assert.match(order.caseNumber, /^(ST\/6\d\d|CMP\/10\d\d)\/2026$/);
    }
  });
});

describe("filterSignOrders", () => {
  it("opens on the pending orders, as the reference's own filter does", () => {
    const rows = filterSignOrders(
      SIGN_ORDER_QUEUE,
      DEFAULT_SIGN_ORDER_FILTERS,
    );
    assert.equal(rows.length, PENDING.length);
    assert.ok(rows.every((row) => row.status === "pending-signature"));
  });

  it("returns the whole queue when the status filter is cleared to all", () => {
    const rows = filterSignOrders(SIGN_ORDER_QUEUE, {
      ...DEFAULT_SIGN_ORDER_FILTERS,
      status: "all",
    });
    assert.equal(rows.length, SIGN_ORDER_QUEUE.length);
  });

  it("narrows to the orders already signed", () => {
    const rows = filterSignOrders(SIGN_ORDER_QUEUE, {
      ...DEFAULT_SIGN_ORDER_FILTERS,
      status: "signed",
    });
    assert.equal(rows.length, 6);
    assert.ok(rows.every((row) => row.status === "signed"));
  });

  it("narrows to one day", () => {
    const rows = filterSignOrders(SIGN_ORDER_QUEUE, {
      ...DEFAULT_SIGN_ORDER_FILTERS,
      addedOn: "2026-08-24",
    });
    assert.equal(rows.length, 3);
    assert.ok(rows.every((row) => row.addedOn === "2026-08-24"));
  });

  it("matches a cause or a number", () => {
    assert.equal(
      filterSignOrders(SIGN_ORDER_QUEUE, {
        ...DEFAULT_SIGN_ORDER_FILTERS,
        query: "thangasseri",
      }).length,
      4,
    );
    assert.equal(
      filterSignOrders(SIGN_ORDER_QUEUE, {
        ...DEFAULT_SIGN_ORDER_FILTERS,
        query: "ST/611/2026",
      })[0]?.id,
      "so-611",
    );
  });

  it("finds a signed order by name only once the status filter allows it", () => {
    assert.equal(
      filterSignOrders(SIGN_ORDER_QUEUE, {
        ...DEFAULT_SIGN_ORDER_FILTERS,
        query: "thomas kurien",
      }).length,
      0,
    );
    assert.equal(
      filterSignOrders(SIGN_ORDER_QUEUE, {
        status: "all",
        addedOn: "",
        query: "thomas kurien",
      }).length,
      1,
    );
  });

  it("combines all three filters, and returns nothing when they cannot all hold", () => {
    assert.deepEqual(
      filterSignOrders(SIGN_ORDER_QUEUE, {
        status: "pending-signature",
        addedOn: "2026-08-24",
        query: "rajesh varma",
      }).map((row) => row.id),
      ["so-606-a", "so-606-b", "so-606-c"],
    );
    assert.equal(
      filterSignOrders(SIGN_ORDER_QUEUE, {
        status: "signed",
        addedOn: "2026-08-24",
        query: "",
      }).length,
      0,
    );
  });

  it("treats surrounding spaces as no query", () => {
    const rows = filterSignOrders(SIGN_ORDER_QUEUE, {
      ...DEFAULT_SIGN_ORDER_FILTERS,
      query: "  ",
    });
    assert.equal(rows.length, PENDING.length);
  });
});

describe("signSelectedOrders", () => {
  it("signs the chosen pending orders and stamps the day", () => {
    const next = signSelectedOrders(
      SIGN_ORDER_QUEUE,
      new Set(["so-611", "so-618"]),
      "2026-09-03",
    );
    const signed = next.filter((order) => order.status === "signed");
    assert.equal(signed.length, 8);
    for (const id of ["so-611", "so-618"]) {
      const order = next.find((entry) => entry.id === id);
      assert.equal(order?.status, "signed");
      assert.equal(order?.signedOn, "2026-09-03");
    }
  });

  it("leaves everything it was not given alone", () => {
    const next = signSelectedOrders(
      SIGN_ORDER_QUEUE,
      new Set(["so-611"]),
      "2026-09-03",
    );
    assert.equal(
      next.filter((order) => order.status === "pending-signature").length,
      PENDING.length - 1,
    );
    assert.equal(SIGN_ORDER_QUEUE.find((o) => o.id === "so-611")?.status, "pending-signature");
  });

  it("ignores an id that is already signed, and one that is nobody's", () => {
    const next = signSelectedOrders(
      SIGN_ORDER_QUEUE,
      new Set(["so-642", "so-nobody"]),
      "2026-09-03",
    );
    /* so-642 keeps the date it was actually signed on rather than today's. */
    assert.equal(next.find((order) => order.id === "so-642")?.signedOn, "2026-04-29");
    assert.equal(
      next.filter((order) => order.status === "signed").length,
      6,
    );
  });
});

describe("the vocabulary this screen names", () => {
  it("uses the case register's own words, in the DS's sentence case", () => {
    assert.equal(
      signOrderTypeLabel("approve-voluntary-submissions"),
      "Approve voluntary submissions",
    );
    assert.equal(
      signOrderTypeLabel("reject-voluntary-submissions"),
      "Reject voluntary submissions",
    );
    /* ADR keeps its capitals — a statutory short form, like CNR. */
    assert.equal(signOrderTypeLabel("refer-case-to-adr"), "Refer case to ADR");
    assert.equal(signOrderTypeLabel("others"), "Others");
  });

  it("names both signing states", () => {
    assert.equal(signOrderStatusLabel("pending-signature"), "Pending signature");
    assert.equal(signOrderStatusLabel("signed"), "Signed");
  });

  it("offers the six titles the queue can preview", () => {
    assert.equal(SIGN_ORDER_TYPES.length, 6);
  });
});

describe("buildSignOrderDocument", () => {
  it("writes an order that names its court, its case and the party who moved it", () => {
    const order = SIGN_ORDER_QUEUE.find((entry) => entry.id === "so-611")!;
    const document = buildSignOrderDocument(order);
    assert.equal(document.court, "Before the JMFC Court 1");
    assert.equal(document.caseNumber, "ST/611/2026");
    assert.equal(document.matter, "Beena Sasidharan v. Anwar Rasheed");
    assert.equal(document.title, "Bail");
    assert.equal(document.paragraphs.length, 2);
    assert.ok(document.paragraphs[0].includes("Anwar Rasheed"));
    assert.equal(document.dated, "18 August 2026");
  });

  it("says whether the signature is on it, rather than drawing an empty rule", () => {
    const pending = buildSignOrderDocument(
      SIGN_ORDER_QUEUE.find((entry) => entry.id === "so-611")!,
    );
    assert.equal(pending.signature, "Pending the signature of the magistrate.");

    const signed = buildSignOrderDocument(
      SIGN_ORDER_QUEUE.find((entry) => entry.id === "so-642")!,
    );
    assert.equal(
      signed.signature,
      "Signed by the magistrate, JMFC Court 1, on 29 April 2026.",
    );
  });

  it("opens every title with a sentence, and recites no sum it does not have", () => {
    for (const order of SIGN_ORDER_QUEUE) {
      const document = buildSignOrderDocument(order);
      for (const paragraph of document.paragraphs) {
        assert.match(paragraph, /^[A-Z]/, `${order.id}: ${paragraph}`);
        assert.doesNotMatch(paragraph, /₹|Rs\.?\s*\d/, `${order.id} names a figure`);
      }
    }
  });

  it("writes the downloadable text in the order the paper reads", () => {
    const order = SIGN_ORDER_QUEUE.find((entry) => entry.id === "so-1014")!;
    const text = signOrderDocumentText(buildSignOrderDocument(order));
    const lines = text.split("\n");
    assert.equal(lines[0], "Before the JMFC Court 1");
    assert.equal(lines[1], "Case no. CMP/1014/2026");
    assert.ok(text.includes("1. On a reading of the papers"));
    assert.ok(text.includes("2. The case is referred to the mediation centre"));
    assert.ok(text.trimEnd().endsWith("Pending the signature of the magistrate."));
  });
});
