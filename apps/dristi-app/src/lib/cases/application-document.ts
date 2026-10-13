/**
 * The generated application — the court-form document that Generate
 * Application produces, built from the draft and the case record.
 *
 * Laid out as the court's application template (owner, Oct 12): the court
 * heading, then Case No, In the matter of and Date; the parties table, each
 * complainant and accused with their advocate, and the offence; the
 * application's title; its content; the "Dated this" line; and the signature
 * block.
 *
 * The heading is written in Kerala's terms, as every document in this app is,
 * and reaches the reader through the selected court's re-voicing
 * (`useCourtLocalized`), so it names that state's court and seat.
 *
 * The content is, for now, every value the filer entered as a term and its
 * value. Turning those into the application's prose is still to be specified
 * per type; until it is, the document states exactly what was entered and
 * nothing it was not.
 */
import { type ApplicationDraft, type LitigantDetailsDraft } from "./application-draft";
import { applicationsFile, submissionTypeLabel } from "./applications";
import { caseLitigants } from "./application-options";
import { formatCaseDate, type CaseRecord } from "./types";
import type { Address } from "@/lib/filing/types";
import {
  ACCUSED_ENTITY_TYPES,
  ENTITY_TYPES,
  GENDER_OPTIONS,
} from "@/lib/filing/options";
import { localizeForDownload, voicedForDownload } from "@/lib/court/browser";

type Row = { term: string; value: string };

export type GeneratedApplication = {
  /** The court's heading line. */
  court: string;
  caseNumber: string;
  /** Cause title — "In the matter of …". */
  matter: string;
  /** The application type, or a Generic application's own title. */
  title: string;
  /** The litigant it is raised on behalf of. */
  filedFor: string;
  /**
   * The parties table: one group per litigant (their row and their
   * advocate's), then the offence. A gap is drawn between groups.
   */
  parties: Row[][];
  /** The content: every value entered, as term and value. */
  entries: Row[];
  /** Under the signature: "Advocate Signature" and "Advocate for …". */
  signatory: { signature: string; line: string };
  /*
   * The same paper flattened for the court's review screens, which read
   * every queue's applications in one shape (`CourtApplicationDocument`).
   */
  facts: Row[];
  paragraphs: string[];
  prayer: string;
};

/**
 * The court's heading as the template prints it, in Kerala's terms; the
 * selected court's re-voicing names its own court and seat.
 */
export const APPLICATION_COURT_HEADING =
  'Before the Special Court of Judicial Magistrate of the First Class, for the trial of cases under section 138 of NI Act, 1881 at Kollam ("24×7 ON Court")';

export const APPLICATION_OFFENCE = "S.138 of the Negotiable Instruments Act, 1881";

/**
 * The register's dummy pack writes this court long-form — "JMFC-I"
 * appears as "Judicial First Class Magistrate Court-I" in
 * applications-dummy.json — so the expansion is the product's own
 * vocabulary, not an invented one. Unmatched courts pass through as-is.
 */
export function courtLongForm(court: string): string {
  const match = /^JMFC-([IVXLC]+), (.+)$/.exec(court);
  if (!match) return court;
  return `Judicial First Class Magistrate Court-${match[1]}, ${match[2]}`;
}

/** "Dated this 18th day of November 2025", from a date as `formatCaseDate` writes it. */
export function datedThis(display: string): string {
  const match = /^(\d{1,2}) (\S+) (\d{4})$/.exec(display.trim());
  if (!match) return `Dated this ${display}`;
  const day = Number(match[1]);
  const suffix =
    day % 100 >= 11 && day % 100 <= 13
      ? "th"
      : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[day % 10] ?? "th";
  return `Dated this ${day}${suffix} day of ${match[2]} ${match[3]}`;
}

/** A stored value as text — see `add` in `applicationEntries` for why it may not be one. */
function trimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function addressLine(address: Address): string {
  return [address.line1, address.city, address.district, address.state, address.pin]
    .map(trimmed)
    .filter(Boolean)
    .join(", ");
}

function fileNames(files: File[]): string {
  return files.map((file) => file.name).join(", ");
}

function optionLabel(
  options: readonly { value: string; label: string }[],
  value: string
): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

const YES_NO_LABEL: Record<string, string> = { yes: "Yes", no: "No" };

/**
 * Every value entered on the form, in the form's order, as the PRD names
 * each field. A field left empty is left out: the list says what was
 * entered, not what was asked.
 */
