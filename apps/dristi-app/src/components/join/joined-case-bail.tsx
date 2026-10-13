"use client";

import { RaiseApplicationForm } from "@/components/cases/raise-application-form";
import { useProfile } from "@/components/shell/profile";
import type { ApplicationViewer } from "@/lib/cases/application-access";
import type { CaseRecord } from "@/lib/cases/types";
import type { JoinCase } from "@/lib/join/content";

/**
 * The joined case as the application form needs it. Nothing about a case
 * joined a moment ago is in this browser's case list yet, so it is built from
 * what the join looked up: the cause title, the court, and the person who
 * just joined on the accused side.
 */
function joinedCaseRecord(
  joinCase: JoinCase,
  accused: string,
  advocate?: string
): CaseRecord {
  const filed = /^(\d{2})-(\d{2})-(\d{4})$/.exec(joinCase.filingDate);
  const filedOn = filed ? `${filed[3]}-${filed[2]}-${filed[1]}` : "";
  const complainantAdvocate =
    joinCase.complainantAdvocate && joinCase.complainantAdvocate !== "Not available"
      ? [joinCase.complainantAdvocate]
      : undefined;
  return {
    id: `joined-${joinCase.cnr}`,
    caseNumber: joinCase.caseNumber,
    parties: { complainant: joinCase.complainant, accused },
    counsel: {
      ...(complainantAdvocate ? { complainant: complainantAdvocate } : {}),
      ...(advocate ? { accused: [advocate] } : {}),
    },
    court: joinCase.court,
    filedOn,
    updatedOn: filedOn,
    latestUpdate: "",
    stage: "appearance",
    longPending: false,
    bookmarked: false,
  };
}

/**
 * File bail application, the next step offered once someone has joined a
 * case on the accused side: the Raise application form, opened over the
 * page at Bail's fields, for the case just joined.
 *
 * `as` is who files it: the advocate who just joined for the accused, or the
 * accused themselves as a party in person.
 */
export function JoinedCaseBail({
  joinCase,
  accused,
  as,
  onClose,
  onViewCase,
}: {
  joinCase: JoinCase;
  /** The accused it is filed for, as the case names them. */
  accused: string[];
  as: "advocate" | "pip";
  onClose: () => void;
  /** Where the filing ends: the case just joined, when it has a page. */
  onViewCase?: () => void;
}) {
  const { accountName } = useProfile();
  const advocate =
    as === "advocate"
      ? /^adv\.?\s/i.test(accountName)
        ? accountName
        : `Adv. ${accountName}`
      : undefined;
  const record = joinedCaseRecord(joinCase, accused.join(", "), advocate);
  /* Ids as the case's applications file builds them (`peopleFrom`). */
  const filer: ApplicationViewer =
    as === "advocate"
      ? { role: "advocate", side: "accused", personId: `${record.id}-counsel-a-0` }
      : {
          role: "pip",
          side: "accused",
          personId: `${record.id}-accused`,
          partyId: `${record.id}-accused`,
        };

  return (
    <RaiseApplicationForm
      record={record}
      initialType="bail"
      filer={filer}
      inPlace={{
        onClose,
        done: onViewCase ? { label: "View case", onClick: onViewCase } : undefined,
      }}
    />
  );
}
