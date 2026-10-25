import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  actsForSelection,
  bandByStatus,
  buildProcessDocument,
  COURT_PROCESS_TYPES,
  defaultProcessFilters,
  filterProcesses,
  goesByHand,
  goesByPost,
  recordedByCourt,
  groupSelectionByCase,
  orderForView,
  pilePool,
  PROCESS_CHANNELS,
  PROCESS_LINE,
  PROCESS_QUEUE_COUNT,
  PROCESS_STATUSES,
  PROCESS_TABS,
  processDocumentText,
  processesAt,
  processesElsewhere,
  processesIn,
  processIdsForCase,
  processStatusLine,
  processTab,
  rebaseFilters,
  recordProcessReturns,
  executeOnDownload,
  runProcessAct,
  singleCaseMatch,
  spansStatuses,
  tabCount,
  allCounted,
  landedLine,
  moveLine,
  refusedLine,
  processAct,
  processScopeFor,
  scopeLine,
  sortProcesses,
  type CourtProcess,
  type ProcessOutcome,
} from "./sign-process";

const ON = "2026-10-06";

function only<T>(rows: T[], message: string): T {
  const [first] = rows;
  assert.ok(first, message);
  return first;
}

describe("PROCESS_LINE", () => {
  it("mints one id per row", () => {
    const ids = new Set(PROCESS_LINE.map((process) => process.id));
    assert.equal(ids.size, PROCESS_LINE.length);
  });

  it("stamps every day a row's status says it has passed, and none it has not", () => {
    for (const process of PROCESS_LINE) {
      const at = (field: keyof CourtProcess, present: boolean) =>
        assert.equal(
          process[field] !== undefined,
          present,
          `${process.id} at ${process.status}: ${String(field)} is ${String(process[field] ?? "missing")}`,
        );
      const s = process.status;
      at("issuedOn", s !== "awaiting-cover");
      at("signedOn", !["awaiting-cover", "to-sign"].includes(s));
      at("sentOn", ["in-progress", "completed"].includes(s));
      at("sendFailure", s === "send-failed");
      at("returnedOn", s === "completed");
      at("outcome", s === "completed");
    }
  });

  it("holds both answers a channel gives under Completed", () => {
    /* Not served is a kind of completion, not a status of its own (owner, 2026-10-06). */
    const completed = processesAt(PROCESS_LINE, "completed");
    assert.ok(completed.some((process) => process.outcome?.served === true));
    assert.ok(completed.some((process) => process.outcome?.served === false));
  });

  it("holds only paper where only paper can be", () => {
    /* A cover is collected, and later posted, only for registered post. */
    for (const process of processesAt(PROCESS_LINE, "awaiting-cover")) {
      assert.equal(process.channel, "rpad", process.id);
    }
    for (const process of processesAt(PROCESS_LINE, "to-post")) {
      assert.ok(goesByPost(process), process.id);
    }
    /* …and a failed send is an electronic channel refusing it. */
    for (const process of processesAt(PROCESS_LINE, "send-failed")) {
      assert.ok(!goesByPost(process), process.id);
    }
  });

  it("gives every status and every channel something to show", () => {
    for (const status of PROCESS_STATUSES) {
      assert.ok(processesAt(PROCESS_LINE, status.id).length > 0, status.id);
    }
    for (const channel of PROCESS_CHANNELS) {
      assert.ok(
        PROCESS_LINE.some((process) => process.channel === channel.id),
        channel.id,
      );
    }
  });

  it("carries a send that will be refused, under To sign", () => {
    const refusing = PROCESS_LINE.filter((process) => process.demoSendFailure);
    assert.ok(refusing.length > 0);
    for (const process of refusing) {
      assert.equal(process.status, "to-sign", process.id);
      assert.ok(!goesByPost(process), process.id);
    }
  });
});

