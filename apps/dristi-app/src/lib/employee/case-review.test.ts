import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  SYNOPSIS_FIELDS,
  SUMMARY_TERMS,
  CASE_REVIEW_STATUS,
  FACT_TERMS,
  FILING_WINDOW_DAYS,
  NOTICE_WINDOW_DAYS,
  PAYMENT_WINDOW_DAYS,
  PRESENTATION_WINDOW_DAYS,
  caseChainFor,
  caseBundleFor,
  caseFileGroups,
  chunkFacts,
  CASE_FILE_CHUNKS,
  CASE_FILE_ORDER,
  caseReviewFor,
  caseSlotFor,
  daysBetween,
  scrutinyFor,
  type CaseFact,
  type CaseGroup,
  type CaseReview,
  type CaseSection,
} from "./case-review";
import { formatCaseDate } from "./hearing-overview";
import { REGISTER_QUEUE, registerCaseById } from "./register-cases";

/* A fixed day, so a test asserting on dates is not a test about when it ran. */
const TODAY = "2026-09-09";

function review(id: string) {
  const found = caseReviewFor(id, TODAY);
  assert.ok(found, `no file for ${id}`);
  return found;
}

function sectionById(file: CaseReview, sectionId: string): CaseSection {
  const found = file.sections.find((section) => section.id === sectionId);
  assert.ok(found, `no section "${sectionId}"`);
  return found;
}

function groups(id: string): CaseGroup[] {
  return review(id).sections.flatMap((section) => section.groups);
}

function groupById(id: string, groupId: string): CaseGroup | undefined {
  return groups(id).find((group) => group.id === groupId);
}

/** Every fact on a file, wherever it sits — a group's own, or a record's. */
function facts(id: string): CaseFact[] {
  return groups(id).flatMap((group) => [
    ...(group.facts ?? []),
    ...(group.records ?? []).flatMap((record) => record.facts),
  ]);
}

function factByTerm(id: string, groupId: string, term: string) {
  const group = groupById(id, groupId);
  const own = [
    ...(group?.facts ?? []),
    ...(group?.records ?? []).flatMap((record) => record.facts),
  ];
  return own.find((fact) => fact.term === term);
}

describe("caseReviewFor", () => {
  it("opens a file for every complaint in the queue", () => {
    /* The reason the particulars are derived rather than transcribed: a cause title
       that is now a link must not be a dead one on thirty of thirty-five rows. */
    for (const complaint of REGISTER_QUEUE) {
      const file = caseReviewFor(complaint.id, TODAY);
      assert.ok(file, `${complaint.id} has no file`);
      assert.equal(file.caseNumber, complaint.filingNumber);
      assert.ok(file.title.includes(complaint.parties.complainant));
      assert.ok(file.title.includes(complaint.parties.accused));
    }
  });

  it("has nothing for an id the queue does not hold", () => {
    assert.equal(caseReviewFor("r-nope", TODAY), undefined);
    assert.equal(caseReviewFor("h-241", TODAY), undefined);
    assert.equal(caseReviewFor("", TODAY), undefined);
  });

  it("dates the complaint from the wait the queue row carries", () => {
    for (const id of ["r-1840", "r-714", "r-401"]) {
      const complaint = registerCaseById(id);
      assert.ok(complaint);
      assert.equal(
        daysBetween(review(id).submittedOn, TODAY),
        complaint.daysSinceSubmitted,
      );
    }
  });

  it("gives the same row the same file every time", () => {
    /* Nothing here is random, and it matters: a clerk who reloads a complaint must
       not be shown a different cheque. */
    assert.deepEqual(caseReviewFor("r-1654", TODAY), caseReviewFor("r-1654", TODAY));
  });

  it("is the four numbered sections, in the statute's order", () => {
    /* Four, not five. "Submissions from the accused" was cut by the owner on
       2026-09-11: the accused cannot file anything before the complaint is registered,
       so the section answered its own question the same way on every file in the queue
       and forever. It belongs on whatever screen shows a case *after* registration.

       The cheque and the notice lead (brief D4). The order used to be the e-filing
       form's own, which put ten rows of contact details in front of the instrument the
       complaint is about — on a screen whose reader is deciding whether to take
       cognizance. */
    assert.deepEqual(
      review("r-1840").sections.map((section) => section.id),
      ["case-specific", "litigants", "additional", "payment"],
    );
  });

  it("names the first section after the fact, not after the form's step", () => {
    /* §5a.4a applied to a heading: "Case specific details" is the e-filing form's label
       for its own second step. **Brief D4 proposes this; the owner has not ruled.** */
    const [first] = review("r-1840").sections;
    assert.equal(first.title, "The cheque and the notice");
  });

  it("holds no head for submissions the accused cannot yet have made", () => {
    /* The other edge of the same cut: not merely absent from the reading order, but
       absent from the file — no group, no absence reason, nothing for the index to
       list. A section that comes back one day comes back with a source. */
    for (const complaint of REGISTER_QUEUE) {
      assert.equal(
        groupById(complaint.id, "accused-submissions"),
        undefined,
        complaint.id,
      );
    }
  });

  it("states the queue's one status", () => {
    assert.equal(CASE_REVIEW_STATUS, "Waiting to be registered");
  });
});

/**
 * The rule the 2026-09-10 revision turns on: a value may be derived, an attribute may
 * not. Eleven rows on this file had no source at all before it — a case category, a
 * synopsis, a full-or-part-liability field that exists nowhere in the registry — and
 * the way that gets in is one term string typed at a call site. So the vocabulary is
 * declared once and checked here, in both directions: nothing prints a term the model
 * has not named, and no term string lives in the screen.
 */
