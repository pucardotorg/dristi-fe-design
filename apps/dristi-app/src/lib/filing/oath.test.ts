import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createBlankDraft, migrateDraft } from "./blank";
import { isOutstanding, oathTakerName, signatories, signingComplete } from "./selectors";
import type { FilingDraft } from "./types";

/** One complainant with one advocate on record — the commonest shape of a filing. */
function draftWithAdvocate(): FilingDraft {
  const d = createBlankDraft("draft-oath");
  d.complainants[0].name = "Zeenath Beevi";
  d.advocates[0].name = "Anjali Nair";
  d.advocates[0].barNumber = "K/123/2010";
  return d;
}

describe("advocate's oath", () => {
  it("when switched off, owes no oath, and the fee opens once everyone signs", () => {
    const d = draftWithAdvocate();
    const { complainants, advocates } = signatories(d, null, false);
    assert.equal(complainants[0].oathTaken, undefined);
    assert.equal(advocates[0].oathTaken, undefined);

    const at = "2026-10-06T10:00:00.000Z";
    for (const s of [...complainants, ...advocates]) d.sign.signed[s.id] = { at, with: "aadhaar" };
    assert.equal(signingComplete(d, null, false), true);
  });

  it("when switched on, is owed by complainants and advocates alike", () => {
    const { complainants, advocates } = signatories(draftWithAdvocate(), null, true);
    assert.equal(complainants[0].oathTaken, false);
    assert.equal(advocates[0].oathTaken, false);
  });

  it("is read in the name of the person taking it", () => {
    const d = draftWithAdvocate();
    const c = d.complainants[0];
    assert.equal(oathTakerName(d, `sig-c-${c.id}`), "Zeenath Beevi");
    assert.equal(oathTakerName(d, `sig-a-${d.advocates[0].id}`), "Anjali Nair");
  });

  it("when switched on, keeps the court fee shut after every signature until the oath is in", () => {
    const d = draftWithAdvocate();
    const at = "2026-10-06T10:00:00.000Z";
    for (const s of Object.values(signatories(d, null, true)).flat()) {
      d.sign.signed[s.id] = { at, with: "aadhaar" };
    }
    assert.equal(signingComplete(d, null, true), false);

    const { complainants, advocates } = signatories(d, null, true);
    assert.equal(isOutstanding(advocates[0]), true);
    assert.equal(isOutstanding(complainants[0]), true);

    d.sign.oaths[advocates[0].id] = { at, video: null };
    assert.equal(signingComplete(d, null, true), false, "the complainant's oath is still owed");
    d.sign.oaths[complainants[0].id] = { at, video: null };
    assert.equal(signingComplete(d, null, true), true);
  });

  it("moves an old draft off the retired Oath step and drops the complainant's video", () => {
    const old = draftWithAdvocate();
    (old as unknown as { lastStep: string }).lastStep = "oath";
    (old.complainants[0] as unknown as { oathVideo: unknown }).oathVideo = {
      file: { id: "f1", name: "oath.mp4", type: "video/mp4", size: 1 },
      durationSeconds: 30,
    };
    delete (old.sign as { oaths?: unknown }).oaths;

    const d = migrateDraft(old as FilingDraft);
    assert.equal(d.lastStep, "affidavit");
    assert.equal("oathVideo" in d.complainants[0], false);
    assert.deepEqual(d.sign.oaths, {});
  });
});

describe("every advocate signs (Gujarat)", () => {
  it("lists each advocate on record as a signatory of their own, with their own oath", () => {
    const d = createBlankDraft("draft-two-advocates");
    d.complainants[0].name = "Priya Varghese";
    d.advocates[0] = { ...d.advocates[0], name: "Anjali Nair", barNumber: "K/1/2010", forComplainants: [0] };
    d.advocates.push({ id: "adv-2", name: "Thomas Kurian", barNumber: "K/2/2015", forComplainants: [0] });
    const { advocates } = signatories(d, null, true, true);
    assert.deepEqual(advocates.map((a) => a.name), ["Anjali Nair", "Thomas Kurian"]);
    assert.equal(advocates[1].id, "sig-a-adv-2");
    assert.equal(advocates[1].role, "Advocate for Priya Varghese");
    assert.equal(advocates[1].oathTaken, false);
  });
});

describe("outside Gujarat", () => {
  it("keeps one advocate slot per complainant, with no oath", () => {
    const d = createBlankDraft("draft-slot");
    d.complainants[0].name = "Priya Varghese";
    d.advocates[0] = { ...d.advocates[0], name: "Anjali Nair", barNumber: "K/1/2010", forComplainants: [0] };
    d.advocates.push({ id: "adv-2", name: "Thomas Kurian", barNumber: "K/2/2015", forComplainants: [0] });
    const { advocates } = signatories(d, null, false, false);
    assert.equal(advocates.length, 1);
    assert.equal(advocates[0].role, "Any one of 2 advocates on record");
    assert.equal(advocates[0].oathTaken, undefined);
  });
});
