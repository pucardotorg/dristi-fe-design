import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildScrutinyCase, HERO_FILING_NO } from "./case";
import { findFiling } from "./queue";
import type { Draft, FlagMap, ScrutinyLookups } from "./types";
import {
  applyAccept,
  applyLinkDoc as applyLinkDocRaw,
  applyRaiseAgain,
  applyRemoveFlag,
  applySaveFlag as applySaveFlagRaw,
  applyUndoAccept,
  survivingPartner,
  uncheckedCount,
  verdictOf,
  type ScrutinyState,
} from "./use-scrutiny-state";

/** The authored case, read off its e-filing draft. */
const HERO = buildScrutinyCase(findFiling(HERO_FILING_NO)!);
const FIELD_BY_ID = HERO.fieldById;
const DOC_ROW = HERO.docRow;

/** The authored case's own maps — the fixture these transitions were written against. */
const LOOK: ScrutinyLookups = { fieldById: FIELD_BY_ID, docRow: DOC_ROW };
const applySaveFlag = (s: ScrutinyState) => applySaveFlagRaw(s, LOOK);
const applyLinkDoc = (s: ScrutinyState, docId: string) =>
  applyLinkDocRaw(s, docId, LOOK);

function draft(over: Partial<Draft> = {}): Draft {
  return {
    text: "",
    reason: null,
    linked: null,
    ...over,
  };
}

function state(over: Partial<ScrutinyState> = {}): ScrutinyState {
  return {
    flags: {},
    accepted: {},
    selectedId: null,
    composeField: null,
    draft: null,
    pendingFocus: null,
    ...over,
  };
}

/** The Full name composer, about a value read from the Aadhaar. */
function composingName(over: Partial<Draft> = {}): ScrutinyState {
  return state({
    composeField: "c1-name",
    draft: draft({
      text: "Only the address side of the Aadhaar was uploaded.",
      ...over,
    }),
  });
}

const LINKED = {
  rowId: "d-p1id",
  docId: "p1id",
  reason: "Page missing",
  note: "Re-scan the front side at 300 dpi.",
};

describe("applyLinkDoc — the sub-composer opens, nothing is created", () => {
  it("opens an empty linked block", () => {
    const next = applyLinkDoc(composingName(), "p1id");
    assert.deepEqual(next.draft?.linked, {
      rowId: "d-p1id",
      docId: "p1id",
      reason: null,
      note: "",
    });
    // Nothing exists yet — the officer still has to say what is wrong, and save.
    assert.deepEqual(next.flags, {});
  });

  it("never pre-selects a reason, not even on a poor scan", () => {
    const s = state({
      composeField: "aff-body",
      draft: draft({ text: "Second paragraph is blurred." }),
    });
    assert.equal(applyLinkDoc(s, "affidavit").draft?.linked?.reason, null);
  });

  it("leaves an in-progress linked block alone", () => {
    const next = applyLinkDoc(composingName({ linked: LINKED }), "p1id");
    assert.deepEqual(next.draft?.linked, LINKED);
  });
});

describe("applySaveFlag — one act, two grants", () => {
  it("writes both items, linked to each other", () => {
    const next = applySaveFlag(composingName({ linked: LINKED }));

    const fieldItem = next.flags["c1-name"];
    const docItem = next.flags["d-p1id"];
    assert.ok(fieldItem && docItem);

    assert.equal(fieldItem.linkedTo, "d-p1id");
    assert.equal(docItem.linkedFrom, "c1-name");
    assert.equal(docItem.reason, "Page missing");
    // The field note is about the value, the document note about the file. Two items
    // repeating one sentence leave the advocate unable to tell what answers what.
    assert.equal(docItem.comment, LINKED.note);
    assert.notEqual(docItem.comment, fieldItem.comment);
    // The composer closes behind the save.
    assert.equal(next.composeField, null);
    assert.equal(next.draft, null);
  });

  it("refuses to save when the linked item has no reason", () => {
    const s = composingName({ linked: { ...LINKED, reason: null } });
    assert.equal(applySaveFlag(s), s);
  });

  it("refuses to save an item that says nothing", () => {
    const s = composingName({ text: "" });
    assert.equal(applySaveFlag(s), s);
  });

  it("saves a lone field item with no link", () => {
    const next = applySaveFlag(composingName());
    assert.equal(next.flags["c1-name"].linkedTo, null);
    assert.equal(next.flags["d-p1id"], undefined);
  });

  it("drops the partner when the officer edits and unlinks — at save, not before", () => {
    const saved = applySaveFlag(composingName({ linked: LINKED }));
    const editing: ScrutinyState = {
      ...saved,
      composeField: "c1-name",
      draft: draft({
        text: "Only the address side of the Aadhaar was uploaded.",
        linked: null,
      }),
    };

    const next = applySaveFlag(editing);
    assert.equal(next.flags["d-p1id"], undefined);
    assert.equal(next.flags["c1-name"].linkedTo, null);
  });

  it("keeps the document row's own linkedFrom when it is edited directly", () => {
    const saved = applySaveFlag(composingName({ linked: LINKED }));
    const editingRow: ScrutinyState = {
      ...saved,
      composeField: "d-p1id",
      draft: draft({ reason: "Blurry / unreadable", text: "Re-scan it." }),
    };

    const next = applySaveFlag(editingRow);
    assert.equal(next.flags["d-p1id"].linkedFrom, "c1-name");
    assert.equal(next.flags["c1-name"].linkedTo, "d-p1id");
  });
});