describe("terms are attributes the file names", () => {
  const named = new Set<string>(Object.values(FACT_TERMS));

  it("prints only terms the model declares, on every complaint in the queue", () => {
    for (const complaint of REGISTER_QUEUE) {
      for (const fact of facts(complaint.id)) {
        assert.ok(
          named.has(fact.term),
          `${complaint.id} states "${fact.term}", which is not in FACT_TERMS`,
        );
      }
    }
  });

  it("declares no term the file never uses", () => {
    /* The other edge of the same rule: a vocabulary nobody checks grows names for
       fields that were cut, and the next reader cannot tell which are live. */
    const printed = new Set(
      REGISTER_QUEUE.flatMap((complaint) =>
        facts(complaint.id).map((fact) => fact.term as string),
      ),
    );
    for (const term of named) {
      assert.ok(printed.has(term), `FACT_TERMS names "${term}", which nothing prints`);
    }
  });

  it("leaves no term string in either screen", () => {
    /* Read rather than rendered: the claim is about the source, not about one render. A
       term typed into a screen would be an attribute invented outside the model, which
       is exactly the defect this file's §5a census found.

       **One place writes a fact's term** (2026-09-11). The file view's fact rows are the
       only site; the glance's finding detail that was the second is gone — the summary
       states its facts on the rows they belong to, under its own five names (asserted
       below). Whatever is inside a `<DescriptionTerm>` must be an interpolation, so a
       literal cannot get in unnoticed; a second rendering site is a deliberate change
       and should arrive with a reason. */
    const files = [
      "../../components/employee/register-case-screen.tsx",
      "../../components/employee/register-case-file.tsx",
    ];
    let rendered = 0;
    for (const path of files) {
      const screen = readFileSync(new URL(path, import.meta.url), "utf8");
      const terms = [
        ...screen.matchAll(/<DescriptionTerm\b[^>]*>([\s\S]*?)<\/DescriptionTerm>/g),
      ];
      for (const term of terms) {
        rendered += 1;
        /* An interpolation of any shape — `{term}`, `{fact.term}`, a `<Marked>` of the
           label it was handed — is a value that came from the model. A quoted string is
           a term somebody typed, and that is the only thing this is looking for. */
        assert.doesNotMatch(
          term[1].trim(),
          /["']/,
          `${path} writes a term rather than printing one: ${term[1].trim()}`,
        );
      }
    }
    assert.equal(
      rendered,
      3,
      "the file's fact row and the summary's fact and span rows — the documents' own " +
        "read-from row moved to the shared DocumentScroller when the panel became a " +
        "scroll (2026-09-14), and its terms are model-sourced there too",
    );
  });

  it("names the summary's sections and rows from the model, and uses every name", () => {
    /* The synopsis is the owner's own document, so its section and row names are declared
       lists. A label typed into the screen is one nobody sourced; a declared name nothing
       renders is a part of the synopsis the screen promised and dropped. */
    /* One build since 2026-09-12: the first two were deleted when the third became
       Register cases, so the vocabulary is held to this screen alone. */
    const builds = [
      {
        path: "../../components/employee/register-case-screen.tsx",
        section: "SynopsisSection",
        row: "(?:Fact|ScrutinyFact)",
      },
    ];
    const screens: string[] = [];
    for (const build of builds) {
      const screen = readFileSync(new URL(build.path, import.meta.url), "utf8");
      screens.push(screen);
      const section = new RegExp(`<${build.section}\\b[^>]*\\blabel=\\{([^}]+)\\}`, "g");
      const typedSection = new RegExp(`<${build.section}\\b[^>]*\\blabel="`);
      const row = new RegExp(`<${build.row}\\b[^>]*\\bterm=\\{([^}]+)\\}`, "g");
      const typedRow = new RegExp(`<${build.row}\\b[^>]*\\bterm="`);
      const sections = [...screen.matchAll(section)];
      assert.ok(sections.length > 0, `${build.path} renders sections`);
      for (const found of sections) assert.match(found[1].trim(), /^SUMMARY_TERMS\./, found[1]);
      assert.doesNotMatch(screen, typedSection, `${build.path}: a section with a typed label`);
      const rows = [...screen.matchAll(row)];
      assert.ok(rows.length > 0, `${build.path} renders rows`);
      for (const found of rows) assert.match(found[1].trim(), /^SYNOPSIS_FIELDS\./, found[1]);
      assert.doesNotMatch(screen, typedRow, `${build.path}: a row with a typed term`);
    }
    const all = screens.join("\n");
    for (const key of Object.keys(SUMMARY_TERMS)) {
      assert.ok(all.includes(`SUMMARY_TERMS.${key}`), `SUMMARY_TERMS.${key} is never rendered`);
    }
    for (const key of Object.keys(SYNOPSIS_FIELDS)) {
      assert.ok(all.includes(`SYNOPSIS_FIELDS.${key}`), `SYNOPSIS_FIELDS.${key} is never rendered`);
    }
  });
});

/**
 * The report's first statement — how this complaint was scrutinised (brief D23).
 *
 * The values are derived the way the §138 chain is, and the same two things are worth a
 * test rather than a comment: that they are **coherent** (nothing happens outside the
 * wait, a round count no wait can hold is clamped) and that they are **facts** (they
 * vary across the queue, in both members of the enum). A report whose numbers read the
 * same on all thirty-five complaints would be the constant-column defect one level up,
 * and a "Cleared" date after the day the complaint reached the queue would be the report
 * contradicting the header two panels above it.
 */
describe("the scrutiny report", () => {
  it("states one for every complaint in the queue", () => {
    /* The "Not recorded" branch is real and the model must be able to say it (brief §10),
       but it cannot arise here: every row in this queue has waited at least a day. If
       this starts failing, a fixture's wait went to zero — not the branch appearing. */
    for (const complaint of REGISTER_QUEUE) {
      assert.ok(
        scrutinyFor(complaint.id, TODAY),
        `${complaint.id} has no scrutiny record`,
      );
    }
    assert.equal(scrutinyFor("r-nope", TODAY), undefined);
  });

  it("clears inside the wait, never before the filing and never after today", () => {
    for (const complaint of REGISTER_QUEUE) {
      const file = review(complaint.id);
      const scrutiny = scrutinyFor(complaint.id, TODAY);
      assert.ok(scrutiny);
      assert.ok(
        scrutiny.clearedOn >= file.submittedOn,
        `${complaint.id} cleared before it was filed`,
      );
      assert.ok(
        scrutiny.clearedOn <= TODAY,
        `${complaint.id} cleared after today`,
      );
      /* The duration has to fit in the wait as well as the clearing date: the registry
         cannot have spent longer on it than the complaint has existed. */
      assert.ok(
        scrutiny.days <= complaint.daysSinceSubmitted,
        `${complaint.id} took ${scrutiny.days} days inside a ${complaint.daysSinceSubmitted}-day wait`,
      );
      assert.ok(scrutiny.days >= scrutiny.rounds, complaint.id);
      assert.ok(scrutiny.rounds >= 1, complaint.id);
    }
  });

  it("cannot claim more rounds than a complaint has been alive for", () => {
    /* `r-701` waited three days. A mark asking for two rounds on it would be a file that
       went round the advocate↔registry loop twice inside a long weekend, which is the
       kind of thing a clerk spots before anything else on the screen. */
    for (const complaint of REGISTER_QUEUE) {
      const scrutiny = scrutinyFor(complaint.id, TODAY);
      assert.ok(scrutiny);
      assert.ok(
        scrutiny.rounds * 3 <= complaint.daysSinceSubmitted || scrutiny.rounds === 1,
        `${complaint.id}: ${scrutiny.rounds} rounds in ${complaint.daysSinceSubmitted} days`,
      );
    }
  });

  it("varies in rounds, in duration and in who did it", () => {
    /* Three facts, so three things that have to take more than one value — the same rule
       `FACT_TERMS` is held to. "Rounds: 1" on all thirty-five would be the owner's own
       question ("how many times did the advocate take to get through") answered with a
       constant. */
    const records = REGISTER_QUEUE.map((complaint) => {
      const scrutiny = scrutinyFor(complaint.id, TODAY);
      assert.ok(scrutiny);
      return scrutiny;
    });
    assert.ok(
      new Set(records.map((record) => record.rounds)).size > 1,
      "every complaint took the same number of rounds",
    );
    assert.ok(
      new Set(records.map((record) => record.days)).size > 3,
      "every complaint took the same time",
    );
    assert.deepEqual(
      [...new Set(records.map((record) => record.mode))].sort(),
      ["automated", "officer"],
      "the two members of the enum both appear, and no third does",
    );
  });

  it("gives the same row the same record every time", () => {
    assert.deepEqual(
      scrutinyFor("r-1840", TODAY),
      scrutinyFor("r-1840", TODAY),
    );
  });

  it("writes the clearing day out the way every other date on the screen is", () => {
    const scrutiny = scrutinyFor("r-1840", TODAY);
    assert.ok(scrutiny);
    assert.equal(scrutiny.clearedOnLabel, formatCaseDate(scrutiny.clearedOn));
  });
});

/**
 * A fact points at the document it would be read from (brief D27).
 *
 * `CaseFact.source` replaced pairing-by-order, and the whole value of the change is that
 * the mapping is now checkable: the brief's `Checked against` column was prose in a
 * document nobody could run. What this asserts is that every source **resolves**, and
 * resolves inside the fact's own group — not that it is *correct*, which nothing here can
 * prove and which §11.6 accepts as a standing risk.
 */
describe("a fact and its source document", () => {
  /** Every fact on a file, with the group it sits in. */
  function sourced(id: string) {
    return groups(id).flatMap((group) =>
      [
        ...(group.facts ?? []),
        ...(group.records ?? []).flatMap((record) => record.facts),
      ].map((fact) => ({ fact, group })),
    );
  }

  it("names a slot this model declares, in the fact's own group", () => {
    for (const complaint of REGISTER_QUEUE) {
      for (const { fact, group } of sourced(complaint.id)) {
        if (!fact.source) continue;
        const slot = caseSlotFor(fact.source);
        assert.ok(
          slot,
          `${complaint.id}: "${fact.term}" reads off "${fact.source}", which is not a slot`,
        );
        assert.equal(
          slot.group,
          group.id,
          `${complaint.id}: "${fact.term}" sits in ${group.id} and reads off a slot in ${slot.group}`,
        );
      }
    }
  });

  it("names a slot the group actually lists, so the pane has a tab for it", () => {
    /* Resolving to a declared slot is not enough: the pane's tab set is the *group's own*
       documents, so a source naming a slot that group never renders would select a tab
       that is not there. */
    for (const complaint of REGISTER_QUEUE) {
      for (const { fact, group } of sourced(complaint.id)) {
        if (!fact.source) continue;
        const keys = [
          ...(group.documents ?? []).map((doc) => doc.key),
          ...(group.records ?? []).flatMap((record) =>
            (record.documents ?? []).map((doc) => doc.key),
          ),
        ];
        assert.ok(
          keys.includes(fact.source),
          `${complaint.id}: "${fact.term}" reads off "${fact.source}", which ${group.id} does not list`,
        );
      }
    }
  });

  it("leaves the seventeen declared-only rows on r-1840 without one", () => {
    /* D27's own number, and the reason it is worth locking: those rows are deliberately
       **not controls**, and the count is what the check caption's limit is about. A row
       quietly gaining a source would make it pressable without anyone deciding that it
       should be.

       47 rows, not 41, since 2026-09-12: the six identity rows that used to be printed
       under a card's title are rows of the file now (D49). Four of them carry a source —
       a name is read off an ID proof, a cheque number off the cheque — and the two
       litigant types do not, because no instrument states them.

       46 since 2026-10-18: "Why the cheque was issued" was retired (the nature of the
       debt already answers it). It read off the proof of debt, so the declared-only
       count does not move. */
    const rows = sourced("r-1840").map(({ fact }) => fact);
    assert.equal(rows.length, 46, "the file's own fact rows");
    assert.equal(
      rows.filter((fact) => fact.source === undefined).length,
      17,
      "declared-only rows",
    );
  });

  it("keeps an advocate's row on that advocate's own card", () => {
    /* The per-record half of the mapping. Three advocates file three Bar ID cards, and a
       source keyed to the group rather than the record would send every row to the first
       one. */
    const advocate = groupById("r-1840", "advocates")?.records?.[0];
    assert.equal(advocate?.facts[0]?.source, "advocate-1-bar-id-card");
  });
});

/**
 * The other half of the same rule, and the one the 2026-09-11 review added.
 *
 * "Is this a real attribute?" was checkable; "is this a real *fact*?" was not. A row
 * whose value is identical on all thirty-five complaints is not something the court is
 * reading about *this* complaint — it is the statute, or the form's own precondition,
 * printed once per file. Five of them were on this screen at once: the §138 prayer, the
 * complainant's deposit tick, "Filed within one month: No" inside a group that exists
 * only because it was not, a power of attorney that was always "No", and every witness
 * offered to speak to the transaction. None broke a gate, and each read as a fact.
 *
 * So the vocabulary is measured rather than trusted: across the whole queue, every term
 * in `FACT_TERMS` must take more than one value. `undefined` counts as a value, because
 * a row that is stated on one file and absent on another is telling the reader
 * something; a row absent on all of them would not be printed at all.
 */
describe("a fact varies, or it is not a fact", () => {
  /**
   * Terms the owner would accept as constant across the queue.
   *
   * **Empty, and that is the point.** An entry here is a standing exception, so each
   * one would have to say which reader is served by a row that reads the same on every
   * complaint in the court. Nothing in the file needed one after the 2026-09-11 pass:
   * `Other details` was the near miss — the form's catch-all, empty on most filings —
   * and it is a *sometimes* rather than a constant, which is what the two marked files
   * make it.
   */
  const CONSTANT_BY_DESIGN = new Set<string>([]);

  it("takes more than one value across the queue, for every term", () => {
    const seen = new Map<string, Set<string | undefined>>();
    for (const complaint of REGISTER_QUEUE) {
      for (const fact of facts(complaint.id)) {
        const values = seen.get(fact.term) ?? new Set();
        values.add(fact.value);
        seen.set(fact.term, values);
      }
    }

    for (const term of Object.values(FACT_TERMS)) {
      if (CONSTANT_BY_DESIGN.has(term)) continue;
      const values = seen.get(term);
      assert.ok(values, `nothing prints "${term}"`);
      assert.ok(
        values.size > 1,
        `"${term}" reads "${[...values][0]}" on all ${REGISTER_QUEUE.length} complaints — a value identical on every record is not a fact`,
      );
    }
  });

  it("allows nothing constant without saying why", () => {
    /* The allowlist is a set of *terms*, so a name that no longer exists cannot sit in
       it unnoticed and quietly excuse the next constant row that takes its place. */
    const named = new Set<string>(Object.values(FACT_TERMS));
    for (const term of CONSTANT_BY_DESIGN) {
      assert.ok(named.has(term), `"${term}" is allowlisted but is not a term`);
    }
  });
});

describe("the §138 chain", () => {
  it("runs oldest to newest on every complaint", () => {
    for (const complaint of REGISTER_QUEUE) {
      const chain = caseChainFor(complaint.id, TODAY);
      assert.ok(chain);
      const order = [
        chain.chequeOn,
        chain.depositedOn,
        chain.returnedOn,
        chain.noticeSentOn,
        chain.noticeServedOn,
        chain.accruedOn,
        chain.submittedOn,
      ];
      assert.deepEqual(
        order,
        [...order].sort(),
        `${complaint.id} has its chain out of order`,
      );
    }
  });

  it("keeps every complaint inside the windows the Act fixes", () => {
    for (const complaint of REGISTER_QUEUE) {
      const chain = caseChainFor(complaint.id, TODAY);
      assert.ok(chain);

      /* §138(a) — the cheque is presented within three months of its date, and the
         row that answers that question agrees with the two dates it sits under. One
         complaint in the queue is deliberately outside the window, because a deposit
         row that says "Yes" on all thirty-five is not a check. */
      const presentation = daysBetween(chain.chequeOn, chain.depositedOn);
      assert.ok(presentation > 0, `${complaint.id}: ${presentation}`);
      assert.equal(
        factByTerm(complaint.id, "cheque", FACT_TERMS.depositedInTime)?.value,
        presentation <= PRESENTATION_WINDOW_DAYS ? "Yes" : "No",
        `${complaint.id} deposited the cheque after ${presentation} days`,
      );

      /* §138(b) — the demand notice goes out within thirty days of the return. */
      const notice = daysBetween(chain.returnedOn, chain.noticeSentOn);
      assert.ok(
        notice > 0 && notice <= NOTICE_WINDOW_DAYS,
        `${complaint.id} sent the notice after ${notice} days`,
      );

      /* §138(c) — the offence is complete fifteen days after service, exactly. */
      assert.equal(
        daysBetween(chain.noticeServedOn, chain.accruedOn),
        PAYMENT_WINDOW_DAYS,
        `${complaint.id} accrues at the wrong distance from service`,
      );
    }
  });

  it("files in time unless the file carries an application to condone the delay", () => {
    for (const complaint of REGISTER_QUEUE) {
      const chain = caseChainFor(complaint.id, TODAY);
      assert.ok(chain);
      const condonation = groupById(complaint.id, "delay-condonation");
      const late = chain.sinceAccrual > FILING_WINDOW_DAYS;

      /* The two have to agree in both directions: a late complaint with no
         application would be a file the court could not entertain, and an
         application on a complaint filed in time would be answering a question
         nobody asked. */
      assert.equal(
        late,
        condonation !== undefined,
        `${complaint.id} is ${late ? "late" : "in time"} and ${
          condonation ? "has" : "has no"
        } delay condonation`,
      );
    }
  });

  it("reports the delay as the days past the month, not the whole gap", () => {
    const chain = caseChainFor("r-1840", TODAY);
    assert.ok(chain);
    const beyond = factByTerm("r-1840", "delay-condonation", FACT_TERMS.daysBeyondMonth);
    assert.equal(beyond?.value, String(chain.sinceAccrual - FILING_WINDOW_DAYS));
  });

  it("states the §138 dates in the order the Act runs them", () => {
    /* The renamed terms still name the same chain, and the file prints it in order:
       the cheque, its deposit, its return, the notice out, the notice served, the
       fifteen days run. A rename that shuffled these would be a rename that changed
       what the court reads. */
    const cheque = groupById("r-1840", "cheque")?.records?.[0].facts ?? [];
    const dated = cheque
      .map((fact) => fact.term)
      .filter((term) =>
        (
          [
            FACT_TERMS.chequeDated,
            FACT_TERMS.depositedOn,
            FACT_TERMS.returnedOn,
          ] as string[]
        ).includes(term),
      );
    assert.deepEqual(dated, [
      FACT_TERMS.chequeDated,
      FACT_TERMS.depositedOn,
      FACT_TERMS.returnedOn,
    ]);

    const notice = groupById("r-1840", "demand-notice")?.facts ?? [];
    assert.deepEqual(
      notice.map((fact) => fact.term),
      [
        FACT_TERMS.noticeDispatched,
        FACT_TERMS.noticeServed,
        FACT_TERMS.replyReceived,
        FACT_TERMS.noticePeriodEnded,
      ],
    );
  });
});

describe("the states a file can be in", () => {
  it("says so when no witness was named", () => {
    /* A closed reason, not a sentence. "No witness added" was one of three authored
       absence strings; "added" was the form's word for what the filer did to a list,
       and a complainant *names* a witness in the complaint. */
    assert.deepEqual(groupById("r-1490", "witnesses")?.empty, {
      reason: "none-named",
    });
    assert.equal(groupById("r-1490", "witnesses")?.records?.length, 0);
  });

  it("keeps the consequence of an absence out of the absence", () => {
    /* The reason is the file's and the clause is the product's voice, so an empty head
       can be counted and translated without re-authoring the sentence around it. */
    assert.deepEqual(groupById("r-1490", "advocates")?.empty, {
      reason: "none-on-record",
      explanation: "The complainant appears in person.",
    });
  });

  it("varies what a witness is offered to speak to", () => {
    /* `Witness.prove` is a real field. Every witness on every complaint used to be
       offered for the transaction, which made the row a caption on the group. */
    const spoken = new Set(
      REGISTER_QUEUE.flatMap((complaint) =>
        facts(complaint.id)
          .filter((fact) => fact.term === FACT_TERMS.speaksTo)
          .map((fact) => fact.value),
      ),
    );
    assert.ok(spoken.size > 1, [...spoken].join(" / "));
  });

  it("names the litigant type from the enum, and it is not always the same", () => {
    /* `Complainant.type` — "Individual" typed on every complainant is decoration.
       `r-612` is the queue's one complaint filed by an entity. */
    const tags = new Set(
      REGISTER_QUEUE.map(
        (complaint) =>
          groupById(complaint.id, "complainant")?.records?.[0].tag,
      ),
    );
    assert.deepEqual([...tags].sort(), ["Company", "Individual"]);
    assert.equal(
      groupById("r-612", "complainant")?.records?.[0].tag,
      "Company",
    );
    /* And an entity carries a signatory and a registered office where a person carries
       an age — which is what makes the tag worth printing. */
    assert.ok(
      factByTerm("r-612", "complainant", FACT_TERMS.authorisedSignatory)?.value,
    );
    assert.equal(
      factByTerm("r-612", "complainant", FACT_TERMS.age),
      undefined,
    );
    /* And the name the tag sits beside is a firm's. It read "Thomas Kurien" until
       2026-09-11 — a person carrying a *Company* tag, an authorised signatory and a
       registered office, which is a fixture contradicting itself in three rows at
       once. */
    assert.equal(
      groupById("r-612", "complainant")?.records?.[0].heading,
      "Kurien Agencies",
    );
  });

  it("leaves no tag on an advocate, every one being for the complainant", () => {
    for (const id of ["r-1840", "r-1588"]) {
      for (const record of groupById(id, "advocates")?.records ?? []) {
        assert.equal(record.tag, undefined, id);
      }
    }
  });

  it("states a power of attorney only where the complaint is filed through one", () => {
    assert.equal(
      factByTerm("r-1104", "complainant", FACT_TERMS.powerOfAttorney)?.value,
      "Yes",
    );
    assert.equal(
      factByTerm("r-714", "complainant", FACT_TERMS.powerOfAttorney)?.value,
      "No",
    );
  });

  it("answers the three-month deposit against the dates, not the filer's tick", () => {
    /* `r-1333` presented the cheque outside §138(a)'s three months — the one file where
       the row has a consequence for whether the court can take cognizance at all. */
    const chain = caseChainFor("r-1333", TODAY);
    assert.ok(chain);
    assert.ok(
      daysBetween(chain.chequeOn, chain.depositedOn) > PRESENTATION_WINDOW_DAYS,
    );
    assert.equal(
      factByTerm("r-1333", "cheque", FACT_TERMS.depositedInTime)?.value,
      "No",
    );
    assert.equal(
      factByTerm("r-1840", "cheque", FACT_TERMS.depositedInTime)?.value,
      "Yes",
    );
  });

  it("marks the deposit answer as the exception only where it is no", () => {
    /* The screen spends its single coloured mark on this row, so *which* answer is the
       exception is decided here rather than by a string comparison in the render — the
       same rule that keeps term strings out of the screen. Nothing else on the file
       carries the flag, which is what makes it one mark and not a palette. */
    assert.equal(
      factByTerm("r-1333", "cheque", FACT_TERMS.depositedInTime)?.exception,
      true,
    );
    for (const complaint of REGISTER_QUEUE) {
      const marked = facts(complaint.id).filter((fact) => fact.exception);
      if (complaint.id === "r-1333") {
        assert.equal(marked.length, 1, complaint.id);
        assert.equal(marked[0].value, "No");
      } else {
        assert.deepEqual(marked, [], `${complaint.id} marks an exception`);
      }
    }
  });

  it("lists the witnesses when there are some", () => {
    assert.equal(groupById("r-1840", "witnesses")?.records?.length, 2);
    assert.equal(groupById("r-1840", "witnesses")?.empty, undefined);
  });

  it("keeps a document slot on the page when it was left empty", () => {
    /* The partial file: delayed, and the application itself never uploaded. The slot
       has to survive — a court deciding on a late complaint needs to see that the
       thing excusing the delay is missing, not to be shown a shorter list. */
    const condonation = groupById("r-1588", "delay-condonation");
    assert.equal(condonation?.documents?.length, 1);
    const application = condonation?.documents?.[0];
    assert.equal(application?.label, "Delay condonation application");
    assert.equal(application?.state, "absent");
  });

  it("does not cite an application that is not on the file", () => {
    /* `r-1588` is late and never uploaded the application, so there are no grounds to
       state: the grounds live *in* the application. The row stays and the screen says
       "Not stated", rather than a sentence composed about the absence. `r-1840` is late
       and did file, so it carries the filer's own words. */
    const missing = factByTerm("r-1588", "delay-condonation", FACT_TERMS.grounds);
    assert.ok(missing, "the grounds row should still be on the file");
    assert.equal(missing.value, undefined);

    const present = factByTerm("r-1840", "delay-condonation", FACT_TERMS.grounds);
    assert.ok(present?.value, "a filed application states its grounds");
  });

  it("answers the reply as the yes-or-no the registry holds", () => {
    /* `DemandNotice.replied` is a `YesNo`. The slot used to hold a date on one file and
       the sentence "No reply received" on another — two kinds of thing in one slot,
       which nothing can sort, filter or translate. */
    assert.equal(
      factByTerm("r-1722", "demand-notice", FACT_TERMS.replyReceived)?.value,
      "No",
    );
    assert.equal(
      factByTerm("r-1840", "demand-notice", FACT_TERMS.replyReceived)?.value,
      "Yes",
    );

    const reply = groupById("r-1722", "demand-notice")?.documents?.find(
      (document) => document.label === "Reply to the notice",
    );
    assert.equal(reply?.state, "absent");
  });

  it("carries the reason the bank gave, once", () => {
    /* Once, not twice: the sworn register of the same fact existed only to fill a
       tinted alert that restated the row above it, and both went. */
    assert.equal(
      factByTerm("r-1722", "cheque", FACT_TERMS.returnReason)?.value,
      "Payment stopped by drawer",
    );
    assert.equal(
      factByTerm("r-1402", "cheque", FACT_TERMS.returnReason)?.value,
      "Account closed",
    );
  });

  it("names both police stations the registry holds", () => {
    /* `Jurisdiction.payeePolice` and `drawerPolice` are two fields, and §138
       jurisdiction turns on the first. One unqualified row used to stand for both. */
    assert.ok(factByTerm("r-1840", "cheque", FACT_TERMS.payeePolice)?.value);
    assert.ok(factByTerm("r-1840", "cheque", FACT_TERMS.drawerPolice)?.value);
  });

  it("states a part payment only on a file that carries one", () => {
    assert.equal(
      factByTerm("r-1654", "debt", FACT_TERMS.paymentAgainstCheque)?.value,
      "Part payment made",
    );
    const paid = factByTerm("r-1654", "debt", FACT_TERMS.partAmount);
    assert.ok(paid?.value, "a part-payment file says how much was paid");

    assert.equal(
      factByTerm("r-714", "debt", FACT_TERMS.paymentAgainstCheque)?.value,
      "No payment made",
    );
    assert.equal(
      factByTerm("r-714", "debt", FACT_TERMS.partAmount),
      undefined,
      "a file with no payment has no amount to state",
    );
  });

  it("says the complainant appears in person when no vakalat is on record", () => {
    /* `r-1490` has an empty advocates cell on the queue too. The two readings of the
       same absence must not disagree. */
    assert.equal(registerCaseById("r-1490")?.counsel.length, 0);
    assert.match(
      groupById("r-1490", "advocates")?.empty?.explanation ?? "",
      /appears in person/,
    );
    assert.equal(groupById("r-1588", "advocates")?.records?.length, 2);
  });
});

describe("derived numbers", () => {
  it("does not let one number turn up as another", () => {
    /* A single multiplier put a complaint's cheque number inside its complainant's
       mobile number, which is the tell that the whole file is generated. */
    for (const complaint of REGISTER_QUEUE) {
      const file = review(complaint.id);
      /* Looked up by id rather than by position: the sections were reordered by D4,
         and a test that indexes them asserts the order twice — once here by accident. */
      const parties = sectionById(file, "litigants").groups.flatMap(
        (group) => group.records ?? [],
      );
      /* Matched rather than stripped: `replace(/\D/g, "")` swallows the country
         code too, and a ten-digit line then measures twelve. */
      const mobiles = parties
        .flatMap((record) => record.facts)
        .filter((fact) => fact.term === FACT_TERMS.mobile)
        .map((fact) => /^\+91 (\d{5}) (\d{5})$/.exec(fact.value ?? ""))
        .map((match) => {
          assert.ok(match, "a mobile number should be +91 then five and five");
          return `${match[1]}${match[2]}`;
        });
      const cheque = (
        sectionById(file, "case-specific").groups.find(
          (group) => group.id === "cheque",
        )?.records?.[0].heading ?? ""
      ).replace(/\D/g, "");

      assert.ok(cheque.length === 6, cheque);
      assert.ok(mobiles.length > 0, `${complaint.id} states no mobile at all`);
      for (const mobile of mobiles) {
        assert.equal(mobile.length, 10, `${complaint.id}: ${mobile}`);
        assert.ok(
          !mobile.includes(cheque),
          `${complaint.id}: cheque ${cheque} appears in mobile ${mobile}`,
        );
      }

      /* The same defect one length down, found on 2026-09-11: a six-digit draw and a
         nine-digit draw off the same salt are the same number truncated, so every payee
         IFSC ended in the last six digits of the complainant's mobile. The mix now
         takes the length as well as the salt. */
      const ifscs = (
        sectionById(file, "case-specific").groups.find(
          (group) => group.id === "cheque",
        )?.records?.[0].facts ?? []
      )
        .filter(
          (fact) =>
            fact.term === FACT_TERMS.payeeIfsc ||
            fact.term === FACT_TERMS.payerIfsc,
        )
        .map((fact) => (fact.value ?? "").slice(-6));
      assert.equal(ifscs.length, 2, complaint.id);
      for (const ifsc of ifscs) {
        for (const mobile of mobiles) {
          assert.notEqual(
            ifsc,
            mobile.slice(-6),
            `${complaint.id}: IFSC ends in the last six of mobile ${mobile}`,
          );
          assert.ok(
            !mobile.includes(ifsc),
            `${complaint.id}: IFSC tail ${ifsc} appears in mobile ${mobile}`,
          );
        }
      }
    }
  });

  it("does not start every mobile number with the same digits", () => {
    /* The tell that a queue is generated, found on the render 2026-09-11: a `CMP` serial
       is four digits at most, so the old multiplier's product never reached the modulus
       a nine-digit draw takes and every line came out `+91 91…`. A spread is the claim,
       not the multiplier — a future reseed that reintroduces the collapse fails here. */
    const leads = new Set(
      REGISTER_QUEUE.flatMap((complaint) =>
        facts(complaint.id)
          .filter((fact) => fact.term === FACT_TERMS.mobile)
          .map((fact) => (fact.value ?? "").slice(4, 6)),
      ),
    );
    assert.ok(
      leads.size >= 5,
      `every mobile in the queue starts ${[...leads].join(" / ")}`,
    );
  });

  it("gives the complainant two addresses that are not the same string", () => {
    /* Permanent and current used to print one address under two labels, which reads
       as a rendering fault rather than as two answers that agree. */
    for (const id of ["r-714", "r-1840", "r-1490"]) {
      const permanent = factByTerm(id, "complainant", FACT_TERMS.permanentAddress);
      const current = factByTerm(id, "complainant", FACT_TERMS.currentAddress);
      assert.ok(permanent?.value && current?.value);
      assert.notEqual(permanent.value, current.value, id);
    }
  });
});

describe("documents", () => {
  it("carries a key, a label, a state and a page shape, and nothing else", () => {
    /* No filename, no page count, no size. `StoredFileRef` holds a name and a size on
       the *filer's* side; nothing on the court side holds any of them, and nothing
       anywhere holds a page count — so all three were fixtures wearing a field's
       clothes. A plausible fixture is worse than no field.

       `key` joined them on 2026-09-11 and is **not** one of those: it is the slot's own
       identity, which `CASE_SLOTS` already declared and the file was throwing away. Three
       things now name one document — a deep link, a fact's source, and the pane's tab set
       (brief D26, D27) — and all three used to match by label, which is ambiguous by
       construction. */
    for (const complaint of REGISTER_QUEUE) {
      const docs = groups(complaint.id).flatMap((group) => [
        ...(group.documents ?? []),
        ...(group.records ?? []).flatMap((record) => record.documents ?? []),
      ]);
      assert.ok(docs.length > 0, `${complaint.id} lists no documents at all`);
      for (const doc of docs) {
        assert.deepEqual(
          Object.keys(doc).sort(),
          ["key", "kind", "label", "state"],
          `${complaint.id}: ${doc.label} carries a field no store holds`,
        );
        assert.ok(doc.label.length > 0);
        assert.ok(doc.state === "filed" || doc.state === "absent");
        assert.ok(
          caseSlotFor(doc.key),
          `${complaint.id}: "${doc.key}" is not a slot this model declares`,
        );
      }
    }
  });

  it("keys every document on a file uniquely", () => {
    /* What the key is for. A pane tab, a deep link and a fact's source all select by it,
       so two documents sharing one would make every one of those ambiguous — and the
       labels, which is what they used to match on, genuinely repeat: both parties file an
       "ID proof" and three advocates file three vakalatnamas. */
    for (const complaint of REGISTER_QUEUE) {
      const keys = groups(complaint.id).flatMap((group) => [
        ...(group.documents ?? []).map((doc) => doc.key),
        ...(group.records ?? []).flatMap((record) =>
          (record.documents ?? []).map((doc) => doc.key),
        ),
      ]);
      assert.equal(
        new Set(keys).size,
        keys.length,
        `${complaint.id} lists a document key twice`,
      );
    }
  });

  it("gives each kind of page its own shape to draw", () => {
    const byLabel = new Map(
      groups("r-1840")
        .flatMap((group) => [
          ...(group.documents ?? []),
          ...(group.records ?? []).flatMap((record) => record.documents ?? []),
        ])
        .map((doc) => [doc.label, doc.kind]),
    );
    assert.equal(byLabel.get("Dishonoured cheque"), "cheque");
    assert.equal(byLabel.get("Cheque return memo"), "memo");
    assert.equal(byLabel.get("Legal demand notice"), "letter");
    assert.equal(byLabel.get("Vakalatnama"), "form");
    assert.equal(byLabel.get("ID proof"), "id");
    assert.equal(byLabel.get("Payment receipt"), "receipt");
  });

  it("calls the advocate's document what REG-14 collects", () => {
    /* A photograph of the **Bar ID card**. It was labelled "ID proof", which the
       handover records is not collected at advocate registration at all. */
    const advocate = groupById("r-1840", "advocates")?.records?.[0];
    const labels = (advocate?.documents ?? []).map((doc) => doc.label);
    assert.deepEqual(labels, ["Bar ID card", "Vakalatnama"]);
  });
});

describe("the case bundle", () => {
  it("numbers every filed document once, in order, and lists the rest as not filed", () => {
    for (const complaint of REGISTER_QUEUE) {
      const file = review(complaint.id);
      const bundle = caseBundleFor(file);
      const mentioned = file.sections
        .flatMap((section) => section.groups)
        .flatMap((group) => [
          ...(group.records ?? []).flatMap((record) => record.documents ?? []),
          ...(group.documents ?? []),
        ]);
      assert.equal(bundle.docs.length + bundle.absent.length, mentioned.length, complaint.id);
      assert.deepEqual(
        bundle.docs.map((document) => document.no),
        bundle.docs.map((_, index) => index + 1),
        complaint.id,
      );
      assert.ok(bundle.docs.every((document) => document.state === "filed"), complaint.id);
      assert.ok(bundle.absent.every((document) => document.state === "absent"), complaint.id);
    }
  });

  it("tells two documents of the same name apart by whose they are", () => {
    const titles = caseBundleFor(review("r-1840")).docs.map((document) => document.title);
    assert.ok(titles.includes("ID proof — Complainant"), titles.join(" | "));
    assert.ok(titles.includes("ID proof — Accused"), titles.join(" | "));
    assert.equal(new Set(titles).size, titles.length, "two documents share a title");
  });

  it("resolves every particular's source to a document the bundle holds or lists as missing", () => {
    for (const complaint of REGISTER_QUEUE) {
      const file = review(complaint.id);
      const bundle = caseBundleFor(file);
      const keys = new Set([...bundle.docs, ...bundle.absent].map((document) => document.key));
      const facts = file.sections
        .flatMap((section) => section.groups)
        .flatMap((group) => [
          ...(group.facts ?? []),
          ...(group.records ?? []).flatMap((record) => record.facts),
        ]);
      for (const fact of facts) {
        if (fact.source) assert.ok(keys.has(fact.source), `${complaint.id}: ${fact.term} ← ${fact.source}`);
      }
    }
  });
});

/**
 * The case file's order and chunks (brief §0, D34–D35). The order is the e-filing's, and
 * every particular of a chunked group lands in a named chunk — none falls through to the
 * untitled remainder, which exists only so a new field is shown rather than lost.
 */
describe("the case file's order and chunks", () => {
  it("lists every group once, complainant first, in the e-filing's order", () => {
    for (const complaint of REGISTER_QUEUE) {
      const file = review(complaint.id);
      const ids = caseFileGroups(file).map((group) => group.id);
      const all = file.sections.flatMap((section) => section.groups.map((group) => group.id));
      assert.deepEqual([...ids].sort(), [...all].sort(), complaint.id);
      assert.equal(ids[0], "complainant", complaint.id);
      const ranked = ids.filter((id) => CASE_FILE_ORDER.includes(id));
      assert.deepEqual(
        ranked,
        CASE_FILE_ORDER.filter((id) => ids.includes(id)),
        complaint.id,
      );
    }
  });

  it("puts every particular of a chunked group in a named chunk", () => {
    for (const complaint of REGISTER_QUEUE) {
      for (const group of caseFileGroups(review(complaint.id))) {
        if (!CASE_FILE_CHUNKS[group.id]) continue;
        const runs = [
          ...(group.records ?? []).map((record) => record.facts),
          group.facts ?? [],
        ];
        for (const facts of runs) {
          const chunks = chunkFacts(group.id, facts.map((fact) => ({ fact })));
          const untitled = chunks.flatMap((chunk) =>
            chunk.kind === "list" && !chunk.title ? chunk.items : [],
          );
          assert.deepEqual(
            untitled.map((item) => item.fact.term),
            [],
            `${complaint.id} ${group.id}: a particular with no chunk`,
          );
          const shown = chunks.reduce(
            (sum, chunk) =>
              sum +
              (chunk.kind === "list"
                ? chunk.items.length
                : chunk.rows.reduce((cells, row) => cells + row.cells.filter(Boolean).length, 0)),
            0,
          );
          assert.equal(shown, facts.length, `${complaint.id} ${group.id}: a particular dropped`);
        }
      }
    }
  });

  it("reads the two banks as one comparison, a column each", () => {
    const cheque = caseFileGroups(review("r-1840")).find((group) => group.id === "cheque");
    assert.ok(cheque?.records?.[0]);
    const chunks = chunkFacts("cheque", cheque.records[0].facts.map((fact) => ({ fact })));
    const banks = chunks.find((chunk) => chunk.kind === "compare");
    assert.ok(banks && banks.kind === "compare");
    assert.deepEqual(banks.columns, ["Payer's bank", "Payee's bank"]);
    assert.ok(banks.rows.every((row) => row.cells.length === 2));
  });

  it("numbers the documents in the file's order, the complainant's first", () => {
    const docs = caseBundleFor(review("r-1840")).docs;
    assert.equal(docs[0].group, "complainant");
    const groupOrder = docs.map((doc) => CASE_FILE_ORDER.indexOf(doc.group));
    assert.deepEqual(groupOrder, [...groupOrder].sort((a, b) => a - b));
  });
});
