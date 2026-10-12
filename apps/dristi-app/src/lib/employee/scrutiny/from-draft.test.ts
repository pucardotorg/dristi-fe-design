import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildScrutinyCase, HERO_FILING_NO } from "./case";
import { QUEUE } from "./fixtures";
import { mockFiling } from "./mock-filings";
import type { ScrutinyCase } from "./types";

function open(no: string): ScrutinyCase {
  const filing = QUEUE.find((f) => f.no === no);
  assert.ok(filing, `no queue row ${no}`);
  return buildScrutinyCase(filing);
}

const S138 = QUEUE.filter((f) => mockFiling(f.no));

describe("scrutiny reads the e-filing draft", () => {
  it("backs every §138 row in the queue with a draft", () => {
    for (const f of QUEUE) {
      if (/138/.test(f.type)) assert.ok(mockFiling(f.no), `${f.no} has no draft`);
    }
  });

  it("gives every field a unique id, and every document row a page in the bundle", () => {
    for (const f of S138) {
      const c = open(f.no);
      assert.equal(new Set(c.allFields.map((x) => x.id)).size, c.allFields.length, f.no);
      for (const field of c.allFields) {
        if (field.docrow) assert.ok(c.docById[field.docrow], `${f.no} ${field.id}`);
        if (field.doc) assert.ok(c.docById[field.doc], `${f.no} ${field.id} → ${field.doc}`);
      }
    }
  });

  it("states every filed value the form holds, never a blank row", () => {
    for (const f of S138) {
      for (const field of open(f.no).allFields) {
        assert.ok(field.value.trim(), `${f.no} ${field.id} is blank`);
      }
    }
  });

  it("shows every complainant, advocate, accused, cheque, notice and witness", () => {
    for (const f of S138) {
      const { draft } = mockFiling(f.no)!;
      const ids = new Set(open(f.no).allFields.map((x) => x.id));
      draft.complainants.forEach((_, i) => assert.ok(ids.has(`c${i + 1}-type`), f.no));
      draft.advocates.forEach((_, i) => assert.ok(ids.has(`adv${i + 1}-bar`), f.no));
      draft.accused.forEach((a, i) => {
        assert.ok(ids.has(`a${i + 1}-name`), f.no);
        a.addresses.forEach((_, k) => assert.ok(ids.has(`a${i + 1}-ps${k + 1}`), f.no));
        if (a.type === "institution") {
          a.reps.forEach((_, k) => assert.ok(ids.has(`a${i + 1}-r${k + 1}-desig`), f.no));
        }
      });
      draft.cheques.forEach((_, i) => {
        assert.ok(ids.has(`q${i + 1}-branch`), f.no);
        assert.ok(ids.has(`m${i + 1}-why`), f.no);
        assert.ok(ids.has(`n${i + 1}-nature`), f.no);
      });
      draft.witnesses.forEach((_, i) => assert.ok(ids.has(`w${i + 1}-prove`), f.no));
    }
  });

  it("follows the branches the filer took", () => {
    const poa = new Set(open("F/AHM/2026/00338").allFields.map((x) => x.id));
    assert.ok(poa.has("c1-poa-name") && poa.has("c1-perm") && poa.has("n1-part"));
    assert.ok(poa.has("q2-same"));

    const unserved = new Set(open("F/AHM/2026/00319").allFields.map((x) => x.id));
    assert.ok(unserved.has("n1-nondel") && !unserved.has("n1-deldate"));

    const institution = new Set(open("F/AHM/2026/00298").allFields.map((x) => x.id));
    assert.ok(institution.has("c1-ent-cinpan") && institution.has("c1-rep-name"));
    assert.ok(!institution.has("c1-name"));

    const drawer = open("F/AHM/2026/00335");
    const drawerIds = new Set(drawer.allFields.map((x) => x.id));
    assert.ok(drawerIds.has("j-oc1-no") && !drawerIds.has("j-bank"));

    const late = new Set(open("F/AHM/2026/00311").allFields.map((x) => x.id));
    assert.ok(late.has("j-delay"));
  });
});

describe("provenance comes from the readings on the draft", () => {
  const hero = open(HERO_FILING_NO);

  it("carries the reading the filer overrode", () => {
    const amount = hero.fieldById["q1-amt"];
    assert.equal(amount.docread, "₹50,25,000");
    assert.equal(amount.skipped, true);
    assert.equal(amount.doc, "c1f");
    assert.ok(amount.region);
  });

  it("says when a value was not found on its upload", () => {
    assert.equal(hero.fieldById["c1-name"].ocrfail, true);
    assert.equal(hero.fieldById["m1-ret"].ocrfail, true);
  });

  it("says nothing about readings on a filing that was never read", () => {
    for (const field of open("F/AHM/2026/00335").allFields) {
      assert.ok(!field.ocrfail && !field.docread && !field.region, field.id);
    }
  });

  it("puts the paper-signed affidavit in the bundle as a re-uploadable document", () => {
    assert.equal(hero.docRow.affidavit, "d-affidavit");
    assert.equal(hero.docById.affidavit.poorScan, true);
  });
});
