import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  casesOnTab,
  COGNIZANCE_QUEUE,
  hasDelay,
  isCognizanceAct,
  primaryActFor,
  tabFor,
  type CognizanceAct,
  type CognizanceCase,
} from "./cognizance";
import {
  cognizanceComposition,
  cognizanceOrderOutcome,
  DELAY_APPLICATION_TYPE,
  delayApplicationNumber,
} from "./cognizance-order";
import { blockGaps, setItemValue, type ItemBlock } from "./order-composer";
import { composerContextFor } from "./order-context";
import {
  subjectAppearances,
  subjectApplications,
  subjectCauseTitle,
  subjectCaseNumber,
  subjectFacts,
  subjectScheduling,
  subjectTrail,
  type OrderSubject,
} from "./order-subject";

const late = casesOnTab(COGNIZANCE_QUEUE, "with-delay")[0];
const timely = casesOnTab(COGNIZANCE_QUEUE, "without-delay")[0];

function compose(matter: CognizanceCase, act: CognizanceAct) {
  return cognizanceComposition(matter, act, composerContextFor(matter));
}

const types = (blocks: ItemBlock[]) => blocks.map((block) => block.type);

describe("the blocks each act loads", () => {
  it("takes cognizance with summons and a hearing, and the delay ahead of it", () => {
    assert.deepEqual(types(compose(late, "cognizance").blocks), [
      "accept-application",
      "cognizance",
      "issue-of-summons",
      "scheduling-of-hearing",
    ]);
  });

  it("leaves the delay application out of a complaint filed in time", () => {
    assert.deepEqual(types(compose(timely, "cognizance").blocks), [
      "cognizance",
      "issue-of-summons",
      "scheduling-of-hearing",
    ]);
  });

  it("issues a notice with a hearing, and dismisses with one item", () => {
    assert.deepEqual(types(compose(late, "notice").blocks), [
      "issue-of-notice",
      "scheduling-of-hearing",
    ]);
    assert.deepEqual(types(compose(late, "dismiss").blocks), ["dismiss-case"]);
  });

  it("fixes the act's own item and the hearing it must schedule", () => {
    assert.deepEqual(compose(late, "cognizance").fixedIds, [
      "cognizance",
      "scheduling-of-hearing",
    ]);
    assert.deepEqual(compose(late, "dismiss").fixedIds, ["dismiss-case"]);
  });

  it("names the delay application by its number and head", () => {
    const [accept] = compose(late, "cognizance").blocks;
    assert.equal(
      accept.text,
      `Application ${delayApplicationNumber(late)} for ${DELAY_APPLICATION_TYPE} is accepted.`,
    );
  });

  it("summons the accused and puts the steps on the complainant", () => {
    const summons = compose(timely, "cognizance").blocks.find(
      (block) => block.type === "issue-of-summons",
    )!;
    assert.equal(
      summons.text,
      `Issue summons to the accused ${timely.parties.accused}. The complainant is directed to make the appropriate payments and take steps to issue summons.`,
    );
  });

  it("asks for the next hearing's date and purpose, with neither pre-filled", () => {
    const context = composerContextFor(timely);
    const scheduling = compose(timely, "cognizance").blocks.find(
      (block) => block.type === "scheduling-of-hearing",
    )!;
    assert.deepEqual(
      blockGaps(scheduling, context).map((gap) => gap.key),
      ["date", "purpose"],
    );
    const set = setItemValue(
      setItemValue(scheduling, "date", "2026-11-12", context),
      "purpose",
      "appearance",
      context,
    );
    assert.deepEqual(blockGaps(set, context), []);
    assert.equal(
      set.text,
      "Next hearing is scheduled on 12 November 2026 for appearance.",
    );
  });
});

describe("the act's own words", () => {
  it("says the delay is condoned only where there is one", () => {
    assert.ok(cognizanceOrderOutcome(late, "cognizance").includes("delay"));
    assert.ok(!cognizanceOrderOutcome(timely, "cognizance").includes("delay"));
  });


  it("reads an act off a URL, and nothing else", () => {
    assert.ok(isCognizanceAct("cognizance"));
    assert.ok(isCognizanceAct("notice"));
    assert.ok(isCognizanceAct("dismiss"));
    assert.ok(!isCognizanceAct("take-cognizance"));
    assert.ok(!isCognizanceAct(undefined));
  });
});

describe("the order's subject", () => {
  const subject: OrderSubject = {
    kind: "cognizance",
    matter: late,
    act: "cognizance",
  };

  it("carries the cause and the number, the same as a hearing would", () => {
    assert.equal(subjectCaseNumber(subject), late.caseNumber);
    assert.equal(
      subjectCauseTitle(subject),
      `${late.parties.complainant} v. ${late.parties.accused}`,
    );
  });

  it("has nobody appearing and nothing pending, because it was never called", () => {
    assert.deepEqual(subjectAppearances(subject), []);
    assert.deepEqual(subjectApplications(subject), []);
  });

  it("requires a next date on a positive act and forbids one on a dismissal", () => {
    assert.equal(subjectScheduling(subject), "required");
    assert.equal(
      subjectScheduling({ kind: "cognizance", matter: late, act: "notice" }),
      "required",
    );
    assert.equal(
      subjectScheduling({ kind: "cognizance", matter: late, act: "dismiss" }),
      "none",
    );
  });

  it("names no item and no purpose — a complaint has neither", () => {
    const labels = subjectFacts(subject).map((fact) => fact.label);
    assert.ok(!labels.includes("Item"));
    assert.ok(!labels.includes("Purpose"));
    assert.deepEqual(labels, ["Act", "Case", "Filing", "Filed"]);
  });

  it("leads on the act, because that is what the order is", () => {
    const [first] = subjectFacts(subject);
    assert.equal(first.label, "Act");
    assert.equal(first.value, "Take cognizance");
    assert.equal(
      subjectFacts({ kind: "cognizance", matter: late, act: "dismiss" })[0]
        .value,
      "Dismiss case",
    );
  });

  it("leads back the way the bench came, not through the hearings list", () => {
    const trail = subjectTrail(subject);
    assert.equal(trail[0].label, "Take cognizance");
    assert.ok(trail.every((crumb) => !crumb.href?.includes("/hearings")));
  });

  it("says which half of the register the complaint stands on", () => {
    const filed = (matter: CognizanceCase) =>
      subjectFacts({ kind: "cognizance", matter, act: "cognizance" }).find(
        (fact) => fact.label === "Filed",
      )!.value;
    assert.equal(filed(late), "Beyond the month");
    assert.equal(filed(timely), "In time");
    assert.ok(hasDelay(late) && !hasDelay(timely));
  });
});

describe("the act a complaint arrives with", () => {
  it("is the one its tab offers, for every complaint in the queue", () => {
    for (const matter of COGNIZANCE_QUEUE) {
      const act = primaryActFor(matter);
      assert.equal(
        act,
        tabFor(matter) === "with-delay" ? "notice" : "cognizance",
        matter.id,
      );
      assert.ok(compose(matter, act).blocks.length > 0);
    }
  });
});