describe("PROCESS_TABS", () => {
  it("puts every status in exactly one tab, and the tab agrees", () => {
    for (const status of PROCESS_STATUSES) {
      const holders = PROCESS_TABS.filter((tab) =>
        tab.statuses.includes(status.id),
      );
      assert.equal(holders.length, 1, status.id);
      assert.equal(holders[0].id, status.tab, status.id);
    }
  });

  it("opens each tab on a status it holds", () => {
    for (const tab of PROCESS_TABS) {
      assert.ok(
        tab.defaultView === "all" || tab.statuses.includes(tab.defaultView),
        tab.id,
      );
    }
  });

  it("cuts the line by who it waits on", () => {
    assert.deepEqual(processTab("rpad-collection").statuses, ["awaiting-cover"]);
    assert.deepEqual(processTab("issuance").statuses, [
      "to-sign",
      "to-post",
      "to-hand",
      "to-send",
      "send-failed",
    ]);
    assert.deepEqual(processTab("service").statuses, [
      "in-progress",
      "completed",
    ]);
  });

  it("counts the work in each tab — on Service, only what is still out", () => {
    assert.equal(
      tabCount(PROCESS_LINE, processTab("service")),
      processesAt(PROCESS_LINE, "in-progress").length,
    );
    assert.equal(allCounted(processTab("issuance")), true);
    assert.equal(allCounted(processTab("service")), false);
    assert.equal(
      tabCount(PROCESS_LINE, processTab("issuance")),
      processesIn(PROCESS_LINE, processTab("issuance"), "all").length,
    );
    assert.equal(
      PROCESS_QUEUE_COUNT,
      processesIn(PROCESS_LINE, processTab("rpad-collection"), "all").length +
        processesIn(PROCESS_LINE, processTab("issuance"), "all").length,
    );
  });

  it("counts only the pills that are work, and explains every one", () => {
    for (const status of PROCESS_STATUSES) {
      assert.ok(status.hint.length > 0, status.id);
      assert.equal(status.counted, status.id !== "completed", status.id);
    }
    for (const tab of PROCESS_TABS) assert.ok(tab.allHint.length > 0, tab.id);
  });

  it("orders by hearing date, soonest first, and back again", () => {
    const rows = processesIn(PROCESS_LINE, processTab("issuance"), "all");
    const soonest = sortProcesses(rows, "hearing-soonest").map((p) => p.hearingDate);
    const latest = sortProcesses(rows, "hearing-latest").map((p) => p.hearingDate);
    assert.deepEqual(soonest, [...soonest].sort());
    assert.deepEqual(latest, [...latest].sort().reverse());
    assert.equal(rows.length, soonest.length, "sorting drops nothing");
  });

  it("opens a tab on everything it holds, bar the channel it is defined by", () => {
    for (const tab of PROCESS_TABS) {
      const filters = defaultProcessFilters(tab);
      assert.equal(filters.channel, tab.onlyChannel ?? "all");
      const all = processesIn(PROCESS_LINE, tab, "all");
      assert.equal(filterProcesses(all, filters).length, all.length, tab.id);
    }
  });
});

describe("All, banded", () => {
  const tab = processTab("issuance");

  it("orders a tab's rows by its own status order, keeping the line's order inside", () => {
    const ordered = orderForView(processesIn(PROCESS_LINE, tab, "all"), tab);
    const seen = ordered.map((process) => process.status);
    const firstOf = (status: string) => seen.indexOf(status as never);
    assert.ok(firstOf("to-sign") < firstOf("to-post"));
    assert.ok(firstOf("to-post") < firstOf("send-failed"));
    /* Each status is one run, never split and rejoined. */
    for (const status of tab.statuses) {
      const at = seen.flatMap((s, i) => (s === status ? [i] : []));
      assert.equal(at[at.length - 1] - at[0] + 1, at.length, status);
    }
  });

  it("bands only a view that spans statuses, and labels whatever band it is given", () => {
    const all = processesIn(PROCESS_LINE, tab, "all");
    assert.equal(spansStatuses(all), true);
    assert.equal(spansStatuses(processesAt(PROCESS_LINE, "to-sign")), false);
    const firstPage = orderForView(all, tab).slice(0, 5);
    assert.deepEqual(
      bandByStatus(firstPage, tab).map((band) => band.status.id),
      ["to-sign"],
    );
  });
});

describe("processStatusLine", () => {
  it("writes an outcome in the instrument's own word", () => {
    const warrant = PROCESS_LINE.find(
      (process) => process.status === "completed" && process.type === "warrant",
    );
    const summons = PROCESS_LINE.find(
      (process) => process.status === "completed" && process.type === "summons",
    );
    assert.ok(warrant && summons);
    assert.equal(processStatusLine(warrant).word, "Executed");
    assert.equal(processStatusLine(summons).word, "Delivered");
  });

  it("says why, not when, for the two that went wrong — and says it in words", () => {
    for (const process of PROCESS_LINE) {
      const line = processStatusLine(process);
      const wrong =
        process.status === "send-failed" ||
        (process.status === "completed" && process.outcome?.served === false);
      assert.equal(line.warn, wrong, process.id);
      if (wrong) {
        assert.ok(line.reason, `${process.id} fails without saying why`);
        assert.match(line.word, /^(Error|Not )/, process.id);
      } else {
        assert.ok(line.day, `${process.id} has no day for its status`);
      }
    }
  });
});

