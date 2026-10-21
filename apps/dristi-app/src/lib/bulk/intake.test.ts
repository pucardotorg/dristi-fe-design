import assert from "node:assert/strict";
import { test } from "node:test";

import type { ApiBatchRequest, ApiCase } from "./contract";
import { buildBatch } from "./intake";

function oneCase(over: Partial<ApiCase> = {}): ApiCase {
  return {
    reference: "R-1",
    accused: [{ type: "individual", name: "A One", addresses: [{ line1: "x", city: "Mumbai", pin: "400013" }] }],
    cheques: [
      {
        number: "123456",
        date: "2026-07-01",
        amount: "1000",
        // Malformed on purpose: the register does not know it, and nothing is fetched.
        ifsc: "NOTANIFSC",
        bankName: "Shree Co-op Bank",
        bankBranch: "Kalupur",
        presentedOn: "2026-07-10",
        returnedOn: "2026-07-12",
        returnReason: "funds-insufficient",
      },
    ],
    notices: [
      {
        natureOfDebt: "loan",
        dispatchedOn: "2026-07-20",
        mode: "rpad",
        delivered: false,
        returnedOn: "2026-07-25",
        nonDeliveryReason: "refused",
        replied: true,
        payment: { status: "none" },
      },
    ],
    jurisdiction: {
      depositedInOwnAccount: true,
      complainantBranchIfsc: "NOTANIFSC",
      complainantBankName: "Payee Bank",
      complainantBankBranch: "Payee Branch",
      complainantBranchPoliceStation: "Navrangpura Police Station",
    },
    ...over,
  };
}

const request = (c: ApiCase, adr?: ApiBatchRequest["adr"]): ApiBatchRequest => ({
  source: { system: "Test" },
  complainant: { type: "institution", name: "Lender Ltd", address: { line1: "x", city: "Mumbai", pin: "400013" } },
  advocates: [],
  adr,
  cases: [c],
});

const draftOf = async (c: ApiCase, adr?: ApiBatchRequest["adr"]) =>
  (await buildBatch(request(c, adr), { kind: "api", system: "Test" }, async () => null)).cases[0].draft;

test("bank names sent are kept when the register does not know the IFSC", async () => {
  const d = await draftOf(oneCase());
  assert.equal(d.cheques[0].bankName, "Shree Co-op Bank");
  assert.equal(d.cheques[0].bankBranch, "Kalupur");
  assert.equal(d.cheques[0].ifscFetched, false);
  assert.equal(d.jurisdiction.payeeBankName, "Payee Bank");
  assert.equal(d.jurisdiction.payeeBankBranch, "Payee Branch");
});

test("the register's bank names win when it knows the IFSC", async () => {
  const c = oneCase();
  c.cheques[0].ifsc = "SBIN0060421";
  const d = await draftOf(c);
  assert.equal(d.cheques[0].bankName, "State Bank of India");
  assert.equal(d.cheques[0].ifscFetched, true);
});

test("jurisdiction as sent; otherwise read from the address", async () => {
  // 400013 is Mumbai, outside the court's district.
  assert.equal((await draftOf(oneCase())).accused[0].jurisdiction, "no");
  const sent = oneCase();
  sent.accused[0].withinJurisdiction = true;
  assert.equal((await draftOf(sent)).accused[0].jurisdiction, "yes");
});

test("a reply is recorded only for a delivered notice, as the filing asks it", async () => {
  assert.equal((await draftOf(oneCase())).notices[0].replied, "no");
});

test("ADR takes the filing's three answers", async () => {
  assert.equal((await draftOf(oneCase(), "maybe")).adr.adr, "maybe");
});

test("additional details become the rich text the filing holds, escaped", async () => {
  const d = await draftOf(oneCase({ otherDetails: "Line <one>\n\nLine & two" }));
  assert.equal(d.adr.otherDetails, "<p>Line &lt;one&gt;</p><p>Line &amp; two</p>");
});