export function applicationEntries(
  draft: ApplicationDraft,
  record: CaseRecord
): Row[] {
  const rows: Row[] = [];
  /* The form is read back from storage, so a value is not always the string its type
     says — a draft saved by an older build, or a number. Text and numbers are shown;
     anything else is left out rather than failing the whole document. */
  const add = (term: string, value: unknown) => {
    const text =
      typeof value === "string"
        ? value.trim()
        : typeof value === "number" && Number.isFinite(value)
          ? String(value)
          : "";
    if (text) rows.push({ term, value: text });
  };
  const file = safeFile(record);
  const person = (id: string) =>
    id ? file?.people.find((item) => item.id === id)?.name : undefined;
  const litigants = caseLitigants(record);
  const litigant = (id: string) => litigants.find((item) => item.id === id);

  add("Raised by", person(draft.raisedById));
  add("Litigant", person(draft.litigantId));

  switch (draft.type) {
    case "bail":
      add("Type of bail", draft.bailType === "cash" ? "Cash" : draft.bailType === "surety" ? "Surety" : "");
      add("Bail amount (Rs.)", draft.bailAmount);
      if (draft.bailType === "surety") {
        add("Number of sureties", draft.suretyCount);
        draft.sureties.forEach((surety, index) => {
          const n = `Surety ${index + 1}`;
          add(`${n} — name`, surety.fullName);
          add(`${n} — father's / mother's name`, surety.parentName);
          add(`${n} — phone number`, surety.phone);
          add(`${n} — email ID`, surety.email);
          add(`${n} — address`, addressLine(surety.address));
          add(`${n} — ID proof`, fileNames(surety.identityProof));
          add(`${n} — proof of solvency`, fileNames(surety.solvencyProof));
        });
      }
      add("Reason for bail", draft.bailReason);
      break;

    case "edit-litigant-details": {
      const edited = litigant(draft.editLitigantId);
      add("Litigant to edit", edited?.name);
      add("Reason for editing", draft.editReason);
      add(
        "Litigant type",
        draft.litigantType === "institution"
          ? "Institution"
          : draft.litigantType === "individual"
            ? "Individual"
            : ""
      );
      if (edited) {
        litigantEntries(draft.litigant, edited.side, draft.litigantType === "institution", add);
      }
      break;
    }

    case "settlement":
      add("Reason for settlement", draft.settlementReason);
      break;

    case "transfer":
      add("Current court", record.court);
      add("Requested court", draft.requestedCourt);
      add("Reason for transfer", draft.transferReason);
      break;

    case "withdrawal":
      add("Reason for withdrawal", draft.withdrawalReason);
      break;

    case "condonation-of-delay":
      add("Reasons for delay", draft.delayReason);
      break;

    case "application-others":
      add("Application title", draft.title);
      add("Details", draft.details);
      break;

    case "advancement-reschedule":
    case "postpone":
      add(
        "Initial hearing date",
        record.nextHearing ? formatCaseDate(record.nextHearing.on) : ""
      );
      add("Purpose of hearing", record.nextHearing?.purpose);
      add("Reason for rescheduling", draft.rescheduleReason);
      add(
        "Proposed hearing date",
        draft.proposedHearingDate
          ? formatCaseDate(draft.proposedHearingDate.toISOString())
          : ""
      );
      break;

    case "poa-change":
      add(
        "Litigants appointing the applicant",
        draft.poaLitigantIds
          .map((id) => litigant(id)?.name)
          .filter(Boolean)
          .join(", ")
      );
      for (const id of draft.poaLitigantIds) {
        add(
          `Authorization document — ${litigant(id)?.name ?? id}`,
          fileNames(draft.poaAuthorizations[id] ?? [])
        );
      }
      add("Reason for change", draft.poaReason);
      break;

    case "production-of-documents":
      add("Reason for application", draft.productionReason);
      draft.productionDocuments.forEach((row, index) => {
        add(`Document ${index + 1} — type`, row.type);
        add(`Document ${index + 1} — file`, fileNames(row.files));
      });
      break;

    case "addition-of-witness":
      draft.witnesses.forEach((witness, index) => {
        const n = `Witness ${index + 1}`;
        add(`${n} — full name`, witness.fullName);
        add(`${n} — age`, witness.age);
        add(`${n} — what the witness will prove`, witness.proves);
        add(`${n} — designation`, witness.designation);
        add(`${n} — mobile number`, witness.mobile);
        add(`${n} — email ID`, witness.email);
        witness.addresses.forEach((row, addressIndex) =>
          add(
            witness.addresses.length > 1
              ? `${n} — address ${addressIndex + 1}`
              : `${n} — address`,
            addressLine(row.addr)
          )
        );
      });
      break;

    case "warrant-by-hand":
      add("Accused", litigant(draft.warrantAccusedId)?.name);
      add("Address for delivery", addressLine(draft.deliveryAddress));
      break;

    case "absent-application":
      add("Reason for absence", draft.absenceReason);
      break;

    case "reopen-evidence":
      add("Reason for reopening", draft.reopenReason);
      break;

    case "objection": {
      const target = file?.submissions.find(
        (item) => item.id === draft.objectionToId
      );
      add(
        "Objection to",
        target
          ? [submissionTypeLabel(target.type), target.applicationNumber ?? target.temporaryId]
              .filter(Boolean)
              .join(" · ")
          : ""
      );
      add("Reason for objection", draft.objectionReason);
      break;
    }
  }

  draft.supportingDocuments.forEach((row, index) => {
    add(
      `Supporting document ${index + 1}`,
      [trimmed(row.name), fileNames(row.files)].filter(Boolean).join(" — ")
    );
  });
  add("Other details", draft.otherDetails);
  return rows;
}