describe("runProcessAct", () => {
  it("sends a collected cover for signature and stamps the day", () => {
    const cover = processesAt(PROCESS_LINE, "awaiting-cover")[0];
    const next = runProcessAct(PROCESS_LINE, "collect", new Set([cover.id]), ON);
    const moved = next.find((process) => process.id === cover.id);
    assert.equal(moved?.status, "to-sign");
    assert.equal(moved?.issuedOn, ON);
  });

  it("forks a signing run on the channel", () => {
    const toSign = processesAt(PROCESS_LINE, "to-sign");
    const post = only(toSign.filter(goesByPost), "needs an RPAD row to sign");
    const electronic = only(
      toSign.filter((p) => !goesByPost(p) && !p.demoSendFailure),
      "needs an electronic row to sign",
    );
    const refused = only(
      toSign.filter((p) => p.demoSendFailure),
      "needs a row whose send is refused",
    );
    const ids = new Set([post.id, electronic.id, refused.id]);
    const next = runProcessAct(PROCESS_LINE, "sign", ids, ON);
    const byId = new Map(next.map((process) => [process.id, process]));

    /* Registered post is signed, not sent: it waits to be carried to the post office. */
    assert.equal(byId.get(post.id)?.status, "to-post");
    assert.equal(byId.get(post.id)?.sentOn, undefined);
    /* An electronic channel goes out the same day. */
    assert.equal(byId.get(electronic.id)?.status, "in-progress");
    assert.equal(byId.get(electronic.id)?.sentOn, ON);
    /* A refused send has not left the court, so it stays in the court's tab. */
    assert.equal(byId.get(refused.id)?.status, "send-failed");
    assert.equal(byId.get(refused.id)?.sendFailure, refused.demoSendFailure);
    for (const id of ids) assert.equal(byId.get(id)?.signedOn, ON);

  });

  it("sends a refused process on the resend after", () => {
    const refused = PROCESS_LINE.find((process) => process.demoSendFailure);
    assert.ok(refused);
    const signed = runProcessAct(PROCESS_LINE, "sign", new Set([refused.id]), ON);
    const resent = runProcessAct(signed, "resend", new Set([refused.id]), ON);
    const row = resent.find((process) => process.id === refused.id);
    assert.equal(row?.status, "in-progress");
    assert.equal(row?.sendFailure, undefined);
    assert.equal(row?.sentOn, ON);
  });

  it("posts a signed cover out to Service", () => {
    const cover = processesAt(PROCESS_LINE, "to-post")[0];
    const next = runProcessAct(PROCESS_LINE, "post", new Set([cover.id]), ON);
    const row = next.find((process) => process.id === cover.id);
    assert.equal(row?.status, "in-progress");
    assert.equal(row?.sentOn, ON);
  });

  it("leaves alone what the act does not take, and the line it was given", () => {
    const before = PROCESS_LINE.map((process) => process.status);
    const unrelated = processesAt(PROCESS_LINE, "in-progress")[0];
    const next = runProcessAct(PROCESS_LINE, "sign", new Set([unrelated.id]), ON);
    assert.deepEqual(
      next.map((process) => process.status),
      before,
    );
    assert.deepEqual(
      PROCESS_LINE.map((process) => process.status),
      before,
    );
  });

  it("walks a registered-post row the whole length of the line", () => {
    const cover = processesAt(PROCESS_LINE, "awaiting-cover")[0];
    const ids = new Set([cover.id]);
    let line = runProcessAct(PROCESS_LINE, "collect", ids, ON);
    line = runProcessAct(line, "sign", ids, ON);
    line = runProcessAct(line, "post", ids, ON);
    line = recordProcessReturns(
      line,
      new Map<string, ProcessOutcome>([
        [cover.id, { served: false, reason: "Door locked" }],
      ]),
      ON,
    );
    const row = line.find((process) => process.id === cover.id);
    assert.equal(row?.status, "completed");
    assert.deepEqual(row?.outcome, { served: false, reason: "Door locked" });
    assert.equal(row?.returnedOn, ON);
  });
});

