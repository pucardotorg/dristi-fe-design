import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { LifecycleApplication } from "@/lib/applications/lifecycle";

import {
  applicationOrderOutcomes,
  outcomeApplies,
  outcomeHearingDate,
} from "./application-order-outcome";
import type { ComposerBlock, ItemBlock } from "./order-composer";
import type { OrderTemplateId } from "./order-templates";

function item(type: string, applicationId?: string): ItemBlock {
  return {
    id: `${type}-${applicationId ?? "none"}`,
    kind: "item",
    type: type as OrderTemplateId,
    values: {},
    text: "",
    edited: false,
    applicationId,
  };
}

function app(
  status: LifecycleApplication["status"],
  type = "production-of-documents",
): LifecycleApplication {
  return { id: "a1", status, type } as LifecycleApplication;
}

describe("applicationOrderOutcomes", () => {
  it("reads accept, reject and dismiss items that name an application", () => {
    const blocks: ComposerBlock[] = [
      item("accept-application", "a1"),
      item("reject-application", "a2"),
      item("dismiss-application", "a3"),
      item("issue-of-summons"),
      item("accept-application"),
    ];
    assert.deepEqual(applicationOrderOutcomes(blocks), [
      { applicationId: "a1", kind: "accept" },
      { applicationId: "a2", kind: "reject" },
      { applicationId: "a3", kind: "dismiss" },
    ]);
  });

  it("takes the first decision on one application", () => {
    assert.deepEqual(
      applicationOrderOutcomes([
        item("reject-application", "a1"),
        item("accept-application", "a1"),
      ]),
      [{ applicationId: "a1", kind: "reject" }],
    );
  });
});

describe("outcomeApplies", () => {
  it("dismisses only before onboarding, decides only while pending decision", () => {
    const dismiss = { applicationId: "a1", kind: "dismiss" as const };
    const accept = { applicationId: "a1", kind: "accept" as const };
    assert.equal(outcomeApplies(dismiss, app("pending-review")), true);
    assert.equal(outcomeApplies(dismiss, app("pending-decision")), false);
    assert.equal(outcomeApplies(accept, app("pending-decision")), true);
    assert.equal(outcomeApplies(accept, app("accepted")), false);
  });
});

describe("outcomeHearingDate", () => {
  const accept = { applicationId: "a1", kind: "accept" as const };

  it("carries the order's next hearing for a Postpone acceptance", () => {
    assert.equal(
      outcomeHearingDate(accept, app("pending-decision", "postpone"), {
        next: "list",
        nextDate: "2026-11-02",
      }),
      "2026-11-02",
    );
  });

  it("has none when the matter is not listed again, or the type moves no hearing", () => {
    assert.equal(
      outcomeHearingDate(accept, app("pending-decision", "postpone"), {
        next: "none",
        nextDate: "2026-11-02",
      }),
      undefined,
    );
    assert.equal(
      outcomeHearingDate(accept, app("pending-decision"), {
        next: "list",
        nextDate: "2026-11-02",
      }),
      undefined,
    );
  });
});