/** The Edit Litigant Details fields for the litigant's side and type. */
function litigantEntries(
  l: LitigantDetailsDraft,
  side: "complainant" | "accused",
  institution: boolean,
  add: (term: string, value: string | undefined) => void
) {
  const gender = (value: string) => optionLabel(GENDER_OPTIONS, value);
  if (side === "complainant" && !institution) {
    add("Phone number", l.phone);
    add("Full name", l.fullName);
    add("Age", l.age);
    add("Gender", gender(l.gender));
    add("Differently abled?", YES_NO_LABEL[l.differentlyAbled]);
    add("Email ID", l.email);
    add("Permanent address", addressLine(l.permanentAddress));
    add(
      "Is the current address the same as the permanent address?",
      YES_NO_LABEL[l.currentSameAsPermanent]
    );
    if (l.currentSameAsPermanent === "no") {
      add("Current address", addressLine(l.currentAddress));
    }
    return;
  }
  if (side === "complainant") {
    add("Type of institution", optionLabel(ENTITY_TYPES, l.institutionType));
    add("Institution name", l.institutionName);
    add("CIN or PAN", l.cinPan);
    add("Phone number", l.phone);
    add("Email ID", l.email);
    add("Institution address", addressLine(l.institutionAddress));
    add("Authorised representative phone number", l.repPhone);
    add("Authorised representative full name", l.repName);
    add("Authorised representative age", l.repAge);
    add("Authorised representative gender", gender(l.repGender));
    add("Authorised representative differently abled?", YES_NO_LABEL[l.repDifferentlyAbled]);
    add("Authorised representative email ID", l.repEmail);
    add("Authorised representative designation", l.repDesignation);
    add("Authorised representative address", addressLine(l.repAddress));
    return;
  }
  if (institution) {
    add("Type of institution", optionLabel(ACCUSED_ENTITY_TYPES, l.institutionType));
    add("Institution name", l.institutionName);
  } else {
    add("Full name", l.fullName);
    add("Age", l.age);
    add("Designation", l.designation);
  }
  add("Mobile number", l.phone);
  add("Email ID", l.email);
  l.addresses.forEach((row, index) => {
    const n = l.addresses.length > 1 ? `Address ${index + 1}` : "Address";
    add(n, addressLine(row.addr));
    add(`${n} — police station`, row.police);
  });
}

