import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applicationStepFor,
  canSeeApplication,
  objectionDeadline,
  objectionInvitations,
  resolveApplicationViewer,
  type ApplicationViewer,
  type ViewerProfile,
} from "./application-access";
import { applicationsRegister } from "./application-record";
import { EMPTY_APPLICATION_DRAFT, validateApplication } from "./application-draft";
import {
  applicationsFile,
  quotedOthersTitle,
  type ApplicationsFile,
} from "./applications";
import { FIXTURE_TODAY } from "./fixtures";
import { findCaseRecord } from "./party-cases";
import { isViewer, viewerRepresentation } from "./viewer";

function fileFor(caseId: string): ApplicationsFile {
  const record = findCaseRecord(caseId);
  assert.ok(record, `fixture ${caseId}`);
  return applicationsFile(record);
}

function viewerFor(caseId: string, profile: ViewerProfile): ApplicationViewer {
  const record = findCaseRecord(caseId)!;
  const viewer = resolveApplicationViewer({
    file: applicationsFile(record),
    profile,
    accountName: "Anjali Nair",
    isSignedInAdvocate: isViewer,
    fallbackSide: viewerRepresentation(record)[0] ?? "complainant",
  });
  assert.ok(viewer, `${profile} on ${caseId}`);
  return viewer;
}

function visibleIds(caseId: string, profile: ViewerProfile): Set<string> {
  const file = fileFor(caseId);
  const viewer = viewerFor(caseId, profile);
  return new Set(
    file.submissions
      .filter((item) => canSeeApplication(viewer, item, file))
      .map((item) => item.id)
  );
}

function stepOf(caseId: string, profile: ViewerProfile, id: string) {
  const file = fileFor(caseId);
  const submission = file.submissions.find((item) => item.id === id);
  assert.ok(submission, id);
  return applicationStepFor(viewerFor(caseId, profile), submission, file);
}

describe("who the viewer is", () => {
  it("seats each profile on the featured case", () => {
    assert.equal(viewerFor("c-1001", "advocate").personId, "ADV-C-000");
    assert.equal(viewerFor("c-1001", "clerk").personId, "CLK-C-000");
  });

  it("seats the litigant profile by role on their own cases", () => {
    assert.equal(viewerFor("lt-2201", "litigant").role, "pip");
    assert.equal(viewerFor("lt-2202", "litigant").role, "litigant");
    const poa = viewerFor("lt-2203", "litigant");
    assert.equal(poa.role, "poa-holder");
    assert.equal(poa.partyId, "lt-2203-complainant");
  });

  it("is nobody on a case the account is not a party to", () => {
    const record = findCaseRecord("c-1001")!;
    const viewer = resolveApplicationViewer({
      file: applicationsFile(record),
      profile: "litigant",
      accountName: "Anjali Nair",
      isSignedInAdvocate: isViewer,
      fallbackSide: "complainant",
    });
    assert.equal(viewer, null);
  });
});

describe("visibility (ALC-17, Users and actions)", () => {
  it("hides the other side's application until the court onboards it", () => {
    const seen = visibleIds("c-1001", "advocate");
    assert.ok(!seen.has("sub-1001-accused-review"), "pending review");
    assert.ok(seen.has("sub-1001-accused-advance"), "pending decision");
    assert.ok(seen.has("sub-1001-bail"), "accepted");
  });

  it("never shows the other side a dismissed application", () => {
    assert.ok(!visibleIds("c-1001", "advocate").has("sub-1001-accused-dismissed"));
  });

  it("shows the other side's filed objection", () => {
    assert.ok(visibleIds("c-1001", "advocate").has("sub-1001-objection"));
  });

  it("keeps drafts inside the office preparing them", () => {
    const seen = visibleIds("c-1001", "advocate");
    assert.ok(seen.has("sub-1001-clerk-draft"), "the clerk's draft");
    assert.ok(!seen.has("sub-1001-cocounsel-draft"), "co-counsel's office");
    assert.ok(!seen.has("sub-1001-settlement-draft"), "the other side");
  });

  it("shows a litigant only what waits on their payment before submission", () => {
    const seen = visibleIds("lt-2202", "litigant");
    assert.ok(seen.has("sub-lt-2202-pay"));
    assert.ok(!seen.has("sub-lt-2202-draft"));
    assert.ok(!seen.has("sub-lt-2202-sign"));
    assert.ok(seen.has("sub-lt-2202-review"), "submitted on their side");
    assert.ok(!seen.has("sub-lt-2202-complainant-review"), "other side, not onboarded");
  });
});

describe("the viewer's step", () => {
  it("lets the advocate sign what their clerk drafted", () => {
    assert.equal(
      stepOf("c-1001", "advocate", "sub-1001-memo-signature"),
      "sign"
    );
  });

  it("never lets a clerk sign, but lets them draft and pay", () => {
    assert.equal(stepOf("c-1001", "clerk", "sub-1001-memo-signature"), null);
    assert.equal(stepOf("c-1001", "clerk", "sub-1001-clerk-draft"), "continue");
    assert.equal(stepOf("c-1001", "clerk", "sub-1001-pay"), "pay");
  });

  it("lets a litigant and a PoA holder pay for what is filed for them", () => {
    assert.equal(stepOf("lt-2202", "litigant", "sub-lt-2202-pay"), "pay");
    assert.equal(stepOf("lt-2203", "litigant", "sub-lt-2203-pay"), "pay");
    assert.equal(stepOf("lt-2203", "litigant", "sub-lt-2203-sign"), null);
  });

  it("lets a party in person do every filer step", () => {
    assert.equal(stepOf("lt-2201", "litigant", "sub-lt-2201-draft"), "continue");
    assert.equal(stepOf("lt-2201", "litigant", "sub-lt-2201-sign"), "sign");
    assert.equal(stepOf("lt-2201", "litigant", "sub-lt-2201-pay"), "pay");
  });
});

