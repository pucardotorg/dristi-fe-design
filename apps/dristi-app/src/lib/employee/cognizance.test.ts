import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  casesOnTab,
  chainFor,
  COGNIZANCE_ACTS,
  cognizanceDocumentsFor,
  COGNIZANCE_QUEUE,
  COGNIZANCE_QUEUE_COUNT,
  COGNIZANCE_TABS,
  cognizanceTabCount,
  COURT_PLACE,
  EMPTY_COGNIZANCE_FILTERS,
  LIMITATION_DAYS,
  NOTICE_PERIOD_DAYS,
  NOTICE_WINDOW_DAYS,
  branchTerm,
  cnrFor,
  cognizanceCaseById,
  delayDays,
  FILED_ON_TERM,
  filterCognizanceCases,
  findingForTerm,
  findingsFor,
  hasDelay,
  NOTICE_DISPATCHED_TERM,
  nextCognizanceCase,
  positiveActForTab,
  summaryChunksFor,
  primaryActFor,
  tabFor,
  type CognizanceCase,
} from "./cognizance";
import { parseIsoDay } from "./hearings";

const TODAY = "2026-09-14";

/** Whole days between two `YYYY-MM-DD` days, second minus first. */
function daysBetween(from: string, to: string): number {
  const ms = parseIsoDay(to).getTime() - parseIsoDay(from).getTime();
  return Math.round(ms / 86_400_000);
}

function find(id: string): CognizanceCase {
  const matter = cognizanceCaseById(id);
  assert.ok(matter, `${id} is not in the queue`);
  return matter;
}