export function buildGeneratedApplication(
  given: ApplicationDraft,
  record: CaseRecord,
  /** The side filing it, where the draft does not say (the court's task
   *  screens pass it). The draft's own side wins. */
  side?: "complainant" | "accused"
): GeneratedApplication | null {
  const draft =
    side && !given.filedForSide ? { ...given, filedForSide: side } : given;
  if (!draft.type) return null;

  const complainant = record.parties.complainant;
  const accused = record.parties.accused;
  const file = safeFile(record);
  const person = (id: string) =>
    id ? file?.people.find((item) => item.id === id) : undefined;
  /* An objection answers the other side's application, so it is filed for
     whichever side did not raise that one. */
  const objectionTarget =
    draft.type === "objection"
      ? file?.submissions.find((item) => item.id === draft.objectionToId)
      : undefined;
  const targetFiler = objectionTarget
    ? person(objectionTarget.submittedById)
    : undefined;
  const filedFor =
    person(draft.litigantId)?.name ??
    (objectionTarget
      ? targetFiler?.side === "accused"
        ? complainant
        : accused
      : draft.filedForSide
        ? record.parties[draft.filedForSide]
        : draft.type === "bail"
          ? accused
          : complainant);

  /* The parties table: Complainant 1, their advocate; Accused 1, theirs. */
  const litigants = caseLitigants(record);
  const parties: Row[][] = (["complainant", "accused"] as const).flatMap((partySide) =>
    litigants
      .filter((litigant) => litigant.side === partySide)
      .map((litigant, index) => [
        {
          term: `${partySide === "accused" ? "Accused" : "Complainant"} ${index + 1}`,
          value: litigant.name,
        },
        {
          term: "Advocate",
          value: litigant.advocates.length
            ? litigant.advocates.join(", ")
            : litigant.partyInPerson
              ? "Party in person"
              : "",
        },
      ])
  );
  parties.push([{ term: "Offence", value: APPLICATION_OFFENCE }]);

  const title =
    draft.type === "application-others"
      ? trimmed(draft.title) || submissionTypeLabel(draft.type)
      : submissionTypeLabel(draft.type);

  /* A party in person signs as themselves; otherwise the advocate signs. */
  const raiser = person(draft.raisedById);
  const signatory =
    raiser?.kind === "party"
      ? { signature: "Signature", line: `${raiser.name}, party in person` }
      : { signature: "Advocate Signature", line: `Advocate for ${filedFor}` };

  const entries = applicationEntries(draft, record);

  return {
    court: APPLICATION_COURT_HEADING,
    caseNumber: record.caseNumber,
    matter: `${complainant} v. ${accused}`,
    title,
    filedFor,
    parties,
    entries,
    signatory,
    facts: parties.flat().filter((row) => row.value),
    paragraphs: entries.map((row) => `${row.term}: ${row.value}`),
    prayer: "",
  };
}

/** The case's applications file, or none for a case it cannot build one for. */
function safeFile(record: CaseRecord) {
  try {
    return applicationsFile(record);
  } catch {
    return undefined;
  }
}

/**
 * The generated application as plain text, laid out in reading order.
 *
 * Composed locally from the draft — there is no server-rendered PDF behind
 * this document, so a text copy is the most the prototype can honestly hand
 * over. Both the preview dialog and the signature dialog call this, so the
 * file a filer downloads is the same either side of signing.
 */
export function generatedApplicationText(
  generated: GeneratedApplication,
  /** The application's date, as `formatCaseDate` writes it. Today by default. */
  dated: string = formatCaseDate(new Date().toISOString())
): string {
  return [
    generated.court,
    "",
    `Case No: ${generated.caseNumber}`,
    `In the matter of: ${generated.matter}`,
    `Date: ${dated}`,
    "",
    ...generated.parties.flatMap((group) => [
      ...group.map((row) => `${row.term}: ${row.value}`),
      "",
    ]),
    generated.title,
    "",
    ...generated.entries.map((row) => `${row.term}: ${row.value}`),
    "",
    datedThis(dated),
    "",
    generated.signatory.signature,
    generated.signatory.line,
  ].join("\n");
}

/** Slashes in a case number are path separators to a download manager. */
export function generatedApplicationFilename(record: CaseRecord): string {
  return `${record.caseNumber.replace(/\//g, "-")}-application.txt`;
}

/**
 * Writes the text copy to disk. The object URL is released straight after the
 * synthetic click, which is when the browser has already taken the blob.
 */
export function downloadGeneratedApplication(
  draft: ApplicationDraft,
  record: CaseRecord,
  side?: "complainant" | "accused"
): void {
  const generated = buildGeneratedApplication(draft, record, side);
  if (generated) downloadApplicationText(generated, record);
}

/** The same text copy, for an application already set out (the detail view). */
export function downloadApplicationText(
  generated: GeneratedApplication,
  record: CaseRecord
): void {
  const url = URL.createObjectURL(
    new Blob([localizeForDownload(generatedApplicationText(generated))], { type: "text/plain" })
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = generatedApplicationFilename(voicedForDownload(record));
  anchor.click();
  URL.revokeObjectURL(url);
}
