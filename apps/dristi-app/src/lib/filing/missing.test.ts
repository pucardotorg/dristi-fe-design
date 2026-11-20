import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createBlankDraft } from "./blank";
import { missingRequired } from "./missing";
import type { FilingDraft } from "./types";

const names = (draft: FilingDraft, step: Parameters<typeof missingRequired>[1]) =>
  missingRequired(draft, step).map((m) => `${m.instance}:${m.name}`);

const ADDRESS = { line1: "12 MG Road", city: "Ahmedabad", pin: "380009", district: "Ahmedabad", state: "Gujarat" };

describe("missingRequired — the complainant", () => {
  it("lists every empty field with an asterisk, in screen order", () => {
    const d = createBlankDraft("t");
    assert.deepEqual(names(d, "complainant"), [
      "0:mobile",
      "0:name",
      "0:age",
      "0:res.pin",
      "0:res.city",
      "0:res.district",
      "0:res.state",
      "0:res.line1",
    ]);
  });

  it("counts a field the tick does not need", () => {
    const d = createBlankDraft("t");
    Object.assign(d.complainants[0], { mobile: "9825041177", name: "Ramesh Patel", res: { ...ADDRESS } });
    assert.deepEqual(names(d, "complainant"), ["0:age"]);
  });

  it("asks for the PoA holder only when there is one, and never for a party in person", () => {
    const d = createBlankDraft("t");
    const c = d.complainants[0];
    c.poa = "yes";
    assert.ok(names(d, "complainant").includes("0:poaHolder.name"));
    c.pip = "yes";
    assert.ok(!names(d, "complainant").some((n) => n.includes("poaHolder")));
  });

  it("keys each complainant by its own index", () => {
    const d = createBlankDraft("t");
    d.complainants.push(structuredClone(d.complainants[0]));
    assert.ok(names(d, "complainant").includes("1:age"));
  });

  it("accepts a skipped CIN or PAN", () => {
    const d = createBlankDraft("t");
    const c = d.complainants[0];
    c.type = "institution";
    assert.ok(names(d, "complainant").includes("0:entCinPan"));
    c.entCinPanSkippedAt = "2026-10-30T10:00:00.000Z";
    assert.ok(!names(d, "complainant").includes("0:entCinPan"));
  });
});

describe("missingRequired — conditional fields", () => {
  it("asks a later cheque for its bank only when it differs from the previous one", () => {
    const d = createBlankDraft("t");
    d.cheques.push(structuredClone(d.cheques[0]));
    d.cheques[1].sameAsPrev = "yes";
    assert.ok(!names(d, "cheque").some((n) => n.startsWith("1:") && n.includes("bank")));
    d.cheques[1].sameAsPrev = "no";
    assert.ok(names(d, "cheque").includes("1:bankName"));
  });

  it("follows the notice's delivery answer", () => {
    const d = createBlankDraft("t");
    const n = d.notices[0];
    n.delivered = "yes";
    assert.ok(names(d, "demand-notice").includes("0:deliveryDate"));
    assert.ok(!names(d, "demand-notice").includes("0:nonDeliveryReason"));
    n.delivered = "no";
    assert.ok(names(d, "demand-notice").includes("0:nonDeliveryReason"));
    assert.ok(!names(d, "demand-notice").includes("0:deliveryDate"));
  });

  it("asks nothing of the advocate step when every complainant appears in person", () => {
    const d = createBlankDraft("t");
    d.complainants[0].pip = "yes";
    assert.deepEqual(names(d, "advocate"), []);
  });

  it("leaves the blank witness a new draft opens on alone, and asks a started one", () => {
    const d = createBlankDraft("t");
    assert.deepEqual(names(d, "witnesses"), []);
    d.witnesses[0].age = "40";
    assert.ok(names(d, "witnesses").includes("0:identity"));
    d.witnesses[0].designation = "Branch manager";
    assert.ok(!names(d, "witnesses").includes("0:identity"));
  });

  it("has nothing to ask on steps without fields of their own", () => {
    const d = createBlankDraft("t");
    for (const step of ["upload", "affidavit", "preview", "sign", "documents", "adr-prayer"] as const) {
      assert.deepEqual(missingRequired(d, step), [], step);
    }
  });
});
