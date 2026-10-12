/**
 * Sample applications, so both court queues have something in them on a fresh browser.
 *
 * Every one is built by running the real lifecycle steps (`lifecycle.ts`) on a real
 * fixture case, dated relative to today — so the due dates, numbers, objection deadlines
 * and set-a-date history are exactly what filing them by hand would have produced.
 * Applications filed through the advocate side add to these. "Reset sandbox data"
 * (`resetApplications`) brings the samples back.
 */
import { EMPTY_APPLICATION_DRAFT, type ApplicationDraft } from "@/lib/cases/application-draft";
import { CASES } from "@/lib/cases/fixtures";
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
  /** Set a date once, this many days ahead of today. */
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
      otherDetails: "The complainant is admitted in hospital and cannot depose.",
    },
  },
  {
    caseId: "c-1003",
    side: "complainant",
    type: "condonation-of-delay",
    filedDaysAgo: 4,
    form: {
      delayReason:
        "The demand notice was returned unclaimed and the complainant learnt of it only after the period had run.",
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
      details:
        "The accused is the managing partner and is travelling abroad on business until the end of the month.",
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
      settlementReason: "The parties have agreed to settle the cheque amount in three instalments.",
    },
  },
  {
    caseId: "c-1005",
    side: "complainant",
    type: "withdrawal",
    filedDaysAgo: 3,
    onboard: { daysAgo: 2 },
    form: {
      withdrawalReason: "The cheque amount has been paid in full.",
    },
  },
  {
    caseId: "c-1006",
    side: "accused",
    type: "production-of-documents",
    filedDaysAgo: 8,
    onboard: { daysAgo: 5, decideIn: 2, invite: true },
    form: {
      productionReason:
        "The bank's statement of account for the period is needed to show the cheque was issued as security.",
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
    if (sample.reviewAgainIn) {
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
            objectionReason: sample.onboard.objection,
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
