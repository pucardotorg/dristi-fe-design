/**
 * Sample applications, so both court queues have something in them on a fresh browser.
 *
 * Every one is built by running the real lifecycle steps (`lifecycle.ts`) on a real
 * fixture case, dated relative to today — so the due dates, numbers, objection deadlines
 * and set-a-date history are exactly what filing them by hand would have produced.
 * Applications filed through the advocate side add to these. "Reset sandbox data"
 * (`resetApplications`) brings the samples back.
 */
import {
  EMPTY_APPLICATION_DRAFT,
  applicationDetailsFromPlain,
  type ApplicationDraft,
} from "@/lib/cases/application-draft";
import { CASES } from "@/lib/cases/fixtures";
import { formatCaseDate } from "@/lib/cases/types";
import { applicationTypeGuide } from "@/lib/cases/application-type-guide";
import type { ApplicationTypeId } from "@/lib/cases/applications";

import { encodeDraft } from "./form-codec";
import {
  addDays,
  onboard,
  pay,
  proceedToSign,
  setReviewDate,
  sign,
  type LifecycleApplication,
  type Side,
} from "./lifecycle";
import { advocateFor } from "./seat-names";

type Counters = { temporary: number; number: number; order: number };

type Sample = {
  caseId: string;
  side: Side;
  type: ApplicationTypeId;
  form: Partial<ApplicationDraft>;
  filedDaysAgo: number;
  /** Set a date once, this many days ahead of today (0: it is back today). */
  reviewAgainIn?: number;
  onboard?: {
    daysAgo: number;
    /** Omit to decide "now". */
    decideIn?: number;
    invite?: boolean;
    objection?: string;
  };
};