describe("recordProcessReturns", () => {
  it("records only registered post — an electronic channel reports for itself", () => {
    const out = processesAt(PROCESS_LINE, "in-progress");
    const paper = only(out.filter(goesByPost), "needs an RPAD row out");
    const sms = only(
      out.filter((p) => !goesByPost(p)),
      "needs an electronic row out",
    );
    const next = recordProcessReturns(
      PROCESS_LINE,
      new Map<string, ProcessOutcome>([
        [paper.id, { served: true }],
        [sms.id, { served: true }],
      ]),
      ON,
    );
    const byId = new Map(next.map((process) => [process.id, process]));
    assert.equal(byId.get(paper.id)?.status, "completed");
    assert.equal(byId.get(sms.id)?.status, "in-progress");
  });
});

describe("actsForSelection", () => {
  it("gives a mixed Issuance selection one act per kind of work, in line order", () => {
    const tab = processTab("issuance");
    const picked = [
      processesAt(PROCESS_LINE, "send-failed")[0],
      processesAt(PROCESS_LINE, "to-post")[0],
      processesAt(PROCESS_LINE, "to-sign")[0],
    ];
    assert.deepEqual(
      actsForSelection(tab, picked).map((group) => [
        group.act.id,
        group.rows.length,
      ]),
      [
        ["sign", 1],
        ["post", 1],
        ["resend", 1],
      ],
    );
  });

  it("offers to record only the paper — registered post and By hand — in a Service selection", () => {
    const tab = processTab("service");
    const out = processesAt(PROCESS_LINE, "in-progress");
    const groups = actsForSelection(tab, out);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].act.id, "record");
    assert.deepEqual(
      groups[0].rows.map((process) => process.id),
      out.filter(recordedByCourt).map((process) => process.id),
    );
    /* Completed and Failed are records: nothing to do to them here. */
    assert.deepEqual(
      actsForSelection(tab, processesAt(PROCESS_LINE, "completed")),
      [],
    );
  });
});

describe("the pile", () => {
  it("is paper only where only paper comes back", () => {
    const pool = pilePool(PROCESS_LINE, "in-progress");
    assert.ok(pool.length > 0);
    assert.ok(pool.every(recordedByCourt));
    assert.ok(pool.some(goesByHand), "a warrant By hand comes back as paper too");
    assert.ok(
      processesAt(PROCESS_LINE, "in-progress").some((p) => !recordedByCourt(p)),
      "the fixture needs an electronic row out, for this to mean anything",
    );
  });

  it("is nothing under All or where nobody holds paper", () => {
    assert.deepEqual(pilePool(PROCESS_LINE, "all"), []);
    assert.deepEqual(pilePool(PROCESS_LINE, "to-sign"), []);
    assert.deepEqual(pilePool(PROCESS_LINE, "completed"), []);
  });
});

describe("finding a process that has moved on", () => {
  const collection = processTab("rpad-collection");
  /* A real row sitting under To post — the case a bench would hunt for from where it
     last saw it. */
  const moved = processesAt(PROCESS_LINE, "to-post")[0];

  it("names the status that has it when this view does not", () => {
    const filters = { ...defaultProcessFilters(collection), query: moved.caseNumber };
    const here = filterProcesses(processesAt(PROCESS_LINE, "awaiting-cover"), filters);
    assert.equal(here.length, 0);
    assert.deepEqual(
      processesElsewhere(PROCESS_LINE, filters, {
        tab: "rpad-collection",
        view: "awaiting-cover",
      }).map((entry) => [entry.status.id, entry.count]),
      [["to-post", 1]],
    );
  });

  it("asks the other pills of its own tab, but not the view it is standing in", () => {
    const tab = processTab("issuance");
    const filters = { ...defaultProcessFilters(tab), query: moved.caseNumber };
    assert.deepEqual(
      processesElsewhere(PROCESS_LINE, filters, {
        tab: "issuance",
        view: "to-sign",
      }).map((entry) => entry.status.id),
      ["to-post"],
    );
    /* Under All the tab has already been asked. */
    assert.deepEqual(
      processesElsewhere(PROCESS_LINE, filters, {
        tab: "issuance",
        view: "all",
      }),
      [],
    );
  });

  it("says nothing is anywhere only when nothing is", () => {
    const filters = { ...defaultProcessFilters(collection), query: "ST/9999/2026" };
    assert.deepEqual(
      processesElsewhere(PROCESS_LINE, filters, {
        tab: "rpad-collection",
        view: "awaiting-cover",
      }),
      [],
    );
  });

  it("does not carry a tab's own channel onto a tab that is not defined by one", () => {
    const police = PROCESS_LINE.find(
      (process) => process.status === "to-sign" && process.channel === "police",
    );
    assert.ok(police);
    const filters = { ...defaultProcessFilters(collection), query: police.caseNumber };
    assert.deepEqual(
      processesElsewhere(PROCESS_LINE, filters, {
        tab: "rpad-collection",
        view: "awaiting-cover",
      }).map((entry) => entry.status.id),
      ["to-sign"],
    );
  });

  it("keeps a channel the bench chose for itself", () => {
    const from = processTab("issuance");
    const to = processTab("service");
    const chosen = { ...defaultProcessFilters(from), channel: "police" as const };
    assert.equal(rebaseFilters(chosen, from, to).channel, "police");
    const pinned = defaultProcessFilters(collection);
    assert.equal(pinned.channel, "rpad");
    assert.equal(rebaseFilters(pinned, collection, to).channel, "all");
  });

  it("does not find a row by the cause title the Case name column prints", () => {
    const cause = `${moved.parties.complainant} v. ${moved.parties.accused}`;
    const rows = filterProcesses(processesAt(PROCESS_LINE, "to-post"), {
      ...defaultProcessFilters(processTab("issuance")),
      query: cause,
    });
    assert.ok(!rows.some((process) => process.id === moved.id));
  });
});

