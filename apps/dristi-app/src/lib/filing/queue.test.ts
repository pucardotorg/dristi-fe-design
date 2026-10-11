import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { createBlankDraft } from "./blank";
import { setSigningRules } from "./config";
import { addDays } from "./format";
import {
  applyQueueFilters,
  defaultSortFor,
  draftClock,
  draftRows,
  NO_DEADLINE,
  pageWindow,
  pendingPaymentRows,
  pendingSignatureRows,
  registeredRows,
  scrutinyRows,
  sortOptionFor,
  TAB_LAYOUT,
  TAB_SORTS,
  type QueueRow,
} from "./queue";
import { signatories } from "./selectors";
import type { FilingDraft } from "./types";

const TODAY = "2026-08-31";

/**
 * A draft whose cause of action is `daysAgo` days before `today`, with the filing date
 * pinned so the clock is deterministic. The complaint is due one month (30 days) after
 * the cause of action — NI Act §142(1)(b).
 */
function draftAt(daysAgo: number, today = TODAY): FilingDraft {
  const draft = createBlankDraft("d1");
  draft.jurisdiction.causeDate = addDays(today, -daysAgo);
  draft.jurisdiction.filingDate = today;
  return draft;
}

const DATE = /^\d{2}\/\d{2}\/\d{4}$/;

describe("draftClock — the File by column", () => {
  it("says NA, and why, when no cause of action is known", () => {
    const clock = draftClock(createBlankDraft("d1"));
    assert.equal(clock.lead, NO_DEADLINE);
    assert.equal(clock.tone, "default");
    assert.equal(clock.dueOn, "");
    assert.match(clock.sub ?? "", /notice dates/i);
  });

  it("leads with the date and counts down under it while in time", () => {
    const clock = draftClock(draftAt(10));
    assert.match(clock.lead, DATE);
    assert.match(clock.sub ?? "", /^20 days left$/);
    assert.equal(clock.tone, "default");
  });

  it("stays in plain ink until the last two days", () => {
    assert.equal(draftClock(draftAt(25)).tone, "default");
    assert.equal(draftClock(draftAt(27)).tone, "default");
    const clock = draftClock(draftAt(28));
    assert.match(clock.sub ?? "", /^2 days left$/);
    assert.equal(clock.tone, "warning");
  });

  it("singularises the last day", () => {
    assert.match(draftClock(draftAt(29)).sub ?? "", /^1 day left$/);
  });

  it("on the final day it is due today — still in time, not late", () => {
    const clock = draftClock(draftAt(30));
    assert.match(clock.lead, DATE);
    assert.equal(clock.sub, "Due today");
    assert.equal(clock.tone, "warning");
  });

  it("past the window it keeps the date and names condonation — never 'overdue' or 'barred'", () => {
    const clock = draftClock(draftAt(45));
    assert.match(clock.lead, DATE);
    assert.equal(clock.sub, "Delay condonation applicable");
    assert.equal(clock.tone, "danger");
    const words = `${clock.lead} ${clock.sub}`.toLowerCase();
    for (const banned of ["overdue", "barred", "time-barred", "expired"]) {
      assert.equal(words.includes(banned), false, `must not say "${banned}"`);
    }
  });

  it("derives the cause date from a served notice when none was typed", () => {
    const draft = createBlankDraft("d1");
    draft.jurisdiction.filingDate = "2026-08-30";
    // Served 1 Aug → the drawer's 15 days end 16 Aug → due 15 Sep.
    draft.notices[0].delivered = "yes";
    draft.notices[0].deliveryDate = "2026-08-01";
    assert.equal(draftClock(draft).lead, "15/09/2026");
  });

  it("carries the last-saved date and the case type", () => {
    const [row] = draftRows([draftAt(5)]);
    assert.ok(row.progress, "a draft row carries its save date");
    assert.match(row.progress.savedOn, DATE);
    assert.equal(row.caseType, "S138 of NIA");
    assert.doesNotMatch(row.info.lead, /% complete/);
  });

  it("sends a PSA draft to the placeholder, since it has no filing flow yet", () => {
    const [row] = draftRows([{ ...draftAt(5), caseType: "pss25" }]);
    assert.equal(row.caseType, "S25 of PSA");
    assert.equal(row.action.href, "/filings/new/pss-act");
  });
});