const SAMPLES: Sample[] = [
  /* Onboard applications */
  {
    caseId: "c-1001",
    side: "complainant",
    type: "postpone",
    filedDaysAgo: 1,
    form: {
      rescheduleReason: "Illness",
      applicationDetails: applicationDetailsFromPlain(
        "The complainant is admitted in hospital and cannot depose.",
      ),
    },
  },
  {
    caseId: "c-1003",
    side: "complainant",
    type: "condonation-of-delay",
    filedDaysAgo: 4,
    form: {
      applicationDetails: applicationDetailsFromPlain("The demand notice was returned unclaimed and the complainant learnt of it only after the period had run."),
    },
  },
  {
    caseId: "c-1004",
    side: "accused",
    type: "application-others",
    filedDaysAgo: 6,
    reviewAgainIn: 4,
    form: {
      title: "Exemption from personal appearance",
      applicationDetails: applicationDetailsFromPlain("The accused is the managing partner and is travelling abroad on business until the end of the month."),
    },
  },
  /* Decide on applications */
  {
    caseId: "c-1002",
    side: "complainant",
    type: "settlement",
    filedDaysAgo: 5,
    onboard: {
      daysAgo: 3,
      decideIn: 7,
      invite: true,
      objection:
        "No settlement has been reached. The accused has not agreed to the instalments the complainant describes.",
    },
    form: {
      applicationDetails: applicationDetailsFromPlain("The parties have agreed to settle the cheque amount in three instalments."),
    },
  },
  {
    caseId: "c-1005",
    side: "complainant",
    type: "withdrawal",
    filedDaysAgo: 3,
    onboard: { daysAgo: 2 },
    form: {
      applicationDetails: applicationDetailsFromPlain("The cheque amount has been paid in full."),
    },
  },
  {
    caseId: "c-1006",
    side: "accused",
    type: "production-of-documents",
    filedDaysAgo: 8,
    onboard: { daysAgo: 5, decideIn: 2, invite: true },
    form: {
      applicationDetails: applicationDetailsFromPlain("The bank's statement of account for the period is needed to show the cheque was issued as security."),
    },
  },
  /*
   * More of each, so every option on the workstation can be tried (owner, 2026-10-15).
   * Appended, so the six above keep their ids.
   */
  /* To onboard: due today, a bail application from the accused. */
  {
    caseId: "c-1007",
    side: "accused",
    type: "bail",
    filedDaysAgo: 1,
    form: {
      bailType: "surety",
      bailAmount: "50000",
      suretyCount: "1",
      applicationDetails: applicationDetailsFromPlain("The accused has appeared on every date, has a fixed address in the city and undertakes to attend each hearing."),
    },
  },
  /* To onboard: overdue, an Advance — accepting it moves the hearing. */
  {
    caseId: "c-1008",
    side: "complainant",
    type: "advancement-reschedule",
    filedDaysAgo: 3,
    form: {
      rescheduleReason: "A party or witness cannot attend",
      applicationDetails: applicationDetailsFromPlain("The complainant's only witness leaves the country next month and asks for an earlier date to depose."),
    },
  },
  /* To onboard: back after one deferral, so deferring again warns. */
  {
    caseId: "c-1009",
    side: "complainant",
    type: "addition-of-witness",
    filedDaysAgo: 5,
    reviewAgainIn: 0,
    form: {
      applicationDetails: applicationDetailsFromPlain("The bank manager who returned the cheque is to be added as a witness for the complainant."),
    },
  },
  /* To onboard: due today, from the accused. */
  {
    caseId: "c-1010",
    side: "accused",
    type: "reopen-evidence",
    filedDaysAgo: 1,
    form: {
      applicationDetails: applicationDetailsFromPlain("A letter from the complainant acknowledging part payment was found after the evidence closed."),
    },
  },
  /* To onboard: a PoA change, filed two days ago. */
  {
    caseId: "c-1011",
    side: "complainant",
    type: "poa-change",
    filedDaysAgo: 2,
    form: {
      applicationDetails: applicationDetailsFromPlain("The earlier power of attorney holder has resigned from the complainant company."),
    },
  },
  /* To decide: a Postpone listed for today, no objection received — accepting it needs
     the next hearing date. */
  {
    caseId: "c-1012",
    side: "complainant",
    type: "postpone",
    filedDaysAgo: 6,
    onboard: { daysAgo: 4, decideIn: 0, invite: true },
    form: {
      rescheduleReason: "Advocate unavailable",
      applicationDetails: applicationDetailsFromPlain("The complainant's counsel is appearing before the High Court on that date."),
    },
  },
  /* To decide: taken up today, so it can still be listed for a date instead. */
  {
    caseId: "c-1013",
    side: "accused",
    type: "application-others",
    filedDaysAgo: 2,
    onboard: { daysAgo: 0 },
    form: {
      title: "Return of seized documents",
      applicationDetails: applicationDetailsFromPlain("The accused's original partnership deed, produced at the first hearing, is needed for a bank audit."),
    },
  },
  /* To decide: overdue, with an objection from the other side. */
  {
    caseId: "c-1014",
    side: "accused",
    type: "advancement-reschedule",
    filedDaysAgo: 9,
    onboard: {
      daysAgo: 7,
      decideIn: -1,
      invite: true,
      objection:
        "The complainant's witness is not available before the date already fixed, and an earlier date would prejudice the complainant.",
    },
    form: {
      rescheduleReason: "Other",
      applicationDetails: applicationDetailsFromPlain("The accused seeks an earlier date to close the matter before relocating."),
    },
  },
];