describe("COURT_PROCESS_TYPES", () => {
  it("keeps an abbreviation's capitals in the name a screen reader gets", () => {
    const byId = new Map(COURT_PROCESS_TYPES.map((type) => [type.id, type]));
    assert.equal(byId.get("dca-notice")?.inline, "DCA notice");
    assert.equal(byId.get("section-223-notice")?.inline, "Section 223 notice");
    assert.equal(byId.get("summons")?.inline, "summons");
    for (const type of COURT_PROCESS_TYPES) {
      assert.equal(type.inline.toLowerCase(), type.label.toLowerCase(), type.id);
    }
  });
});

describe("buildProcessDocument", () => {
  it("writes a template for every instrument, and addresses all but a proclamation", () => {
    const seen = new Set<string>();
    for (const process of PROCESS_LINE) {
      const document = buildProcessDocument(process);
      seen.add(process.type);
      assert.equal(document.paragraphs.length, 2, process.id);
      if (process.type === "proclamation") {
        assert.equal(document.addressee, undefined, process.id);
        /* The line under the title is blank: no "To" line in the downloaded text. */
        const lines = processDocumentText(document).split("\n");
        assert.equal(lines[lines.indexOf(document.title) + 1], "", process.id);
      } else {
        assert.ok(document.addressee?.startsWith("To "), process.id);
      }
      assert.ok(document.title.length > 0, process.id);
    }
    assert.equal(seen.size, COURT_PROCESS_TYPES.length);
  });

  it("addresses a warrant to the officer who must execute it, not to the accused", () => {
    const warrant = PROCESS_LINE.find((process) => process.type === "warrant");
    assert.ok(warrant);
    const document = buildProcessDocument(warrant);
    assert.match(document.addressee ?? "", /officer in charge/);
    assert.ok(!document.addressee?.includes(warrant.parties.accused));
  });

  it("says plainly whether the signature is on it", () => {
    const unsigned = PROCESS_LINE.find((process) => process.status === "to-sign");
    const signed = PROCESS_LINE.find((process) => process.status === "to-post");
    assert.ok(unsigned && signed);
    assert.match(buildProcessDocument(unsigned).signature, /^Pending the signature/);
    assert.match(buildProcessDocument(signed).signature, /^Signed by the magistrate/);
  });

  it("names the listing it is returnable for inside its own prose", () => {
    for (const process of PROCESS_LINE) {
      const document = buildProcessDocument(process);
      const text = processDocumentText(document);
      assert.ok(
        text.includes(document.dated) && text.includes(document.channel),
        `${process.id} loses its date or its channel in the written form`,
      );
    }
  });

  it("recites no sum, address or process fee it does not hold", () => {
    /* The rows carry none of these, and an invented particular in a facsimile is the
       kind of detail that gets screenshot and quoted back. */
    for (const process of PROCESS_LINE) {
      const text = processDocumentText(buildProcessDocument(process));
      assert.ok(!/₹|Rs\.?\s*\d/.test(text), `${process.id} names a sum`);
    }
  });
});