describe("objections (ALC-11 to ALC-13, ALC-24)", () => {
  it("is due by the end of the day before the decision", () => {
    assert.equal(objectionDeadline("2026-08-21"), "2026-08-20");
    assert.equal(objectionDeadline("2026-09-01"), "2026-08-31");
  });

  it("invites the other side only where objections were asked for", () => {
    const file = fileFor("c-1001");
    const ids = objectionInvitations(
      viewerFor("c-1001", "advocate"),
      file,
      FIXTURE_TODAY
    ).map((item) => item.application.id);
    assert.deepEqual(ids, ["sub-1001-accused-production"]);
  });

  it("gives way once the side has started its one objection", () => {
    const file = fileFor("c-1001");
    const ids = objectionInvitations(
      viewerFor("c-1001", "advocate"),
      file,
      FIXTURE_TODAY
    ).map((item) => item.application.id);
    assert.ok(!ids.includes("sub-1001-accused-advance"));
  });

  it("closes once the deadline has passed", () => {
    const file = fileFor("c-1001");
    assert.deepEqual(
      objectionInvitations(viewerFor("c-1001", "advocate"), file, "2026-08-19"),
      []
    );
  });

  it("reminds a litigant, whose advocate files it", () => {
    const file = fileFor("lt-2202");
    const invitations = objectionInvitations(
      viewerFor("lt-2202", "litigant"),
      file,
      FIXTURE_TODAY
    );
    assert.deepEqual(
      invitations.map((item) => [item.application.id, item.canFile]),
      [["sub-lt-2202-complainant-witness", false]]
    );
  });

  it("lets an advocate file it", () => {
    const file = fileFor("c-1001");
    const invitations = objectionInvitations(
      viewerFor("c-1001", "advocate"),
      file,
      FIXTURE_TODAY
    );
    assert.ok(invitations.length > 0);
    assert.ok(invitations.every((item) => item.canFile));
  });
});

describe("the register", () => {
  it("submits a paid application for review and allots a temporary ID", () => {
    const record = findCaseRecord("c-1001")!;
    const register = applicationsRegister(record, {
      viewer: viewerFor("c-1001", "advocate"),
      today: FIXTURE_TODAY,
      moves: new Map([
        ["sub-1001-pay", { status: "pending-review", submittedOn: FIXTURE_TODAY }],
      ]),
    });
    const paid = register.applications.find((item) => item.id === "sub-1001-pay");
    assert.equal(paid?.status, "pending-review");
    assert.ok(paid?.temporaryId);
    assert.equal(paid?.applicationNumber, undefined);
  });
});

describe("naming an Others application in a sentence", () => {
  it("quotes the filer's own title exactly as typed", () => {
    assert.equal(
      quotedOthersTitle({ type: "application-others", title: "PW-2 recall" }),
      "\u201cPW-2 recall\u201d"
    );
  });

  it("leaves every other type to its type name", () => {
    assert.equal(quotedOthersTitle({ type: "bail", title: "Bail" }), null);
  });

  it("falls back when an Others filing has no title of its own", () => {
    assert.equal(
      quotedOthersTitle({ type: "application-others", title: "Others" }),
      null
    );
    assert.equal(quotedOthersTitle({ type: "application-others", title: " " }), null);
  });
});

describe("temporary IDs allotted in the session", () => {
  it("differ for applications whose ids end alike", () => {
    const record = findCaseRecord("c-1001")!;
    const ids = ["sub-1001-objections-advancement-signature", "sub-1001-memo-signature"];
    const register = applicationsRegister(record, {
      viewer: viewerFor("c-1001", "advocate"),
      today: FIXTURE_TODAY,
      moves: new Map(
        ids.map((id) => [id, { status: "submitted" as const, submittedOn: FIXTURE_TODAY }])
      ),
    });
    const allotted = [...register.applications, ...register.documents]
      .filter((item) => ids.includes(item.id))
      .map((item) => item.temporaryId);
    assert.equal(allotted.length, 2);
    assert.notEqual(allotted[0], allotted[1]);
  });
});

describe("who drafted it", () => {
  it("shows only until the application reaches the court", () => {
    const record = findCaseRecord("c-1001")!;
    const register = applicationsRegister(record, {
      viewer: viewerFor("c-1001", "advocate"),
      today: FIXTURE_TODAY,
    });
    const byId = (id: string) =>
      register.applications.find((item) => item.id === id);
    assert.equal(byId("sub-1001-clerk-draft")?.draftedBy, "Vinod Kumar");
    assert.equal(byId("sub-1001-summon-bank")?.draftedBy, undefined);
  });
});

describe("memos and affidavits", () => {
  it("are documents, not applications", () => {
    const record = findCaseRecord("c-1001")!;
    const register = applicationsRegister(record, {
      viewer: viewerFor("c-1001", "advocate"),
      today: FIXTURE_TODAY,
    });
    assert.ok(
      register.applications.every((item) => item.source.kind === "application")
    );
    const memo = register.documents.find(
      (item) => item.id === "sub-1001-memo-signature"
    );
    assert.equal(memo?.step, "sign");
  });
});

describe("a Generic application's title", () => {
  it("takes the punctuation advocates cite with", () => {
    for (const title of ["Cross-examination of PW-1", "Exemption under S.138", "Return of cheque (original)"]) {
      const errors = validateApplication({
        ...EMPTY_APPLICATION_DRAFT,
        type: "application-others",
        title,
      });
      assert.equal(errors.fields.title, undefined, title);
    }
  });
});