describe("COGNIZANCE_QUEUE", () => {
  it("is long enough to page, and longest wait first", () => {
    assert.ok(COGNIZANCE_QUEUE.length >= 21);
    const waits = COGNIZANCE_QUEUE.map((row) => row.daysSinceRegistered);
    assert.deepEqual(
      waits,
      [...waits].sort((a, b) => b - a),
    );
  });

  it("carries its own count, so the rail cannot disagree with the screen", () => {
    assert.equal(COGNIZANCE_QUEUE_COUNT, COGNIZANCE_QUEUE.length);
  });

  it("is numbered CMP throughout — cognizance is what renumbers a complaint", () => {
    for (const row of COGNIZANCE_QUEUE) {
      assert.match(row.caseNumber, /^CMP\//, row.id);
    }
  });

  it("has unique ids and does not overlap the register queue's numbers", () => {
    const ids = new Set(COGNIZANCE_QUEUE.map((row) => row.id));
    assert.equal(ids.size, COGNIZANCE_QUEUE.length);
    for (const row of COGNIZANCE_QUEUE) {
      assert.ok(row.id.startsWith("c-"), row.id);
    }
  });

  it("exercises every state the screens have to survive", () => {
    assert.ok(COGNIZANCE_QUEUE.some((row) => hasDelay(row)));
    assert.ok(COGNIZANCE_QUEUE.some((row) => !hasDelay(row)));
    assert.ok(
      COGNIZANCE_QUEUE.some((row) => row.noticeAfterDays > NOTICE_WINDOW_DAYS),
    );
    assert.ok(COGNIZANCE_QUEUE.some((row) => row.branch.place !== COURT_PLACE));
    assert.ok(COGNIZANCE_QUEUE.some((row) => !row.noticeDelivered));
    assert.ok(COGNIZANCE_QUEUE.some((row) => row.counsel.length === 0));
    assert.ok(COGNIZANCE_QUEUE.some((row) => row.counsel.length > 1));
  });

  it("pleads grounds on every late complaint and on no timely one", () => {
    for (const row of COGNIZANCE_QUEUE) {
      if (hasDelay(row)) assert.ok(row.grounds, row.id);
      else assert.equal(row.grounds, null, row.id);
    }
  });

  it("gives a reason for every notice that did not arrive", () => {
    for (const row of COGNIZANCE_QUEUE) {
      if (row.noticeDelivered) assert.equal(row.nonDeliveryReason, null, row.id);
      else assert.ok(row.nonDeliveryReason, row.id);
    }
  });
});

describe("COURT_PLACE", () => {
  it("is read off the court the staff constant already names", () => {
    assert.equal(COURT_PLACE, "Sample District");
  });
});

describe("delayDays", () => {
  it("is null inside the month §142(b) allows, and the excess past it", () => {
    assert.equal(delayDays({ filedAfterCauseDays: 1 } as CognizanceCase), null);
    assert.equal(
      delayDays({ filedAfterCauseDays: LIMITATION_DAYS } as CognizanceCase),
      null,
    );
    assert.equal(
      delayDays({ filedAfterCauseDays: LIMITATION_DAYS + 1 } as CognizanceCase),
      1,
    );
    assert.equal(delayDays({ filedAfterCauseDays: 50 } as CognizanceCase), 20);
  });
});

describe("chainFor", () => {
  it("runs backwards from the day the complaint was registered", () => {
    const matter = find("c-2041");
    const chain = chainFor(matter, TODAY);
    assert.equal(
      daysBetween(chain.registeredOn, TODAY),
      matter.daysSinceRegistered,
    );
    assert.ok(chain.filedOn < chain.registeredOn);
  });

  it("keeps the §138 chain in order on every row", () => {
    for (const matter of COGNIZANCE_QUEUE) {
      const chain = chainFor(matter, TODAY);
      for (const cheque of chain.cheques) {
        assert.ok(cheque.chequeDatedOn < cheque.presentedOn, matter.id);
        assert.ok(cheque.presentedOn < cheque.returnedOn, matter.id);
        assert.ok(cheque.returnedOn < chain.noticeDispatchedOn, matter.id);
      }
      const order = [
        chain.cheques[0].returnedOn,
        chain.noticeDispatchedOn,
        chain.deemedServedOn,
        chain.causeOfActionOn,
        chain.filedOn,
        chain.registeredOn,
      ];
      for (let at = 1; at < order.length; at += 1) {
        assert.ok(
          order[at - 1] < order[at],
          `${matter.id}: ${order[at - 1]} should precede ${order[at]}`,
        );
      }
    }
  });

  it("spaces the statutory windows exactly as the sections set them", () => {
    for (const matter of COGNIZANCE_QUEUE) {
      const chain = chainFor(matter, TODAY);
      assert.equal(
        daysBetween(chain.deemedServedOn, chain.causeOfActionOn),
        NOTICE_PERIOD_DAYS,
        matter.id,
      );
      assert.equal(
        daysBetween(chain.causeOfActionOn, chain.filedOn),
        matter.filedAfterCauseDays,
        matter.id,
      );
      /* The notice window runs from the date on the return memo (cheat sheet v4). */
      assert.equal(
        daysBetween(chain.cheques[0].returnedOn, chain.noticeDispatchedOn),
        matter.noticeAfterDays,
        matter.id,
      );
    }
  });

  it("prints a delivery date or a return date, never both and never neither", () => {
    for (const matter of COGNIZANCE_QUEUE) {
      const chain = chainFor(matter, TODAY);
      const delivered = chain.noticeDeliveredOn !== null;
      assert.equal(delivered, matter.noticeDelivered, matter.id);
      assert.equal(chain.noticeReturnedOn !== null, !delivered, matter.id);
      assert.equal(
        delivered ? chain.noticeDeliveredOn : chain.noticeReturnedOn,
        chain.deemedServedOn,
        matter.id,
      );
    }
  });
});

describe("findingsFor", () => {
  it("says nothing about a complaint that clears every check", () => {
    assert.deepEqual(findingsFor(find("c-2038")), []);
  });

  it("carries every check at once on the worst-case complaint, worst first", () => {
    /* c-2041 is the queue's showcase: filed late, notice past thirty days, branch in
       another district — so it trips all three checks, critical before note. It is the
       density the file layout has to hold (owner, 2026-09-16). */
    const findings = findingsFor(find("c-2041"));
    assert.deepEqual(
      findings.map((entry) => entry.id),
      ["notice-window", "jurisdiction", "limitation"],
    );
    /* The limitation finding stays a note, not an error — a late complaint with a
       condonation application on record is ordinary work, not a defect. */
    const limitation = findings.find((entry) => entry.id === "limitation")!;
    assert.equal(limitation.weight, "note");
    assert.equal(
      limitation.statement,
      "The complaint is outside the limitation period.",
    );
    assert.match(limitation.consequence, /20 days beyond the month/);
    assert.equal(limitation.term, "Date of complaint filing");
  });

  it("calls a notice sent past thirty days critical", () => {
    const findings = findingsFor(find("c-2030"));
    const notice = findings.find((entry) => entry.id === "notice-window");
    assert.ok(notice);
    assert.equal(notice.weight, "critical");
    assert.equal(notice.term, "Date of dispatch of demand notice");
    assert.match(notice.consequence, /38 days after/);
  });

  it("calls a branch outside this court's place critical, against that branch", () => {
    const matter = find("c-2015");
    const findings = findingsFor(matter);
    const jurisdiction = findings.find((entry) => entry.id === "jurisdiction");
    assert.ok(jurisdiction);
    assert.equal(jurisdiction.weight, "critical");
    assert.equal(jurisdiction.term, branchTerm(matter));
    assert.equal(jurisdiction.term, "Bank branch (accused)");
    assert.match(jurisdiction.consequence, /Mumbai, not Sample District/);
  });

  it("puts what can end a complaint before what is ordinary work", () => {
    const findings = findingsFor(find("c-1954"));
    assert.deepEqual(
      findings.map((entry) => entry.id),
      ["jurisdiction", "limitation"],
    );
    assert.deepEqual(
      findings.map((entry) => entry.weight),
      ["critical", "note"],
    );
  });

  it("names a branch after whoever's account the cheque went into", () => {
    assert.equal(branchTerm(find("c-2041")), "Bank branch (complainant)");
    assert.equal(branchTerm(find("c-2015")), "Bank branch (accused)");
  });

  it("names each finding after a term the file states, and resolves it", () => {
    /* The three finding terms the checks read from — the filing date and the notice
       dispatch date live on the timeline, the branch on the synopsis. */
    const KNOWN_TERMS = new Set([
      FILED_ON_TERM,
      NOTICE_DISPATCHED_TERM,
      "Bank branch (complainant)",
      "Bank branch (accused)",
    ]);
    for (const matter of COGNIZANCE_QUEUE) {
      for (const finding of findingsFor(matter)) {
        assert.ok(
          KNOWN_TERMS.has(finding.term),
          `${matter.id}: finding term "${finding.term}" is not one the file states`,
        );
        assert.equal(
          findingForTerm(findingsFor(matter), finding.term)?.id,
          finding.id,
        );
      }
    }
  });
});

describe("summaryChunksFor", () => {
  const chunksOf = (id: string) =>
    summaryChunksFor(find(id), chainFor(find(id), TODAY));
  const fieldsOf = (id: string) => chunksOf(id).flatMap((chunk) => chunk.fields);

  it("chunks a late complaint, leading with the Complaint group", () => {
    const chunks = chunksOf("c-2041");
    assert.deepEqual(
      chunks.map((chunk) => chunk.id),
      ["complaint", "cheque", "dishonour", "notice", "jurisdiction"],
    );
    assert.deepEqual(
      chunks[0].fields.map((f) => f.id),
      ["filed", "delay-duration", "delay-grounds"],
    );
    const duration = fieldsOf("c-2041").find((f) => f.id === "delay-duration")!;
    assert.match(duration.value, /20 days/);
  });

  it("shows the filing date on a complaint in time too, without the delay rows", () => {
    /* Field 1 is on both tabs; fields 11–12 are the With Delay tab's (cheat sheet §4). */
    const complaint = chunksOf("c-2030")[0];
    assert.equal(complaint.id, "complaint");
    assert.deepEqual(
      complaint.fields.map((f) => f.id),
      ["filed"],
    );
  });

  it("repeats the cheque and dishonour facts per cheque, numbered when there are several", () => {
    const chunks = chunksOf("c-2038");
    assert.deepEqual(
      chunks.map((chunk) => chunk.label),
      [
        "Complaint",
        "Cheque 1",
        "Dishonour 1",
        "Cheque 2",
        "Dishonour 2",
        "Demand notice",
        "Jurisdiction",
      ],
    );
    const reasons = fieldsOf("c-2038").filter((f) => f.term === "Reason for return of cheque");
    assert.deepEqual(
      reasons.map((f) => [f.value, f.source]),
      [
        ["Funds insufficient", "return-memo"],
        ["Exceeds arrangement", "return-memo-2"],
      ],
    );
    assert.equal(new Set(fieldsOf("c-2038").map((f) => f.id)).size, fieldsOf("c-2038").length);
  });

  it("no longer shows the date of receipt of information, dropped in PRD v3", () => {
    for (const matter of COGNIZANCE_QUEUE) {
      assert.ok(
        !summaryChunksFor(matter, chainFor(matter, TODAY))
          .flatMap((chunk) => chunk.fields)
          .some((f) => /receipt of information/i.test(f.term)),
        matter.id,
      );
    }
  });

  it("carries the PRD's tooltip on the return date of the demand notice", () => {
    const returned = fieldsOf("c-2009").find((f) => f.id === "returned-notice")!;
    assert.equal(
      returned.tooltip,
      "Date on which the demand notice was returned to the post office as undelivered.",
    );
  });

  it("keeps every chunk non-empty, so no group renders a bare heading", () => {
    for (const matter of COGNIZANCE_QUEUE) {
      for (const chunk of summaryChunksFor(matter, chainFor(matter, TODAY))) {
        assert.ok(chunk.fields.length > 0, `${matter.id}: ${chunk.id} is empty`);
      }
    }
  });

  it("names every field's source among the three documents, or leaves it unsourced", () => {
    for (const matter of COGNIZANCE_QUEUE) {
      const keys = new Set(cognizanceDocumentsFor(matter).map((d) => d.key));
      for (const field of summaryChunksFor(matter, chainFor(matter, TODAY)).flatMap(
        (chunk) => chunk.fields,
      )) {
        if (field.source) assert.ok(keys.has(field.source), `${matter.id}: ${field.source}`);
        assert.ok(field.value.trim().length > 0, `${matter.id}: ${field.term}`);
      }
    }
  });

  it("puts the branch in the Jurisdiction chunk, place as its note, sourced to the cheque", () => {
    const jurisdiction = chunksOf("c-2015").find((c) => c.id === "jurisdiction")!;
    const branch = jurisdiction.fields[0];
    assert.equal(branch.id, "branch");
    assert.equal(branch.note, "Mumbai");
    assert.equal(branch.source, "cheque");
  });

  it("shows a delivery row for a delivered notice and a return row otherwise", () => {
    const delivered = fieldsOf("c-2038").map((f) => f.id);
    assert.ok(delivered.includes("delivered"));
    assert.ok(!delivered.includes("returned-notice"));

    const undelivered = fieldsOf("c-2009").map((f) => f.id);
    assert.ok(undelivered.includes("returned-notice"));
    assert.ok(undelivered.includes("non-delivery"));
    assert.ok(!undelivered.includes("delivered"));
  });

  it("puts each finding's term on a field the summary actually shows", () => {
    for (const matter of COGNIZANCE_QUEUE) {
      const terms = new Set(
        summaryChunksFor(matter, chainFor(matter, TODAY))
          .flatMap((chunk) => chunk.fields)
          .map((f) => f.term),
      );
      for (const finding of findingsFor(matter)) {
        assert.ok(terms.has(finding.term), `${matter.id}: no field named "${finding.term}"`);
      }
    }
  });

  it("reaches the three documents the cheat sheet makes available, and no more", () => {
    assert.deepEqual(
      cognizanceDocumentsFor(find("c-2041")).map((document) => document.title),
      ["Cheque", "Return memo", "Demand notice"],
    );
  });

  it("files a cheque and a return memo per cheque, then the one notice", () => {
    assert.deepEqual(
      cognizanceDocumentsFor(find("c-2038")).map((d) => [d.no, d.title]),
      [
        [1, "Cheque 1"],
        [2, "Return memo 1"],
        [3, "Cheque 2"],
        [4, "Return memo 2"],
        [5, "Demand notice"],
      ],
    );
  });
});

describe("cnrFor", () => {
  it("derives a stable CNR from the filing number", () => {
    assert.equal(cnrFor(find("c-2041")), "KLKM010016292025");
    for (const matter of COGNIZANCE_QUEUE) {
      assert.match(cnrFor(matter), /^KLKM01\d{6}\d{4}$/, matter.id);
    }
  });
});

describe("the shape of the findings block", () => {
  it("never has more than two criticals, so \"either one\" always holds", () => {
    for (const matter of COGNIZANCE_QUEUE) {
      const critical = findingsFor(matter).filter(
        (finding) => finding.weight === "critical",
      ).length;
      assert.ok(critical <= 2, `${matter.id} carries ${critical} criticals`);
    }
  });

  it("carries at most one finding per term, so no fact takes two marks", () => {
    for (const matter of COGNIZANCE_QUEUE) {
      const terms = findingsFor(matter).map((finding) => finding.term);
      assert.equal(new Set(terms).size, terms.length, matter.id);
    }
  });
});

describe("filterCognizanceCases", () => {
  it("returns the queue unchanged with nothing asked for", () => {
    assert.equal(
      filterCognizanceCases(COGNIZANCE_QUEUE, EMPTY_COGNIZANCE_FILTERS).length,
      COGNIZANCE_QUEUE.length,
    );
  });

  it("matches a cause, either number, or an advocate", () => {
    assert.equal(
      filterCognizanceCases(COGNIZANCE_QUEUE, { query: "sainaba" })[0]?.id,
      "c-2041",
    );
    assert.equal(
      filterCognizanceCases(COGNIZANCE_QUEUE, { query: "CMP/2015/2025" })[0]?.id,
      "c-2015",
    );
    assert.equal(
      filterCognizanceCases(COGNIZANCE_QUEUE, { query: "KL-001629-2025" })[0]?.id,
      "c-2041",
    );
    assert.ok(
      filterCognizanceCases(COGNIZANCE_QUEUE, { query: "nisha" }).length > 0,
    );
  });

  it("narrows one tab's rows without reaching into the other", () => {
    const late = casesOnTab(COGNIZANCE_QUEUE, "with-delay");
    const rows = filterCognizanceCases(late, { query: "adv. suresh menon" });
    assert.ok(rows.length > 0);
    assert.ok(rows.every(hasDelay));
  });

  it("can match nothing, which is the screen's filtered empty state", () => {
    assert.equal(
      filterCognizanceCases(COGNIZANCE_QUEUE, { query: "no such party" }).length,
      0,
    );
  });
});

describe("the tabs", () => {
  it("splits the queue in two, with nothing lost and nothing counted twice", () => {
    const withDelay = casesOnTab(COGNIZANCE_QUEUE, "with-delay");
    const without = casesOnTab(COGNIZANCE_QUEUE, "without-delay");
    assert.ok(withDelay.every(hasDelay));
    assert.ok(without.every((row) => !hasDelay(row)));
    assert.equal(
      withDelay.length + without.length,
      COGNIZANCE_QUEUE.length,
      "the two halves have to add up to the whole queue",
    );
  });

  it("puts every complaint on exactly one tab", () => {
    for (const matter of COGNIZANCE_QUEUE) {
      const on = COGNIZANCE_TABS.filter((tab) => tabFor(matter) === tab.id);
      assert.equal(on.length, 1, matter.id);
    }
  });

  it("counts each tab over the whole queue, so a search cannot move it", () => {
    for (const tab of COGNIZANCE_TABS) {
      assert.equal(
        cognizanceTabCount(tab.id),
        casesOnTab(COGNIZANCE_QUEUE, tab.id).length,
      );
    }
  });

  it("has both tabs populated, so neither ships only ever empty", () => {
    for (const tab of COGNIZANCE_TABS) {
      assert.ok(cognizanceTabCount(tab.id) > 0, tab.id);
    }
  });

  it("carries one positive action per tab, and never dismissal", () => {
    for (const tab of COGNIZANCE_TABS) {
      assert.notEqual(tab.positiveAct, "dismiss", tab.id);
      assert.equal(positiveActForTab(tab.id), tab.positiveAct);
    }
  });

  it("defaults to cognizance without delay and notice with it", () => {
    assert.equal(positiveActForTab("without-delay"), "cognizance");
    assert.equal(positiveActForTab("with-delay"), "notice");
  });
});

describe("nextCognizanceCase", () => {
  it("walks on, and stops at the end of the tab it is on", () => {
    const late = casesOnTab(COGNIZANCE_QUEUE, "with-delay");
    assert.equal(nextCognizanceCase(late[0].id)?.id, late[1].id);
    assert.equal(nextCognizanceCase(late[late.length - 1].id), undefined);
    assert.equal(nextCognizanceCase("not-an-id"), undefined);
  });

  it("never walks into the other tab, which would change the act on offer", () => {
    for (const matter of COGNIZANCE_QUEUE) {
      const next = nextCognizanceCase(matter.id);
      if (next) assert.equal(tabFor(next), tabFor(matter), matter.id);
    }
  });
});

describe("primaryActFor", () => {
  it("offers cognizance on a timely complaint and notice on a late one", () => {
    assert.equal(primaryActFor(find("c-2038")), "cognizance");
    assert.equal(primaryActFor(find("c-2041")), "notice");
  });

  it("reads the act off the complaint's tab, so a state swap carries through", () => {
    for (const matter of COGNIZANCE_QUEUE) {
      assert.equal(primaryActFor(matter), positiveActForTab(tabFor(matter)));
    }
  });

  it("never offers dismissal as the primary — that is always the other button", () => {
    for (const matter of COGNIZANCE_QUEUE) {
      assert.notEqual(primaryActFor(matter), "dismiss");
    }
  });
});

describe("COGNIZANCE_ACTS", () => {
  it("names the order items the register's own catalogue carries", () => {
    assert.deepEqual(COGNIZANCE_ACTS.cognizance.items, [
      "Order for taking cognizance",
      "Summons",
    ]);
    assert.deepEqual(COGNIZANCE_ACTS.dismiss.items, ["Order to dismiss case"]);
    assert.deepEqual(COGNIZANCE_ACTS.notice.items, ["Notice"]);
  });

  it("never says the state twice — the chip and the heading are different facts", () => {
    for (const act of ["cognizance", "notice", "dismiss"] as const) {
      const spec = COGNIZANCE_ACTS[act];
      assert.notEqual(spec.settled, spec.outcome, act);
      assert.notEqual(spec.asking, spec.outcome, act);
    }
  });

  it("gives each outcome its own pair, so colour carries one meaning", () => {
    const pairs = [
      COGNIZANCE_ACTS.cognizance.badge,
      COGNIZANCE_ACTS.notice.badge,
      COGNIZANCE_ACTS.dismiss.badge,
    ];
    assert.equal(new Set(pairs).size, 3);
  });
});