describe("the selection, counted as envelopes", () => {
  const collection = processesAt(PROCESS_LINE, "awaiting-cover");

  /** A case this status holds more than one process for — the interesting shape. */
  const shared = collection.find(
    (process) =>
      collection.filter((other) => other.caseNumber === process.caseNumber)
        .length > 1,
  );
  assert.ok(shared, "the demo line needs a case with several processes waiting");

  const siblings = collection.filter(
    (process) => process.caseNumber === shared.caseNumber,
  );

  it("puts one case in one entry, however much process is inside it", () => {
    const [entry, ...rest] = groupSelectionByCase(
      collection,
      new Set(siblings.map((process) => process.id)),
    );
    assert.equal(rest.length, 0, "one envelope must not read as several");
    assert.equal(entry.caseNumber, shared.caseNumber);
    assert.equal(entry.processes.length, siblings.length);
  });

  it("counts only what is ticked, never the case's true total", () => {
    /* Two of three ticked is two covers' worth of nothing — the entry must not round up
       to the case's total, or it reports a cover as reconciled that is not. */
    const [entry] = groupSelectionByCase(
      collection,
      new Set([siblings[0].id]),
    );
    assert.equal(entry.processes.length, 1);
    assert.ok(siblings.length > 1, "the fixture must have a sibling to leave out");
  });

  it("keeps the order the envelopes were picked up in", () => {
    const other = collection.find(
      (process) => process.caseNumber !== shared.caseNumber,
    );
    assert.ok(other, "the demo line needs a second case at this status");

    /* A Set walks in insertion order, which is the clerk's own morning: the envelope
       just ticked belongs at the end of the tray, not wherever the line happens to hold
       it. Ticking the second case first must put it first. */
    const picked = groupSelectionByCase(
      collection,
      new Set([other.id, siblings[0].id]),
    );
    assert.deepEqual(
      picked.map((entry) => entry.caseNumber),
      [other.caseNumber, shared.caseNumber],
    );
  });

  it("holds a case at the place its first process was ticked", () => {
    const other = collection.find(
      (process) => process.caseNumber !== shared.caseNumber,
    );
    assert.ok(other);
    /* First, third, second: the case ticked first stays first even though its second
       process was ticked last. */
    const picked = groupSelectionByCase(
      collection,
      new Set([siblings[0].id, other.id, siblings[1].id]),
    );
    assert.deepEqual(
      picked.map((entry) => entry.caseNumber),
      [shared.caseNumber, other.caseNumber],
    );
    assert.equal(picked[0].processes.length, 2);
  });

  it("drops an id the status no longer holds rather than counting it", () => {
    const gone = processesAt(PROCESS_LINE, "to-post")[0];
    assert.ok(gone, "the demo line needs a row at another status");
    const picked = groupSelectionByCase(
      collection,
      new Set([siblings[0].id, gone.id]),
    );
    assert.equal(picked.length, 1);
    assert.equal(picked[0].caseNumber, shared.caseNumber);
  });

  it("takes the whole case out, because the whole case is the envelope", () => {
    const ids = processIdsForCase(collection, shared.caseNumber);
    assert.deepEqual(
      [...ids].sort(),
      siblings.map((process) => process.id).sort(),
    );
  });
});

describe("what Enter is allowed to commit", () => {
  const stage = processTab("rpad-collection");
  const collection = processesAt(PROCESS_LINE, "awaiting-cover");
  const base = defaultProcessFilters(stage);

  const shared = collection.find(
    (process) =>
      collection.filter((other) => other.caseNumber === process.caseNumber)
        .length > 1,
  );
  assert.ok(shared, "the demo line needs a case with several processes waiting");

  it("takes the whole envelope when the number names one case", () => {
    const matches = singleCaseMatch(collection, {
      ...base,
      query: shared.caseNumber,
    });
    assert.ok(matches, "a complete case number must resolve");
    assert.ok(matches.length > 1, "the case's other process travels with it");
    assert.ok(
      matches.every((process) => process.caseNumber === shared.caseNumber),
      "nothing from another case rides along",
    );
  });

  it("refuses to guess while two cases still match", () => {
    /* The shared prefix of the court's own numbering: enough to narrow, never enough to
       choose. Committing here would put one court's process into another's envelope on a
       keystroke the clerk did not mean as a choice. */
    const prefix = shared.caseNumber.slice(0, 3);
    const matching = new Set(
      collection
        .filter((process) => process.caseNumber.includes(prefix))
        .map((process) => process.caseNumber),
    );
    assert.ok(matching.size > 1, "the fixture needs an ambiguous prefix");
    assert.equal(singleCaseMatch(collection, { ...base, query: prefix }), null);
  });

  it("has nothing to commit when nothing matches", () => {
    assert.equal(
      singleCaseMatch(collection, { ...base, query: "ZZ/9999/1999" }),
      null,
    );
  });

  it("stays inside the status it was asked about", () => {
    /* A cover waiting for collection cannot be answered with a row that has already been
       signed, however exactly the number matches. */
    const elsewhere = processesAt(PROCESS_LINE, "to-post").find(
      (process) =>
        !collection.some((row) => row.caseNumber === process.caseNumber),
    );
    assert.ok(elsewhere, "the demo line needs a case that has moved on");
    assert.equal(
      singleCaseMatch(collection, { ...base, query: elsewhere.caseNumber }),
      null,
    );
  });
});