export function sampleApplications(
  today: string,
  counters: Counters,
): Record<string, LifecycleApplication> {
  const apps: Record<string, LifecycleApplication> = {};
  SAMPLES.forEach((sample, index) => {
    const record = CASES.find((item) => item.id === sample.caseId);
    if (!record) return;
    const filedOn = addDays(today, -sample.filedDaysAgo);
    const advocate = advocateFor(record, sample.side);
    const seat = { side: sample.side, role: "advocate" as const };
    const typeLabel = applicationTypeGuide(sample.type).label;
    const draft: ApplicationDraft = {
      ...EMPTY_APPLICATION_DRAFT,
      type: sample.type,
      filedForSide: sample.side,
      ...sample.form,
    };
    let app: LifecycleApplication = {
      id: `app-sample-${index + 1}`,
      caseId: record.id,
      type: sample.type,
      typeLabel,
      side: sample.side,
      status: "draft",
      createdBy: "advocate",
      createdByName: advocate,
      onBehalfOf: record.parties[sample.side],
      createdOn: filedOn,
      updatedOn: filedOn,
      form: encodeDraft(draft),
      documents: [],
      history: [{ on: filedOn, text: "Draft started" }],
    };
    app = proceedToSign(app, filedOn);
    app = sign(app, seat, advocate, filedOn);
    counters.temporary += 1;
    app = pay(app, seat, `${record.caseNumber}-AP${counters.temporary}`, filedOn);
    if (sample.reviewAgainIn !== undefined) {
      app = setReviewDate(
        app,
        "magistrate",
        addDays(today, sample.reviewAgainIn),
        addDays(filedOn, 1),
      );
    }
    if (sample.onboard) {
      const on = addDays(today, -sample.onboard.daysAgo);
      counters.number += 1;
      app = onboard(
        app,
        "magistrate",
        `CMP/${counters.number}/${on.slice(0, 4)}`,
        sample.onboard.decideIn === undefined
          ? { mode: "now" }
          : {
              mode: "date",
              decideOn: addDays(today, sample.onboard.decideIn),
              inviteObjections: Boolean(sample.onboard.invite),
            },
        on,
      );
      /* Onboarding is an order (owner, 2026-10-21): the sample carries the one that
         onboarded it, so its previous order can be read. Sample words, not a template. */
      counters.order += 1;
      const decideOn = app.decide?.mode === "date" ? app.decide.dueOn : undefined;
      const other = sample.side === "complainant" ? "accused" : "complainant";
      app = {
        ...app,
        orders: [
          {
            key: `sample:${app.id}`,
            id: `ORD-${counters.order}`,
            title: "Onboarding of application",
            text: [
              `The application for ${typeLabel.toLowerCase()} filed on behalf of the ${sample.side} is taken on file as ${app.applicationNumber}.`,
              decideOn
                ? `It shall be listed on ${formatCaseDate(decideOn)}.${
                    app.objectionsInvited && app.objectionDueBy
                      ? ` The ${other} may file objections, if any, by ${formatCaseDate(app.objectionDueBy)}.`
                      : ""
                  }`
                : "It is taken up for decision today.",
            ].join(" "),
            signedOn: on,
            summary: decideOn
              ? `Onboarded as ${app.applicationNumber}; listed for ${formatCaseDate(decideOn)}`
              : `Onboarded as ${app.applicationNumber}; to be decided today`,
          },
        ],
      };
      if (sample.onboard.objection) {
        const otherSide: Side = sample.side === "complainant" ? "accused" : "complainant";
        const objectionAdvocate = advocateFor(record, otherSide);
        const objectionSeat = { side: otherSide, role: "advocate" as const };
        let objection: LifecycleApplication = {
          id: `${app.id}-objection`,
          caseId: record.id,
          type: "objection",
          typeLabel: "Objection",
          side: otherSide,
          status: "draft",
          createdBy: "advocate",
          createdByName: objectionAdvocate,
          onBehalfOf: record.parties[otherSide],
          createdOn: on,
          updatedOn: on,
          objectionToId: app.id,
          form: encodeDraft({
            ...EMPTY_APPLICATION_DRAFT,
            type: "objection",
            filedForSide: otherSide,
            applicationDetails: applicationDetailsFromPlain(sample.onboard.objection),
          }),
          documents: [],
          history: [{ on, text: "Draft started" }],
        };
        objection = proceedToSign(objection, on);
        objection = sign(objection, objectionSeat, objectionAdvocate, on);
        counters.temporary += 1;
        objection = pay(
          objection,
          objectionSeat,
          `${record.caseNumber}-AP${counters.temporary}`,
          on,
        );
        apps[objection.id] = objection;
        app = {
          ...app,
          objectionId: objection.id,
          history: [...app.history, { on, text: "Objection filed" }],
        };
      }
    }
    apps[app.id] = app;
  });
  return apps;
}
