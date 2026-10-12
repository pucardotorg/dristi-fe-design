import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { casePeopleFor } from "./case-people";
import {
  createItemBlock,
  setItemRecipients,
  setItemValue,
  blockGaps,
} from "./order-composer";
import {
  channelsFor,
  defaultProcessRecipients,
  stationsFor,
  unreachableChannels,
} from "./process-variables";

/* §5.1 of `process-handover.md` — what a process order item opens on — and the owner's
   model (2026-10-12): one person, then their addresses, then the channels, with a police
   station per address. */

const NOT_JOINED = {
  caseNumber: "ST/249/2026",
  parties: { complainant: "Arjun Nair", accused: "Gill Steel Fabricators" },
  counsel: [],
  stage: "process" as const,
};
const ONE_UNEXAMINED = {
  caseNumber: "ST/241/2026",
  parties: { complainant: "Sunil Varghese", accused: "Anand Traders" },
  counsel: [{ name: "Adv. Rekha Pillai", side: "accused" as const }],
  stage: "evidence" as const,
};
const TWO_UNEXAMINED = {
  caseNumber: "ST/250/2026",
  parties: { complainant: "Fathima Beevi", accused: "Noor Traders" },
  counsel: [{ name: "Adv. K. Ramesh", side: "accused" as const }],
  stage: "evidence" as const,
};

describe("who a process opens on", () => {
  it("is the first accused, at every address, until the accused has joined", () => {
    const { people, accusedJoined } = casePeopleFor(NOT_JOINED);
    const recipients = defaultProcessRecipients("issue-of-summons", people, accusedJoined);
    assert.equal(recipients.person, "accused-1");
    assert.deepEqual(recipients.addresses, ["accused-1-address-1", "accused-1-address-2"]);
  });

  it("is the one witness not yet examined, once the accused has joined", () => {
    const { people, accusedJoined } = casePeopleFor(ONE_UNEXAMINED);
    const recipients = defaultProcessRecipients("issue-of-summons", people, accusedJoined);
    assert.equal(recipients.person, "pw-2");
  });

  it("is nobody when two witnesses are still to be examined", () => {
    const { people, accusedJoined } = casePeopleFor(TWO_UNEXAMINED);
    const recipients = defaultProcessRecipients("issue-of-summons", people, accusedJoined);
    assert.equal(recipients.person, "");
    assert.deepEqual(recipients.addresses, []);
  });
});

describe("channels", () => {
  it("keeps a notice off every police channel, and a warrant on police only", () => {
    assert.ok(channelsFor("issue-of-notice").every((id) => !id.startsWith("police")));
    assert.ok(channelsFor("issue-of-warrants").every((id) => id.startsWith("police")));
  });

  it("offers only what this deployment runs", () => {
    assert.ok(!channelsFor("issue-of-summons").includes("police-icops"));
    assert.ok(channelsFor("issue-of-summons").includes("police-nstep"));
  });

  it("says when the person has no destination for a chosen channel", () => {
    const { people, accusedJoined } = casePeopleFor(NOT_JOINED);
    const recipients = {
      ...defaultProcessRecipients("issue-of-summons", people, accusedJoined),
      person: "accused-2",
    };
    const harpreet = people.find((entry) => entry.id === "accused-2");
    assert.deepEqual(unreachableChannels(harpreet, recipients), ["email"]);
  });
});

describe("police stations", () => {
  it("are one per address, each from its own address", () => {
    const { people } = casePeopleFor(NOT_JOINED);
    assert.deepEqual(
      stationsFor(people, "accused-1", ["accused-1-address-1", "accused-1-address-2"]),
      { "accused-1-address-1": "Kundara", "accused-1-address-2": "Town East" },
    );
  });

  it("follow a warrant item, and keep one the drafter changed", () => {
    const context = casePeopleFor(NOT_JOINED);
    let warrant = createItemBlock("issue-of-warrants", context);
    assert.deepEqual(warrant.recipients?.policeStations, {
      "accused-1-address-1": "Kundara",
      "accused-1-address-2": "Town East",
    });
    assert.deepEqual(blockGaps(warrant, context), []);
    warrant = setItemRecipients(
      warrant,
      {
        ...warrant.recipients!,
        policeStations: {
          ...warrant.recipients!.policeStations,
          "accused-1-address-2": "Town West",
        },
      },
      context,
    );
    warrant = setItemRecipients(
      warrant,
      { ...warrant.recipients!, channels: ["police-nstep", "police-rpad"] },
      context,
    );
    assert.equal(warrant.recipients?.policeStations["accused-1-address-2"], "Town West");
  });

  it("bring a new person's addresses and stations, and move the steps with them", () => {
    const context = casePeopleFor(NOT_JOINED);
    let warrant = createItemBlock("issue-of-warrants", context);
    warrant = setItemRecipients(
      warrant,
      { ...warrant.recipients!, person: "accused-2" },
      context,
    );
    assert.deepEqual(warrant.recipients?.addresses, ["accused-2-address-1"]);
    assert.deepEqual(warrant.recipients?.policeStations, {
      "accused-2-address-1": "Kilikollur",
    });
    assert.equal(warrant.values.steps, "complainant");
    const text = setItemValue(warrant, "steps", "complainant", context).text;
    assert.ok(text.startsWith("Issue warrant to the accused Harpreet Gill."));
  });
});