describe("the Service filters", () => {
  const service = processTab("service");
  const all = processesIn(PROCESS_LINE, service, "all");
  const base = defaultProcessFilters(service);

  it("splits what came back into successful and failed", () => {
    const ok = filterProcesses(all, { ...base, outcome: "served" });
    const bad = filterProcesses(all, { ...base, outcome: "unserved" });
    assert.ok(ok.length > 0 && bad.length > 0);
    assert.ok(ok.every((process) => process.outcome?.served === true));
    assert.ok(bad.every((process) => process.outcome?.served === false));
    /* A row still out has no outcome, so either filter leaves it behind. */
    assert.ok(![...ok, ...bad].some((process) => process.status === "in-progress"));
  });

  it("finds failures by why they failed", () => {
    const locked = filterProcesses(all, { ...base, reason: "Door locked" });
    assert.ok(locked.length > 0);
    assert.ok(
      locked.every(
        (process) =>
          process.outcome?.served === false &&
          process.outcome.reason === "Door locked",
      ),
    );
  });

  it("drops the outcome filters on the way to a tab that has none", () => {
    const narrowed = { ...base, outcome: "unserved" as const, reason: "Door locked" as const };
    const issuance = processTab("issuance");
    const carried = rebaseFilters(narrowed, service, issuance);
    assert.equal(carried.outcome, "all");
    assert.equal(carried.reason, "all");
    assert.equal(issuance.outcomeFilters, false);
    assert.equal(service.outcomeFilters, true);
  });
});

describe("the confirmation's one line", () => {
  it("says where the rows go, as the pill and the tab", () => {
    const cover = processesAt(PROCESS_LINE, "awaiting-cover")[0];
    assert.equal(moveLine("collect", [cover]), "It moves to To sign in Issuance.");
    const covers = processesAt(PROCESS_LINE, "to-post").slice(0, 2);
    assert.equal(moveLine("post", covers), "They move to In progress in Service.");
  });

  it("splits a signing run by where each row lands", () => {
    const toSign = processesAt(PROCESS_LINE, "to-sign");
    const post = only(toSign.filter(goesByPost), "needs an RPAD row to sign");
    const electronic = only(
      toSign.filter((p) => !goesByPost(p)),
      "needs an electronic row to sign",
    );
    assert.equal(
      moveLine("sign", [post, electronic]),
      "1 moves to To post in Issuance, 1 moves to In progress in Service.",
    );
  });

});

describe("the confirmation's success", () => {
  it("says where the rows are now, and says a refusal apart from it", () => {
    const toSign = processesAt(PROCESS_LINE, "to-sign");
    const post = only(toSign.filter(goesByPost), "needs an RPAD row to sign");
    const refusing = only(
      toSign.filter((p) => p.demoSendFailure),
      "needs a row whose send is refused",
    );
    const ids = new Set([post.id, refusing.id]);
    const after = runProcessAct(PROCESS_LINE, "sign", ids, ON).filter((p) =>
      ids.has(p.id),
    );
    assert.equal(landedLine(after), "It is now in To post in Issuance.");
    assert.equal(refusedLine(after), "1 could not be sent and is in Error in Issuance.");
    assert.equal(processAct("sign").done("2 processes"), "2 processes signed");
  });
});

