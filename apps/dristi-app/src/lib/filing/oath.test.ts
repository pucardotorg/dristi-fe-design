import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createBlankDraft, migrateDraft } from "./blank";
import {
  carryOverOaths,
  confirmationComplete,
  isOutstanding,
  oathCarriedOver,
  oathTakerName,
  oathTakerRole,
  phoneConfirmers,
  signatories,
  signingComplete,
} from "./selectors";
import type { FilingDraft } from "./types";

/** One complainant with one advocate on record — the commonest shape of a filing. */
function draftWithAdvocate(): FilingDraft {
  const d = createBlankDraft("draft-oath");
  d.complainants[0].name = "Zeenath Beevi";
  d.complainants[0].mobile = "9847012345";
  d.advocates[0].name = "Anjali Nair";
  d.advocates[0].barNumber = "K/123/2010";
  return d;
}

const at = "2026-10-06T10:00:00.000Z";

describe("the complainant's oath (OTH-2, OTH-3)", () => {
  it("when switched off, owes no oath, and the fee opens once everyone signs", () => {
    const d = draftWithAdvocate();
    const { complainants, advocates } = signatories(d, null, false);
    assert.equal(complainants[0].oathTaken, undefined);
    assert.equal(advocates[0].oathTaken, undefined);

    for (const s of [...complainants, ...advocates]) d.sign.signed[s.id] = { at, with: "aadhaar" };
    assert.equal(signingComplete(d, null, false), true);
  });

  it("when switched on, is owed by the complainant and never by an advocate", () => {
    const { complainants, advocates } = signatories(draftWithAdvocate(), null, true);
    assert.equal(complainants[0].oathTaken, false);
    assert.equal(advocates[0].oathTaken, undefined);
  });

  it("is recorded by the complainant, their PoA holder, or an Institution's representative", () => {
    const d = draftWithAdvocate();
    const c = d.complainants[0];
    const id = `sig-c-${c.id}`;
    assert.equal(oathTakerName(d, id), "Zeenath Beevi");
    assert.equal(oathTakerRole(d, id), "Complainant");

    c.poa = "yes";
    c.poaHolder.name = "Salim Beevi";
    assert.equal(oathTakerName(d, id), "Salim Beevi");
    assert.equal(oathTakerRole(d, id), "PoA holder");

    c.poa = "no";
    c.type = "institution";
    c.entName = "Kollam Traders";
    c.rep.name = "Rajan Pillai";
    assert.equal(oathTakerName(d, id), "Rajan Pillai");
    assert.equal(oathTakerRole(d, id), "Authorised representative");

    // An advocate's slot has no oath, so no one to record it.
    assert.equal(oathTakerName(d, `sig-a-${c.id}`), "");
  });

  it("when switched on, keeps the court fee shut after every signature until the oath is in", () => {
    const d = draftWithAdvocate();
    for (const s of Object.values(signatories(d, null, true)).flat()) {
      d.sign.signed[s.id] = { at, with: "aadhaar" };
    }
    assert.equal(signingComplete(d, null, true), false);

    const { complainants, advocates } = signatories(d, null, true);
    assert.equal(isOutstanding(advocates[0]), false, "a signed advocate owes nothing more");
    assert.equal(isOutstanding(complainants[0]), true);

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

describe("upload mode (SIG-05, OTH-3)", () => {
  it("counts a confirmation complete only with its oath, where the state asks for one", () => {
    const d = draftWithAdvocate();
    d.sign.mode = "upload";
    const [person] = phoneConfirmers(d);
    d.sign.confirmed[person.id] = { mobileTail: "2345", at };
    assert.equal(confirmationComplete(d, person, false), true);
    assert.equal(confirmationComplete(d, person, true), false);
    d.sign.oaths[`sig-c-${d.complainants[0].id}`] = { at, video: null };
    assert.equal(confirmationComplete(d, person, true), true);
  });

  it("keeps a PoA holder's oath on the complainant's slot", () => {
    const d = draftWithAdvocate();
    d.complainants[0].poa = "yes";
    d.complainants[0].poaHolder.name = "Salim Beevi";
    d.complainants[0].poaHolder.mobile = "9847099999";
    const [person] = phoneConfirmers(d);
    assert.equal(person.id, `poa-${d.complainants[0].id}`);
    d.sign.confirmed[person.id] = { mobileTail: "9999", at };
    d.sign.oaths[`sig-c-${d.complainants[0].id}`] = { at, video: null };
    assert.equal(confirmationComplete(d, person, true), true);
  });
});

describe("correction rounds (OTH-5)", () => {
  it("carries every oath over except the ones scrutiny flagged", () => {
    const oaths = { "sig-c-a": { at, video: null }, "sig-c-b": { at, video: null } };
    assert.deepEqual(Object.keys(carryOverOaths(oaths)), ["sig-c-a", "sig-c-b"]);
    assert.deepEqual(Object.keys(carryOverOaths(oaths, ["sig-c-b"])), ["sig-c-a"]);
  });

  it("knows an oath carried over by its date against the round's signing", () => {
    const d = draftWithAdvocate();
    const id = `sig-c-${d.complainants[0].id}`;
    d.sign.oaths[id] = { at, video: null };
    assert.equal(oathCarriedOver(d, id), false, "no correction round yet");
    d.scrutinyReturn = { resubmittedAt: null, signingFrom: "2026-10-12T09:00:00.000Z" };
    assert.equal(oathCarriedOver(d, id), true);
    d.sign.oaths[id] = { at: "2026-10-12T09:30:00.000Z", video: null };
    assert.equal(oathCarriedOver(d, id), false, "recorded again in this round");
  });
});

describe("every advocate signs (Gujarat)", () => {
  it("lists each advocate on record as a signatory of their own, with no oath", () => {
    const d = createBlankDraft("draft-two-advocates");
    d.complainants[0].name = "Priya Varghese";
    d.advocates[0] = { ...d.advocates[0], name: "Anjali Nair", barNumber: "K/1/2010", forComplainants: [0] };
    d.advocates.push({ id: "adv-2", name: "Thomas Kurian", barNumber: "K/2/2015", forComplainants: [0] });
    const { advocates } = signatories(d, null, true, true);
    assert.deepEqual(advocates.map((a) => a.name), ["Anjali Nair", "Thomas Kurian"]);
    assert.equal(advocates[1].id, "sig-a-adv-2");
    assert.equal(advocates[1].role, "Advocate for Priya Varghese");
    assert.equal(advocates[1].oathTaken, undefined);
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