describe("each tab has its own order, and the default is the useful one", () => {
  it("registered opens on the next hearing, not the furthest one", () => {
    const rows = registeredRows(TODAY);
    const sorted = applyQueueFilters(rows, {
      q: "",
      court: "",
      sort: sortOptionFor("registered", defaultSortFor("registered")),
    });
    const upcoming = sorted.filter((r) => r.urgencyAt !== "9999-12-31");
    assert.ok(upcoming.length > 0, "fixtures should hold at least one upcoming hearing");
    // Ascending, and every dated row still to come sits above every past/unlisted one.
    for (let i = 1; i < upcoming.length; i++) {
      assert.ok(upcoming[i - 1].urgencyAt <= upcoming[i].urgencyAt);
    }
    assert.equal(sorted[0].urgencyAt, upcoming[0].urgencyAt);
    assert.ok(sorted[0].urgencyAt >= TODAY, "the top row must not be a date already heard");
  });

  it("a hearing that has passed is not called the next hearing", () => {
    const past = registeredRows(TODAY).filter(
      (r) => r.urgencyAt === "9999-12-31" && r.info.lead !== "Awaiting listing"
    );
    assert.ok(past.length > 0, "fixtures should hold at least one past listing");
    for (const row of past) assert.equal(row.info.sub, "Last listed. No new date yet");
  });

  it("drafts lead with the tightest deadline", () => {
    const comfortable = draftAt(5);
    comfortable.id = "a";
    const tight = draftAt(28);
    tight.id = "b";
    const none = createBlankDraft("c");
    const sorted = applyQueueFilters(draftRows([comfortable, none, tight]), {
      q: "",
      court: "",
      sort: sortOptionFor("drafts", defaultSortFor("drafts")),
    });
    assert.deepEqual(
      sorted.map((r) => r.id),
      ["b", "a", "c"],
      "tightest deadline first; a draft with no clock sorts last"
    );
  });

  it("scrutiny leads with the one waiting longest", () => {
    const sorted = applyQueueFilters(scrutinyRows(TODAY), {
      q: "",
      court: "",
      sort: sortOptionFor("scrutiny", defaultSortFor("scrutiny")),
    });
    for (let i = 1; i < sorted.length; i++) {
      assert.ok(sorted[i - 1].urgencyAt <= sorted[i].urgencyAt);
    }
  });

  it("every tab's default is its first option, and no two tabs share a label set", () => {
    for (const [tab, options] of Object.entries(TAB_SORTS)) {
      assert.equal(defaultSortFor(tab as never), options[0].value);
      assert.ok(options.length >= 2, `${tab} needs a second order to be worth a control`);
    }
    // "Newest first" is the label that caused the defect — it must not come back.
    const labels = Object.values(TAB_SORTS).flatMap((o) => o.map((s) => s.label));
    assert.equal(labels.includes("Newest first"), false);
  });

  it("an unknown sort in the URL falls back to the tab's default", () => {
    assert.equal(sortOptionFor("registered", "nonsense").value, defaultSortFor("registered"));
    assert.equal(sortOptionFor("registered", null).value, defaultSortFor("registered"));
    // A sort that belongs to another tab is not silently accepted either.
    assert.equal(sortOptionFor("drafts", "hearing").value, defaultSortFor("drafts"));
  });
});

