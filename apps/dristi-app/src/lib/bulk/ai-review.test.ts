import assert from "node:assert/strict";
import { test } from "node:test";

import type { ApiBatchRequest, ApiCase } from "./contract";
import { documentText } from "./doc-text";
import { buildBatch } from "./intake";
import { caseFlags } from "./scrutiny";
import type { Batch } from "./types";

const iso = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

function pdf(lines: string[]): Uint8Array {
  // The shape the Provakil mock writes: text drawn with Tj.
  return new TextEncoder().encode(`%PDF-1.4\nBT\n${lines.map((l) => `(${l}) Tj`).join("\n")}\nET\n%%EOF`);
}

const c1: ApiCase = {
  reference: "AI-1",
  accused: [{ type: "individual", name: "Shree Ganesh Traders", mobile: "9824000001", addresses: [{ line1: "x", city: "Vadodara", pin: "380009" }] }],
  cheques: [{ number: "123456", date: iso(60), amount: "152000", ifsc: "SBIN0060421", presentedOn: iso(50), returnedOn: iso(47), returnReason: "funds-insufficient" }],
  notices: [{ natureOfDebt: "loan", dispatchedOn: iso(30), mode: "rpad", delivered: true, deliveredOn: iso(30), replied: false, payment: { status: "none" } }],
  jurisdiction: { depositedInOwnAccount: true, complainantBranchIfsc: "HDFC0000060" },
  documents: [{ code: "DCM-1", name: "cheque.pdf", url: "x" }],
};

async function batchOf(): Promise<Batch> {
  const req: ApiBatchRequest = {
    source: { system: "Test" },
    complainant: { type: "institution", name: "Tata Capital Ltd", address: { line1: "x", city: "Mumbai", pin: "400013" } },
    advocates: [{ barNumber: "G/831/2011" }],
    cases: [c1],
  };
  const bytes = pdf(["Cheque", "Cheque no. 123456 dated x for Rs 1,25,000"]);
  const b = await buildBatch(req, { kind: "api", system: "Test" }, async () => ({
    id: "bf_test",
    name: "cheque.pdf",
    size: bytes.length,
    type: "application/pdf",
    ext: "PDF",
    text: documentText(bytes, "application/pdf"),
  }));
  return { ...b, number: "BLK-T" };
}

test("document text is read from a simple PDF; a scan reads as nothing", () => {
  assert.match(documentText(pdf(["Rs 1,25,000"]), "application/pdf") ?? "", /1,25,000/);
  assert.equal(documentText(new Uint8Array([0xff, 0xd8, 0xff]), "image/jpeg"), null);
});

test("with AI on, the review compares the cheque with the case and flags odd values", async () => {
  const batch = await batchOf();
  const ai = caseFlags(batch.cases[0], { batch, others: [], ai: "on" }).filter((f) => f.source === "ai");
  const rules = ai.map((f) => f.id.split(":")[0]);
  assert.ok(rules.includes("ai-doc-cheque-amount"), rules.join());
  assert.ok(rules.includes("ai-name-looks-like-firm"));
  assert.ok(rules.includes("ai-city-pincode"));
  assert.ok(rules.includes("ai-delivered-same-day"));
  assert.ok(ai.every((f) => f.level === "soft"), "AI never holds a case");
});

test("with AI off or unavailable, there are no AI flags at all", async () => {
  const batch = await batchOf();
  for (const mode of ["off", "unavailable"] as const) {
    assert.equal(caseFlags(batch.cases[0], { batch, others: [], ai: mode }).filter((f) => f.source === "ai").length, 0);
  }
});
