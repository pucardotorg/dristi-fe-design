import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createBlankDraft, migrateDraft } from "./blank";
import { FINAL_RELIEF_TEMPLATE } from "./options";
import { draftProgress, sectionComplete, sectionState } from "./selectors";
import type { FilingDraft } from "./types";

/**
 * Drafts on disk are written by whichever branch ran last on this origin. The settlement
 * lineage renamed `adr` to `settlement` and deleted the old block, so a draft can come
 * back missing a field every selector here reads. These check that reading one is boring.
 */
describe("migrateDraft — drafts written by another branch", () => {
  /** A draft as `feature/settlement-options` leaves it: no `adr`, version 4. */
  function settlementShaped(): FilingDraft {
    const draft = createBlankDraft("draft-settlement") as Omit<FilingDraft, "version"> & {
      settlement?: unknown;
      version: number;
    };
    delete (draft as { adr?: unknown }).adr;
    draft.settlement = {
      willing: "no",
      otherDetails: "Nothing further.",
      interimRelief: "<p>Interim as typed</p>",
      finalRelief: "<p>Final as typed</p>",
      mode: "packaged",
      offers: [],
    };
    draft.lastStep = "settlement" as FilingDraft["lastStep"];
    draft.version = 4;
    return draft as FilingDraft;
  }

  it("carries the prayer across rather than resetting it to the template", () => {
    const draft = migrateDraft(settlementShaped());
    assert.equal(draft.adr.finalRelief, "<p>Final as typed</p>");
    assert.equal(draft.adr.interimRelief, "<p>Interim as typed</p>");
    assert.equal(draft.adr.otherDetails, "Nothing further.");
    assert.equal(draft.adr.adr, "no");
  });

  it("leaves the settlement block alone, so the offer ladder survives a trip back", () => {
    const draft = migrateDraft(settlementShaped()) as FilingDraft & {
      settlement?: { offers?: unknown[] };
    };
    assert.ok(draft.settlement, "settlement was deleted");
  });

  it("moves a step id this branch does not have onto one it does", () => {
    assert.equal(migrateDraft(settlementShaped()).lastStep, "adr-prayer");
  });

  it("lets the selectors that took the filings screen down run", () => {
    const draft = migrateDraft(settlementShaped());
    assert.equal(sectionComplete(draft, "adr-prayer"), true);
    assert.equal(typeof draftProgress(draft), "number");
  });

  it("falls back to the template when there is no settlement block either", () => {
    const bare = createBlankDraft("draft-bare");
    delete (bare as { adr?: unknown }).adr;
    assert.equal(migrateDraft(bare).adr.finalRelief, FINAL_RELIEF_TEMPLATE);
  });

  it("survives a draft missing whole blocks", () => {
    const gutted = createBlankDraft("draft-gutted");
    for (const key of ["intake", "complainants", "accused", "cheques", "notices",
      "jurisdiction", "witnesses", "documents", "sign", "dismissed"]) {
      delete (gutted as unknown as Record<string, unknown>)[key];
    }
    const draft = migrateDraft(gutted);
    assert.equal(draft.version, 7);
    assert.equal(typeof draftProgress(draft), "number");
  });

  it("reopens on the first screen when lastStep is an id no branch's migration named", () => {
    const draft = createBlankDraft("draft-unknown-step");
    draft.lastStep = "not-a-real-step" as FilingDraft["lastStep"];
    assert.equal(migrateDraft(draft).lastStep, "upload");
  });
});

/**
 * Signing used to be one flat choice recorded only once somebody had signed. It is now
 * a decision about the filing — digital or a copy signed on paper — plus the instrument
 * each signature was actually made with.
 */
describe("migrateDraft — the two-level signing model", () => {
  /** A draft as the previous signing lineage leaves it. */
  function signShaped(mode: string | null, signed: Record<string, unknown>): FilingDraft {
    const draft = createBlankDraft("draft-sign");
    const sign = draft.sign as unknown as Record<string, unknown>;
    sign.mode = mode;
    sign.signed = signed;
    delete sign.requestedAt;
    delete sign.notified;
    return draft;
  }

  it("presumes digital signing when nothing was ever chosen", () => {
    const draft = migrateDraft(signShaped(null, {}));
    assert.equal(draft.sign.mode, "digital");
    assert.equal(draft.sign.requestedAt, null);
    assert.deepEqual(draft.sign.notified, {});
  });

  it("keeps both old digital routes as digital, and remembers which instrument signed", () => {
    const esign = migrateDraft(signShaped("esign", { "sig-a-1": true }));
    assert.equal(esign.sign.mode, "digital");
    assert.equal(esign.sign.signed["sig-a-1"].with, "aadhaar");

    const dsc = migrateDraft(signShaped("dsc", { "sig-a-1": true }));
    assert.equal(dsc.sign.mode, "digital");
    assert.equal(dsc.sign.signed["sig-a-1"].with, "dsc");
  });

  it("reads an uploaded copy's signatures as made on paper", () => {
    const draft = migrateDraft(signShaped("upload", { "sig-c-1": true }));
    assert.equal(draft.sign.mode, "upload");
    assert.equal(draft.sign.signed["sig-c-1"].with, "paper");
  });

  it("treats a draft that already holds signatures as one that was sent for signature", () => {
    const asked = migrateDraft(signShaped("esign", { "sig-a-1": true }));
    assert.equal(asked.sign.requestedAt, asked.updatedAt);

    const untouched = migrateDraft(signShaped("esign", {}));
    assert.equal(untouched.sign.requestedAt, null);
  });

  it("drops a signatory whose signature was recorded as false", () => {
    const draft = migrateDraft(signShaped("esign", { "sig-a-1": false }));
    assert.equal("sig-a-1" in draft.sign.signed, false);
  });
});

describe("draftProgress — only what the person has done", () => {
  it("starts a blank draft at 0%, though the prayer and witnesses are complete by default", () => {
    const draft = createBlankDraft("draft-blank-progress");
    assert.equal(sectionComplete(draft, "adr-prayer"), true);
    assert.equal(draftProgress(draft), 0);
    assert.equal(sectionState(draft, "adr-prayer"), "untouched");
  });

  it("counts a default-complete section once it has been opened", () => {
    const draft = createBlankDraft("draft-opened-progress");
    draft.visited = ["complainant", "adr-prayer"];
    assert.equal(sectionState(draft, "complainant"), "started");
    assert.equal(sectionState(draft, "adr-prayer"), "done");
    assert.ok(draftProgress(draft) > 0);
  });

  it("reads a draft saved before sections were tracked as walked up to where it was left", () => {
    const draft = createBlankDraft("draft-legacy-progress");
    delete draft.visited;
    draft.lastStep = "adr-prayer";
    assert.equal(sectionState(draft, "adr-prayer"), "done");
    assert.equal(sectionState(draft, "complainant"), "started");
    assert.equal(sectionState(draft, "documents"), "untouched");
  });
});
