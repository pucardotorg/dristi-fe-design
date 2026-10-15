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
  destinationsOf,
  processCount,
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
    assert.deepEqual(recipients.destinations, [
      "accused-1-address-1",
      "accused-1-address-2",
      "accused-1-mobile-1",
      "accused-1-mobile-2",
      "accused-1-email-1",
      "accused-1-email-2",
    ]);
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
    assert.deepEqual(recipients.destinations, []);
  });
});

describe("channels", () => {
  it("keeps a notice off every police channel, and a warrant on police or By hand", () => {
    assert.ok(channelsFor("issue-of-notice").every((id) => !id.startsWith("police")));
    assert.ok(
      channelsFor("issue-of-warrants").every(
        (id) => id.startsWith("police") || id === "by-hand",
      ),
    );
    assert.ok(channelsFor("issue-of-warrants").includes("by-hand"));
  });

  it("offers By hand to warrant and proclamation only", () => {
    for (const type of [
      "issue-of-summons",
      "issue-of-notice",
      "issue-of-attachment",
    ] as const) {
      assert.ok(!channelsFor(type).includes("by-hand"), type);
    }
  });

  it("offers only what this deployment runs", () => {
    assert.ok(!channelsFor("issue-of-summons").includes("police-icops"));
    assert.ok(channelsFor("issue-of-summons").includes("police-nstep"));
  });

  it("says when no destination of a chosen channel's kind is ticked", () => {
    const { people, accusedJoined } = casePeopleFor(NOT_JOINED);
    const recipients = {
      ...defaultProcessRecipients("issue-of-summons", people, accusedJoined),
      person: "accused-2",
      destinations: destinationsOf(people, "accused-2"),
    };
    const harpreet = people.find((entry) => entry.id === "accused-2");
    assert.deepEqual(unreachableChannels(harpreet, recipients), ["email"]);
  });
});

describe("destinations", () => {
  it("are every postal address, mobile and email on record, all ticked", () => {
    const { people, accusedJoined } = casePeopleFor(NOT_JOINED);
    const recipients = defaultProcessRecipients("issue-of-summons", people, accusedJoined);
    const gill = people.find((entry) => entry.id === "accused-1");
    /* SMS to two mobiles, Email to two addresses, RPAD to two postal addresses. */
    assert.equal(processCount(gill, recipients), 6);
  });

  it("send a channel only to the ticked destinations of its own kind", () => {
    const { people, accusedJoined } = casePeopleFor(NOT_JOINED);
    const recipients = defaultProcessRecipients("issue-of-summons", people, accusedJoined);
    const gill = people.find((entry) => entry.id === "accused-1");
    const one = {
      ...recipients,
      destinations: recipients.destinations.filter((id) => id !== "accused-1-mobile-2"),
    };
    assert.equal(processCount(gill, one), 5);
    const noMobiles = {
      ...recipients,
      destinations: recipients.destinations.filter((id) => !id.includes("mobile")),
    };
    assert.deepEqual(unreachableChannels(gill, noMobiles), ["sms"]);
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
    assert.deepEqual(warrant.recipients?.destinations, [
      "accused-2-address-1",
      "accused-2-mobile-1",
    ]);
    assert.deepEqual(warrant.recipients?.policeStations, {
      "accused-2-address-1": "Kilikollur",
    });
    assert.equal(warrant.values.steps, "complainant");
    const text = setItemValue(warrant, "steps", "complainant", context).text;
    assert.ok(text.startsWith("Issue warrant to the accused Harpreet Gill."));
  });
});

describe("a proclamation", () => {
  it("goes By hand only, to no address, as one process", () => {
    const context = casePeopleFor(NOT_JOINED);
    assert.deepEqual(channelsFor("issue-of-proclamation"), ["by-hand"]);
    const proclamation = createItemBlock("issue-of-proclamation", context);
    assert.deepEqual(proclamation.recipients?.channels, ["by-hand"]);
    assert.deepEqual(proclamation.recipients?.destinations, []);
    assert.deepEqual(blockGaps(proclamation, context), []);
    const gill = context.people.find((entry) => entry.id === "accused-1");
    assert.equal(processCount(gill, proclamation.recipients!), 1);
    assert.deepEqual(unreachableChannels(gill, proclamation.recipients!), []);
  });

  it("still ticks no address when the person changes", () => {
    const context = casePeopleFor(NOT_JOINED);
    let proclamation = createItemBlock("issue-of-proclamation", context);
    proclamation = setItemRecipients(
      proclamation,
      { ...proclamation.recipients!, person: "accused-2" },
      context,
    );
    assert.deepEqual(proclamation.recipients?.destinations, []);
  });
});

describe("a warrant By hand", () => {
  it("adds one process beside its police channel, and asks no police station of its own", () => {
    const context = casePeopleFor(NOT_JOINED);
    const warrant = createItemBlock("issue-of-warrants", context);
    const gill = context.people.find((entry) => entry.id === "accused-1");
    const before = processCount(gill, warrant.recipients!);
    const both = setItemRecipients(
      warrant,
      { ...warrant.recipients!, channels: [...warrant.recipients!.channels, "by-hand"] },
      context,
    );
    assert.equal(processCount(gill, both.recipients!), before + 1);
    const byHandOnly = setItemRecipients(
      warrant,
      { ...warrant.recipients!, channels: ["by-hand"], destinations: [] },
      context,
    );
    assert.deepEqual(blockGaps(byHandOnly, context), []);
  });
});