describe("pendingSignatureRows and pendingPaymentRows — where a draft goes once drafting is done", () => {
  // Checked under Gujarat's rules, where everyone signs and swears (`config.ts`).
  before(() => setSigningRules({ oath: true, everyAdvocate: true }));
  after(() => setSigningRules({ oath: false, everyAdvocate: false }));
  function sentForSignature(id: string): FilingDraft {
    const draft = createBlankDraft(id);
    draft.sign.requestedAt = "2026-08-20T10:00:00.000Z";
    return draft;
  }

  it("a draft still drafting appears on neither tab", () => {
    const draft = createBlankDraft("d1");
    assert.equal(draftRows([draft]).length, 1);
    assert.equal(pendingSignatureRows([draft], null).length, 0);
    assert.equal(pendingPaymentRows([draft], null).length, 0);
  });

  it("sending it for signature moves it off Drafts and onto Pending signature", () => {
    const draft = sentForSignature("d1");
    assert.equal(draftRows([draft]).length, 0);
    const [row] = pendingSignatureRows([draft], null);
    assert.ok(row, "expected a pending-signature row");
    assert.ok((row.count ?? 0) > 0, "nobody has signed yet");
    assert.equal(pendingPaymentRows([draft], null).length, 0);
  });

  it("choosing the paper path counts as sent, even though it sets no requestedAt of its own", () => {
    const draft = createBlankDraft("d1");
    draft.sign.mode = "upload";
    assert.equal(draftRows([draft]).length, 0);
    assert.equal(pendingSignatureRows([draft], null).length, 1);
  });

  it("names who it is waiting on, from the filer's own point of view", () => {
    const draft = sentForSignature("d1");
    const everyone = [...signatories(draft, null).complainants, ...signatories(draft, null).advocates];
    const you = everyone.find((s) => s.you);
    assert.ok(you, "a blank draft always resolves a 'you'");

    const [before] = pendingSignatureRows([draft], null);
    assert.equal(before.youPending, true);
    assert.match(before.info.sub ?? "", /waiting on you/i);

    // Sign and swear for "you" — whoever is left, if anyone, is someone else's to give.
    draft.sign.signed[you!.id] = { at: "2026-08-20T10:05:00.000Z", with: "aadhaar" };
    draft.sign.oaths[you!.id] = { at: "2026-08-20T10:06:00.000Z", video: null };
    const after = pendingSignatureRows([draft], null)[0];
    if (after) {
      assert.equal(after.youPending, false);
      assert.doesNotMatch(after.info.sub ?? "", /waiting on you\b/i);
    }
  });

  it("an advocate's row asks for sign and oath together, then the oath alone — never a bulk sign", () => {
    const draft = sentForSignature("d1");
    draft.complainants[0].name = "Zeenath Beevi";
    draft.advocates[0].name = "Anjali Nair";
    draft.advocates[0].barNumber = "K/123/2010";
    const advocate = signatories(draft, null).advocates[0];
    assert.ok(advocate?.you, "with no profile, the advocate slot is 'you'");

    const [before] = pendingSignatureRows([draft], null);
    assert.equal(before.action.label, "Sign and take oath");
    assert.equal(before.youPending, true);

    draft.sign.signed[advocate.id] = { at: "2026-08-20T10:05:00.000Z", with: "aadhaar" };
    const [after] = pendingSignatureRows([draft], null);
    assert.equal(after.action.label, "Take oath");
    assert.equal(after.youPending, false, "an oath is not something a bulk sign can give");
    assert.match(after.info.sub ?? "", /waiting on you/i);
    assert.equal(after.info.tone, "warning");
  });

  it("moves to Pending payment once everyone has signed, and drops off it once paid", () => {
    const draft = sentForSignature("d1");
    const everyone = [...signatories(draft, null).complainants, ...signatories(draft, null).advocates];
    for (const s of everyone) {
      draft.sign.signed[s.id] = { at: "2026-08-20T10:05:00.000Z", with: "aadhaar" };
      draft.sign.oaths[s.id] = { at: "2026-08-20T10:06:00.000Z", video: null };
    }
    assert.equal(pendingSignatureRows([draft], null).length, 0);
    const [row] = pendingPaymentRows([draft], null);
    assert.ok(row, "expected a pending-payment row");
    assert.ok((row.amount ?? 0) > 0);

    draft.sign.paid = true;
    assert.equal(pendingPaymentRows([draft], null).length, 0);
  });
});

