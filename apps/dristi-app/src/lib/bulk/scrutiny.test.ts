import assert from "node:assert/strict";
import { test } from "node:test";

import type { ApiBatchRequest, ApiCase } from "./contract";
import { buildBatch } from "./intake";
import { caseFlags, caseStage, openFlags } from "./scrutiny";
import type { Batch } from "./types";

const iso = (daysAgo: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
};

function goodCase(reference: string, over: Partial<ApiCase> = {}): ApiCase {
  return {
    reference,
    accused: [
      {
        type: "individual",
        name: "Bhavesh N. Thakkar",
        mobile: "9824000001",
        addresses: [{ line1: "22, Swastik Society, Navrangpura", city: "Ahmedabad", pin: "380009" }],
      },
    ],
    cheques: [
      {
        number: "123456",
        date: iso(60),
        amount: "125000",
        ifsc: "SBIN0060421",
        presentedOn: iso(50),
        returnedOn: iso(47),
        returnReason: "funds-insufficient",
      },
    ],
    notices: [
      {
        natureOfDebt: "loan",
        dispatchedOn: iso(40),
        mode: "rpad",
        delivered: true,
        deliveredOn: iso(30),
        replied: false,
        payment: { status: "none" },
      },
    ],
    jurisdiction: { depositedInOwnAccount: true, complainantBranchIfsc: "HDFC0000060" },
    ...over,
  };
}

const request = (cases: ApiCase[]): ApiBatchRequest => ({
  source: { system: "Test" },
  complainant: {
    type: "institution",
    institutionType: "public-limited",
    name: "Tata Capital Ltd",
    cinPan: "U65990MH1991PLC000000",
    address: { line1: "Peninsula Business Park", city: "Mumbai", pin: "400013" },
    representative: {
      name: "Rajesh K. Patel",
      designation: "Chief Manager, Legal",
      age: "48",
      mobile: "9825011420",
      address: { line1: "Regional Office, C G Road", city: "Ahmedabad", pin: "380009" },
    },
  },
  advocates: [{ barNumber: "G/1187/2011" }],
  cases,
});

async function batchOf(cases: ApiCase[]): Promise<Batch> {
  const b = await buildBatch(request(cases), { kind: "api", system: "Test" }, async () => null);
  return { ...b, number: "BLK-TEST-0001" };
}

test("a complete case is held only for its documents, which the API did not send", async () => {
  const batch = await batchOf([goodCase("A-1")]);
  const flags = caseFlags(batch.cases[0], { batch, others: [] });
  assert.ok(flags.length > 0);
  assert.ok(flags.every((f) => f.section === "documents" && f.level === "hold"), JSON.stringify(flags.map((f) => f.field)));
  assert.equal(caseStage(batch.cases[0], flags), "held");
});

test("rules name the field and the level", async () => {
  const batch = await batchOf([
    goodCase("B-1", {
      accused: [{ type: "individual", name: "Kiran Parmar", mobile: "98250 1234", addresses: [{ line1: "x", city: "Ahmedabad", pin: "380009" }] }],
    }),
  ]);
  const by = (field: string) => caseFlags(batch.cases[0], { batch, others: [] }).filter((f) => f.field === field);
  assert.equal(by("ACC-6")[0]?.level, "hold");
});

test("a return reason other than insufficient funds is a check, and skipping it clears it", async () => {
  const batch = await batchOf([
    goodCase("C-1", { cheques: [{ ...goodCase("x").cheques[0], returnReason: "payment-stopped" }] }),
  ]);
  const bc = batch.cases[0];
  const soft = caseFlags(bc, { batch, others: [] }).find((f) => f.field === "CHQ-10");
  assert.equal(soft?.level, "soft");
  bc.skipped.push(soft!.id);
  assert.ok(!openFlags(bc, { batch, others: [] }).some((f) => f.id === soft!.id));
});

test("a list value the court does not know is held, never guessed", async () => {
  const batch = await batchOf([
    goodCase("D-1", { cheques: [{ ...goodCase("x").cheques[0], returnReason: "01 - Funds Insufficient" }] }),
  ]);
  const f = caseFlags(batch.cases[0], { batch, others: [] }).find((x) => x.rule === "chq-10-list");
  assert.equal(f?.level, "hold");
  assert.match(f!.message, /01 - Funds Insufficient/);
});

test("a late case needs a reason for condonation; a notice in transit holds the case", async () => {
  const late = goodCase("E-1", {
    cheques: [{ ...goodCase("x").cheques[0], date: iso(140), presentedOn: iso(130), returnedOn: iso(125) }],
    notices: [{ ...goodCase("x").notices[0], dispatchedOn: iso(110), deliveredOn: iso(100) }],
  });
  const transit = goodCase("E-2", { notices: [{ ...goodCase("x").notices[0], delivered: null, deliveredOn: undefined }] });
  const batch = await batchOf([late, transit]);
  const [a, b] = batch.cases.map((bc) => caseFlags(bc, { batch, others: [] }));
  assert.ok(a.some((f) => f.field === "JUR-12" && f.level === "hold"));
  assert.ok(b.some((f) => f.field === "LDN-5" && f.level === "hold"));
});

test("the same cheque twice in a batch holds the second", async () => {
  const batch = await batchOf([goodCase("F-1"), goodCase("F-2")]);
  const second = caseFlags(batch.cases[1], { batch, others: [] });
  assert.ok(second.some((f) => f.rule === "chq-dup"));
  assert.ok(!caseFlags(batch.cases[0], { batch, others: [] }).some((f) => f.rule === "chq-dup"));
});

test("derived values are never taken from the sender", async () => {
  const batch = await batchOf([goodCase("G-1")]);
  const j = batch.cases[0].draft.jurisdiction;
  assert.equal(j.causeDate, "");
  assert.equal(j.filingDate, "");
});

test("every hold that a filer can correct carries its fix inline, documents as upload slots", async () => {
  const batch = await batchOf([
    goodCase("H-1", {
      accused: [{ type: "institution", name: "Navkar Foods Pvt Ltd", institutionType: "private-limited", mobile: "98250 1234", addresses: [{ line1: "x", city: "Ahmedabad", pin: "38001" }] }],
      notices: [{ ...goodCase("x").notices[0], delivered: null, deliveredOn: undefined }],
      cheques: [{ ...goodCase("x").cheques[0], ifsc: "HDFC00521", returnReason: "Funds Insuff." }],
    }),
  ]);
  batch.cases[0].draft.advocates[0].name = "";
  const holds = caseFlags(batch.cases[0], { batch, others: [] }).filter((f) => f.level === "hold");
  // Waiting for a date, or a duplicate cheque, has nothing to correct in place.
  const exempt = /^(jur-9-early|chq-dup|section-)/;
  const bare = holds.filter((f) => !exempt.test(f.rule) && (!f.fix || f.fix.kind === "documents"));
  assert.deepEqual(bare.map((f) => f.rule), []);
  assert.ok(holds.some((f) => f.fix?.kind === "upload"));
  for (const rule of ["acc-14", "ldn-5", "adv-3", "acc-6-format", "acc-8-pin", "chq-5", "chq-10-list"]) {
    assert.ok(holds.some((f) => f.rule === rule && f.fix), `${rule} has a fix`);
  }
});
