import { type TableColumnId } from "@/lib/cases/table-columns";
import { CASE_TYPE } from "@/lib/filing/options";
import { counselFor, type CaseRecord } from "@/lib/cases/types";
import { viewerAccess, viewerRepresentation } from "@/lib/cases/viewer";

import { CaseAdvocatesPair } from "./case-advocates";
import {
  CaseDate,
  CaseIdentity,
  CasePlain,
  CaseStage,
  CaseTitle,
} from "./case-identity";

/** Shared field body for the table cell and the stacked list. */
export function CaseField({
  record,
  id,
  presentation,
  hideLongPendingFlag = false,
}: {
  record: CaseRecord;
  id: TableColumnId;
  presentation: "table" | "list";
  /** Drop the "Long pending" badge — set inside the long pending register. */
  hideLongPendingFlag?: boolean;
}) {
  const list = presentation === "list";

  switch (id) {
    case "caseNumber":
      return (
        <CaseIdentity
          record={record}
          tone={list ? "muted" : "default"}
          hideLongPendingFlag={hideLongPendingFlag}
        />
      );
    case "caseName":
      return <CaseTitle record={record} />;
    case "caseType":
      /* Every case on the list is §138 until the record carries its own type
         (`caseTypeOf` in lib/cases/query.ts). */
      return <CasePlain>{CASE_TYPE.label}</CasePlain>;
    case "advocates":
      return <CaseAdvocatesPair record={record} dense={!list} />;
    case "representation": {
      /* Which side the viewer works for — always a side (owner, Sept 2):
         office access itself belongs to one side's team, so the column
         never answers anything but complainant or accused. */
      const sides = viewerRepresentation(record);
      return (
        <CasePlain>
          {sides
            .map((side) => (side === "complainant" ? "Complainant" : "Accused"))
            .join(" · ")}
        </CasePlain>
      );
    }
    case "access": {
      const access = viewerAccess(record);
      return (
        <CasePlain>
          {access.kind === "vakalatnama" ? "Vakalatnama" : "Office access"}
        </CasePlain>
      );
    }
    case "stage":
      /* Badge only in the table (owner, Sept 21, after feedback: the sub
         stage under it was not needed). The stacked list keeps it. */
      return <CaseStage record={record} detail={list} />;
    case "nextHearing":
      return (
        <CaseDate iso={record.nextHearing?.on} emphasize={list} />
      );
    case "hearingPurpose":
      return <CasePlain>{record.nextHearing?.purpose}</CasePlain>;
    case "previousHearing":
      return <CaseDate iso={record.previousHearingOn} />;
    case "latestUpdate":
      return <CasePlain>{record.latestUpdate}</CasePlain>;
  }
}

export function caseFieldIsEmpty(record: CaseRecord, id: TableColumnId): boolean {
  switch (id) {
    case "caseNumber":
    case "caseName":
    case "caseType":
    case "stage":
    case "representation":
    case "access":
      return false;
    case "advocates":
      return (
        counselFor(record, "complainant").length === 0 &&
        counselFor(record, "accused").length === 0
      );
    case "nextHearing":
      return !record.nextHearing?.on;
    case "hearingPurpose":
      return !record.nextHearing?.purpose;
    case "previousHearing":
      return !record.previousHearingOn;
    case "latestUpdate":
      return !record.latestUpdate;
  }
}