describe("columns carry information", () => {
  it("no tab shows a column whose value never changes", () => {
    const sets: Record<string, QueueRow[]> = {
      drafts: draftRows([draftAt(5)]),
      scrutiny: scrutinyRows(TODAY),
      registered: registeredRows(TODAY),
    };
    for (const [tab, rows] of Object.entries(sets)) {
      const layout = TAB_LAYOUT[tab as keyof typeof TAB_LAYOUT];
      if (layout.columns.includes("court")) {
        assert.ok(
          rows.every((r) => r.court),
          `${tab} shows a court column, so every row must have one`
        );
      } else {
        assert.ok(rows.every((r) => !r.court), `${tab} hides court, so none should be set`);
      }
    }
  });

  it("drafts carry no reference number, so the column is not offered", () => {
    assert.equal(TAB_LAYOUT.drafts.columns.includes("ref"), false);
    assert.equal(draftRows([draftAt(5)])[0].ref, undefined);
  });

  it("every tab names the parties; drafts also name the case type (owner, 2026-10-08)", () => {
    for (const layout of Object.values(TAB_LAYOUT)) {
      assert.equal(layout.columns.includes("parties"), true);
    }
    assert.equal(TAB_LAYOUT.drafts.columns.includes("caseType"), true);
  });
});

describe("filters and paging", () => {
  const rows: QueueRow[] = [
    row("a", "JMFC-I", "2026-08-01", "meera nair v. anwar s."),
    row("b", "JMFC-II", "2026-08-20", "suresh menon v. k. menon"),
    row("c", "JMFC-I", "2026-08-10", "latha r. v. riya jacob"),
  ];

  function row(id: string, court: string, at: string, haystack: string): QueueRow {
    return {
      id,
      ref: id.toUpperCase(),
      parties: haystack,
      court,
      info: { lead: "", tone: "default" },
      action: { label: "Open", href: "#" },
      urgencyAt: at,
      recencyAt: at,
      haystack,
    };
  }

  const asc = { value: "x", label: "x", key: "urgencyAt", dir: "asc" } as const;
  const desc = { value: "y", label: "y", key: "recencyAt", dir: "desc" } as const;

  it("sorts both ways on the key it is given", () => {
    assert.deepEqual(
      applyQueueFilters(rows, { q: "", court: "", sort: asc }).map((r) => r.id),
      ["a", "c", "b"]
    );
    assert.deepEqual(
      applyQueueFilters(rows, { q: "", court: "", sort: desc }).map((r) => r.id),
      ["b", "c", "a"]
    );
  });

  it("search and court filter compose", () => {
    const out = applyQueueFilters(rows, { q: "menon", court: "JMFC-II", sort: asc });
    assert.deepEqual(
      out.map((r) => r.id),
      ["b"]
    );
  });

  it("search is case-insensitive and matches either party", () => {
    assert.equal(applyQueueFilters(rows, { q: "ANWAR", court: "", sort: asc }).length, 1);
    assert.equal(applyQueueFilters(rows, { q: "  Riya ", court: "", sort: asc }).length, 1);
  });

  it("page window collapses long runs and always keeps the ends", () => {
    assert.deepEqual(pageWindow(1, 5), [1, 2, 3, 4, 5]);
    assert.deepEqual(pageWindow(5, 16), [1, "gap", 4, 5, 6, "gap", 16]);
    assert.deepEqual(pageWindow(1, 16), [1, 2, "gap", 16]);
  });
});