describe("removal never cascades", () => {
  const saved = applySaveFlag(composingName({ linked: LINKED }));

  it("leaves the document issue standing when the field flag goes", () => {
    const next = applyRemoveFlag(saved, "c1-name");
    assert.equal(next.flags["c1-name"], undefined);
    // A bad scan is still a bad scan.
    assert.ok(next.flags["d-p1id"]);
    assert.equal(next.flags["d-p1id"].linkedFrom, null);
  });

  it("names the item left behind, so the toast can be honest", () => {
    assert.equal(survivingPartner(saved.flags, "c1-name"), "d-p1id");
  });

  it("says nothing when the document item is the one removed", () => {
    assert.equal(survivingPartner(saved.flags, "d-p1id"), null);
    const next = applyRemoveFlag(saved, "d-p1id");
    assert.equal(next.flags["d-p1id"], undefined);
    assert.ok(next.flags["c1-name"]);
    assert.equal(next.flags["c1-name"].linkedTo, null);
  });

  it("removes the survivor too when the toast action is taken", () => {
    const once = applyRemoveFlag(saved, "c1-name");
    const twice = applyRemoveFlag(once, "d-p1id");
    assert.deepEqual(twice.flags, {});
  });

  it("is a no-op for an item that is not there", () => {
    const flags: FlagMap = saved.flags;
    assert.equal(survivingPartner(flags, "c1-mob"), null);
    assert.equal(applyRemoveFlag(saved, "c1-mob"), saved);
  });

  it("closes the composer when the item being edited is removed", () => {
    const editing: ScrutinyState = { ...saved, composeField: "c1-name", draft: draft() };
    const next = applyRemoveFlag(editing, "c1-name");
    assert.equal(next.composeField, null);
    assert.equal(next.draft, null);
  });
});

describe("re-scrutiny verdicts", () => {
  /** The resubmitted filing: four items came back, one of each answer plus a long prose correction. */
  const RESUB = buildScrutinyCase(findFiling("F/AHM/2026/00338")!);
  const RESUB_LOOK: ScrutinyLookups = { fieldById: RESUB.fieldById, docRow: RESUB.docRow };

  it("attaches the round to a resubmitted filing and none to a fresh one", () => {
    assert.equal(RESUB.returned?.items.length, 4);
    assert.equal(RESUB.historyRound, RESUB.returned?.round);
    for (const item of RESUB.returned!.items) assert.ok(RESUB.fieldById[item.fieldId], item.fieldId);
    assert.equal(buildScrutinyCase(findFiling("F/AHM/2026/00319")!).returned, null);
  });

  it("names every returned item in the derived history", () => {
    const sent = RESUB.history.find((e) => e.items);
    assert.deepEqual(sent?.items?.map((i) => i.ref), ["q1-amt", "c1-name", "d-c1ad", "p-interim"]);
  });

  it("the hero round names a real row", () => {
    for (const item of HERO.returned!.items) assert.ok(FIELD_BY_ID[item.fieldId], item.fieldId);
  });

  it("counts every item unchecked until the officer answers it", () => {
    const s = state();
    assert.equal(uncheckedCount(s, RESUB.returned), 4);
    assert.equal(verdictOf(s, "q1-amt"), "unchecked");
  });

  it("accepting settles an item, and undo puts it back", () => {
    const s = applyAccept(state(), "q1-amt");
    assert.equal(verdictOf(s, "q1-amt"), "accepted");
    assert.equal(uncheckedCount(s, RESUB.returned), 3);
    assert.equal(verdictOf(applyUndoAccept(s, "q1-amt"), "q1-amt"), "unchecked");
  });

  it("raising again opens the composer on the last note and drops an acceptance", () => {
    const note = RESUB.returned!.items[1].note;
    const s = applyRaiseAgain(applyAccept(state(), "c1-name"), "c1-name", note, RESUB_LOOK);
    assert.equal(s.composeField, "c1-name");
    assert.equal(s.draft?.text, note);
    assert.equal(s.accepted["c1-name"], undefined);
  });

  it("a saved re-raise is a flag, outranks acceptance, and counts as checked", () => {
    const note = RESUB.returned!.items[1].note;
    const raised = applySaveFlagRaw(applyRaiseAgain(state(), "c1-name", note, RESUB_LOOK), RESUB_LOOK);
    assert.equal(verdictOf(raised, "c1-name"), "raised");
    assert.equal(uncheckedCount(raised, RESUB.returned), 3);
    // Accept is refused while the item stands raised.
    assert.equal(applyAccept(raised, "c1-name"), raised);
    // Withdrawing the flag returns it to unchecked, not to accepted.
    assert.equal(verdictOf(applyRemoveFlag(raised, "c1-name"), "c1-name"), "unchecked");
  });
});