describe("attachment (carried over from #43)", () => {
  const attachment = PROCESS_LINE.find((process) => process.type === "attachment");

  it("is on the line, executed by the police", () => {
    assert.ok(attachment);
    assert.equal(attachment.channel, "police");
    assert.equal(
      COURT_PROCESS_TYPES.find((type) => type.id === "attachment")?.executed,
      true,
    );
  });

  it("is addressed to the police and directs the attachment of property", () => {
    const document = buildProcessDocument(attachment!);
    const text = JSON.stringify(document);
    assert.match(text, /officer in charge of the police station/);
    assert.match(text, /attach the movable property/);
  });
});

describe("By hand", () => {
  const DAY = "2026-10-15";

  it("waits under To hand over once signed, and leaves when the CMO marks it sent", () => {
    const proclamation = PROCESS_LINE.find((process) => process.id === "pr-1328")!;
    assert.equal(proclamation.channel, "by-hand");
    const signed = runProcessAct(PROCESS_LINE, "sign", new Set([proclamation.id]), DAY);
    const afterSign = signed.find((process) => process.id === proclamation.id)!;
    assert.equal(afterSign.status, "to-hand");
    assert.equal(afterSign.signedOn, DAY);
    assert.equal(afterSign.sentOn, undefined);
    const sent = runProcessAct(signed, "hand", new Set([proclamation.id]), DAY);
    const afterSend = sent.find((process) => process.id === proclamation.id)!;
    assert.equal(afterSend.status, "in-progress");
    assert.equal(afterSend.sentOn, DAY);
  });

  it("executes a proclamation By hand when its signed copy is downloaded", () => {
    const waiting = PROCESS_LINE.find(
      (process) => process.type === "proclamation" && process.status === "to-hand",
    )!;
    const next = executeOnDownload(PROCESS_LINE, new Set([waiting.id]), DAY);
    const done = next.find((process) => process.id === waiting.id)!;
    assert.equal(done.status, "completed");
    assert.equal(done.sentOn, DAY);
    assert.equal(done.returnedOn, DAY);
    assert.deepEqual(done.outcome, { served: true });
  });

  it("leaves everything else alone on download, a warrant By hand included", () => {
    const others = PROCESS_LINE.filter(
      (process) => !(process.type === "proclamation" && process.status === "to-hand"),
    );
    const next = executeOnDownload(
      PROCESS_LINE,
      new Set(others.map((process) => process.id)),
      DAY,
    );
    assert.deepEqual(
      next.filter((process) => others.includes(process)),
      others,
    );
  });

  it("is used only by warrants and proclamations, and every proclamation uses it", () => {
    for (const process of PROCESS_LINE) {
      if (process.channel === "by-hand") {
        assert.ok(["warrant", "proclamation"].includes(process.type), process.id);
      }
      if (process.type === "proclamation") {
        assert.equal(process.channel, "by-hand", process.id);
      }
    }
  });
});


describe("e-Post and the Post officer", () => {
  it("signs e-Post into To send, and marks it sent from there", () => {
    const row = only(
      PROCESS_LINE.filter((p) => p.channel === "e-post" && p.status === "to-sign"),
      "an e-Post row to sign",
    );
    const signed = runProcessAct(PROCESS_LINE, "sign", new Set([row.id]), ON);
    const moved = only(signed.filter((p) => p.id === row.id), "the signed row");
    assert.equal(moved.status, "to-send");
    const sent = runProcessAct(signed, "send", new Set([row.id]), ON);
    const out = only(sent.filter((p) => p.id === row.id), "the sent row");
    assert.equal(out.status, "in-progress");
    assert.equal(out.sentOn, ON);
    assert.equal(recordedByCourt(out), true);
  });

  it("shows the Post officer signed e-Post rows only, and no RPAD collection", () => {
    const scope = processScopeFor("post-officer");
    const rows = scopeLine(PROCESS_LINE, scope);
    assert.ok(rows.length > 0);
    assert.ok(rows.every((p) => p.channel === "e-post"));
    assert.deepEqual(
      scope.tabs.map((tab) => tab.id),
      ["issuance", "service"],
    );
    assert.ok(scope.tabs.every((tab) => tab.onlyChannel === "e-post"));
    assert.deepEqual(scope.tabs[0].statuses, ["to-send"]);
    assert.equal(scope.tabs[0].defaultView, "to-send");
    assert.ok(rows.every((p) => p.status !== "to-sign"));
  });

  it("leaves every other seat the whole line", () => {
    const scope = processScopeFor("bench-clerk");
    assert.equal(scopeLine(PROCESS_LINE, scope), PROCESS_LINE);
    assert.equal(scope.tabs, PROCESS_TABS);
  });
});
