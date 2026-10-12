/**
 * The generated application — the court-form document that Generate
 * Application produces, built from the draft and the case record.
 *
 * Structure mirrors the legacy portal's generated document: court heading,
 * case number, cause title, a facts table, numbered operative paragraphs and
 * a prayer. The operative text is composed from what the filer actually
 * typed, so the document is the draft restated as a filing — dummy only in
 * that no backend renders or stores it.
 *
 * Statutory citations are deliberately absent: journey.md names sections for
 * some of these applications but not all, and a generated legal document is
 * the last place to guess one.
 */
import { type ApplicationDraft } from "./application-draft";
import {
  applicationsFile,
  quotedOthersTitle,
  submissionTypeLabel,
} from "./applications";
import { caseLitigants } from "./application-options";
import { counselFor, formatCaseDate, type CaseRecord } from "./types";
import type { Address } from "@/lib/filing/types";
import { localizeForDownload, voicedForDownload } from "@/lib/court/browser";

export type GeneratedApplication = {
  /** "Before the …" heading line. */
  court: string;
  caseNumber: string;
  /** Cause title — "In the matter of …". */
  matter: string;
  /** Document title, e.g. "Application for condonation of delay". */
  title: string;
  /** The party the application is filed for. */
  filedFor: string;
  /** Key-value rows under the heading, like the legacy parties table. */
  facts: { term: string; value: string }[];
  /** Numbered operative paragraphs. */
  paragraphs: string[];
  prayer: string;
};

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

function trimmed(value: string): string {
  return value.trim();
}

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

function sentence(value: string): string {
  const text = trimmed(value);
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function addressLine(address: Address): string {
  return [address.line1, address.city, address.district, address.state, address.pin]
    .map(trimmed)
    .filter(Boolean)
    .join(", ");
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

  const facts: { term: string; value: string }[] = [
    { term: "Complainant", value: complainant },
    { term: "Accused", value: accused },
  ];
  const complainantCounsel = counselFor(record, "complainant");
  if (complainantCounsel.length) {
    facts.push({
      term: "Complainant counsel",
      value: complainantCounsel.join(", "),
    });
  }
  const accusedCounsel = counselFor(record, "accused");
  if (accusedCounsel.length) {
    facts.push({ term: "Accused counsel", value: accusedCounsel.join(", ") });
  }
  const raisedBy = person(draft.raisedById)?.name;
  if (raisedBy) facts.push({ term: "Raised by", value: raisedBy });

  let title = "Application";
  const paragraphs: string[] = [];
  let prayer = "";

  // The draft holds every type's fields; only read the ones this type owns.
  switch (draft.type) {
    case "advancement-reschedule":
    case "postpone": {
      const later = draft.type === "postpone";
      title = later
        ? "Application for postponement of hearing"
        : "Application for advancement of hearing";
      paragraphs.push(
        record.nextHearing
          ? `This case is listed before this court on ${formatCaseDate(
              record.nextHearing.on
            )} for ${record.nextHearing.purpose.toLowerCase()}.`
          : "No hearing is currently listed in this case."
      );
      paragraphs.push(
        draft.rescheduleReason
          ? `The applicant seeks ${
              later ? "a later" : "an earlier"
            } date for the hearing. Reason: ${draft.rescheduleReason.toLowerCase()}.`
          : `The applicant seeks ${later ? "a later" : "an earlier"} date for the hearing.`
      );
      if (draft.proposedHearingDate) {
        paragraphs.push(
          `The applicant is available from ${formatCaseDate(
            draft.proposedHearingDate.toISOString()
          )}.`
        );
      }
      prayer = draft.proposedHearingDate
        ? `It is therefore prayed that this court may ${
            later ? "postpone" : "advance"
          } the hearing of this case to ${formatCaseDate(
            draft.proposedHearingDate.toISOString()
          )} or a date thereafter.`
        : `It is therefore prayed that this court may ${
            later ? "postpone" : "advance"
          } the hearing of this case.`;
      break;
    }

    case "bail": {
      title = "Application for bail";
      paragraphs.push(`The petitioner ${filedFor} seeks release on bail in this case.`);
      if (draft.bailType) {
        const amount = trimmed(draft.bailAmount);
        facts.push({
          term: "Type of bail",
          value: draft.bailType === "cash" ? "Cash" : "Surety",
        });
        if (amount) facts.push({ term: "Bail amount", value: `Rs. ${amount}` });
      }
      if (trimmed(draft.bailReason)) paragraphs.push(sentence(draft.bailReason));
      if (draft.bailType === "surety" && draft.sureties.length) {
        const names = draft.sureties
          .map((surety) => trimmed(surety.fullName))
          .filter(Boolean);
        paragraphs.push(
          `${count(draft.sureties.length, "surety")} ${
            draft.sureties.length === 1 ? "stands" : "stand"
          } for the petitioner${
            names.length ? `: ${names.join(", ")}` : ""
          }. Their identity proofs and proofs of solvency accompany this application.`
        );
      }
      prayer =
        "It is therefore prayed that the petitioner be released on bail on such terms as this court considers fit.";
      break;
    }

    case "edit-litigant-details": {
      title = "Application to edit litigant details";
      const litigant = caseLitigants(record).find(
        (item) => item.id === draft.editLitigantId
      );
      if (litigant) facts.push({ term: "Litigant to edit", value: litigant.name });
      if (draft.litigantType) {
        facts.push({
          term: "Litigant type",
          value: draft.litigantType === "institution" ? "Institution" : "Individual",
        });
      }
      paragraphs.push(
        litigant
          ? `The applicant seeks correction of the details of ${litigant.name} on the record of this case.`
          : "The applicant seeks correction of a litigant's details on the record of this case."
      );
      if (trimmed(draft.editReason)) paragraphs.push(sentence(draft.editReason));
      prayer =
        "It is therefore prayed that the litigant's details be corrected as set out in this application.";
      break;
    }

    case "condonation-of-delay": {
      title = "Application for condonation of delay";
      if (trimmed(draft.delayReason)) {
        paragraphs.push(
          `The delay was caused for the following reasons: ${sentence(draft.delayReason)}`
        );
      }
      prayer =
        "It is therefore prayed that the delay be condoned for sufficient cause shown.";
      break;
    }

    case "application-others": {
      title = trimmed(draft.title) || "Application";
      if (trimmed(draft.details)) paragraphs.push(sentence(draft.details));
      prayer =
        "It is therefore prayed that this court grant the relief sought in this application.";
      break;
    }

    case "production-of-documents": {
      title = "Application for production of documents";
      const types = draft.productionDocuments
        .map((row) => trimmed(row.type))
        .filter(Boolean);
      if (types.length) {
        paragraphs.push(
          `The applicant seeks to place the following documents on the record of this case: ${types.join(
            ", "
          )}.`
        );
      }
      if (trimmed(draft.productionReason)) {
        paragraphs.push(sentence(draft.productionReason));
      }
      prayer =
        "It is therefore prayed that the documents listed above be taken on record.";
      break;
    }

    case "settlement": {
      title = "Application for settlement";
      paragraphs.push(
        "The parties have agreed to settle the matter between them."
      );
      if (trimmed(draft.settlementReason)) {
        paragraphs.push(sentence(draft.settlementReason));
      }
      // Compounding language per journey.md §9 — the offence is compoundable
      // and the parties may settle and close the case (NI Act §147).
      prayer =
        "It is therefore prayed that the settlement be recorded and the case be closed as compounded.";
      break;
    }

    case "transfer": {
      title = "Application for transfer";
      const to = trimmed(draft.requestedCourt);
      paragraphs.push(
        `This case is pending before the ${courtLongForm(record.court)}.`
      );
      paragraphs.push(
        trimmed(draft.transferReason)
          ? `The applicant seeks transfer of the case to ${to} on the following grounds: ${sentence(
              draft.transferReason
            )}`
          : `The applicant seeks transfer of the case to ${to}.`
      );
      prayer = `It is therefore prayed that this case be transferred to ${to}.`;
      break;
    }

    case "withdrawal": {
      title = "Application for withdrawal";
      paragraphs.push(
        trimmed(draft.withdrawalReason)
          ? `The applicant seeks permission to withdraw the case for the following reason: ${sentence(
              draft.withdrawalReason
            )}`
          : "The applicant seeks permission to withdraw the case."
      );
      prayer =
        "It is therefore prayed that the applicant be permitted to withdraw the case.";
      break;
    }

    case "poa-change": {
      title = "Application for change of power of attorney holder";
      const names = caseLitigants(record)
        .filter((item) => draft.poaLitigantIds.includes(item.id))
        .map((item) => item.name);
      if (names.length) {
        facts.push({ term: "Litigants appointing the applicant", value: names.join(", ") });
        paragraphs.push(
          `${names.join(", ")} ${
            names.length === 1 ? "has" : "have"
          } appointed the applicant as power of attorney holder. The authorization ${
            names.length === 1 ? "document accompanies" : "documents accompany"
          } this application.`
        );
      }
      if (trimmed(draft.poaReason)) paragraphs.push(sentence(draft.poaReason));
      prayer =
        "It is therefore prayed that the applicant be recorded as power of attorney holder.";
      break;
    }

    case "addition-of-witness": {
      title = "Application for addition of witness";
      const names = draft.witnesses
        .map((witness) => trimmed(witness.fullName) || trimmed(witness.designation))
        .filter(Boolean);
      paragraphs.push(
        names.length
          ? `The applicant seeks to add the following ${
              names.length === 1 ? "witness" : "witnesses"
            } to the case: ${names.join(", ")}.`
          : "The applicant seeks to add a witness to the case."
      );
      for (const witness of draft.witnesses) {
        if (trimmed(witness.proves)) {
          paragraphs.push(
            `${trimmed(witness.fullName) || trimmed(witness.designation)} will prove: ${sentence(
              witness.proves
            )}`
          );
        }
      }
      prayer =
        "It is therefore prayed that the witnesses named above be added to the case.";
      break;
    }

    case "warrant-by-hand": {
      title = "Application for warrant by hand";
      const person = caseLitigants(record).find(
        (item) => item.id === draft.warrantAccusedId
      );
      const where = addressLine(draft.deliveryAddress);
      paragraphs.push(
        `The applicant seeks that the warrant against ${
          person?.name ?? "the accused"
        } be issued for delivery by hand${where ? `, at ${where}` : ""}.`
      );
      prayer =
        "It is therefore prayed that the warrant be issued for delivery by hand.";
      break;
    }

    case "absent-application": {
      title = "Absent application";
      if (trimmed(draft.absenceReason)) {
        paragraphs.push(
          `The applicant is unable to appear for the following reason: ${sentence(
            draft.absenceReason
          )}`
        );
      }
      prayer =
        "It is therefore prayed that the absence be excused and such directions be given as this court considers fit.";
      break;
    }

    case "reopen-evidence": {
      title = "Application to reopen evidence";
      if (trimmed(draft.reopenReason)) paragraphs.push(sentence(draft.reopenReason));
      prayer = "It is therefore prayed that the evidence be reopened.";
      break;
    }

    case "objection": {
      /* An Others application is named by its own title, quoted as typed;
         "for others" would name nothing. */
      const quoted = objectionTarget ? quotedOthersTitle(objectionTarget) : null;
      const target = objectionTarget
        ? [
            `application ${
              objectionTarget.applicationNumber ??
              objectionTarget.temporaryId ??
              ""
            }`.trim(),
            quoted ??
              `for ${submissionTypeLabel(objectionTarget.type).toLowerCase()}`,
          ].join(quoted ? ", " : " ")
        : "the application";
      title = "Objection";
      facts.push({ term: "Objection to", value: target });
      paragraphs.push(`${filedFor} objects to ${target}.`);
      if (trimmed(draft.objectionReason)) {
        paragraphs.push(
          `The reason for objection is as follows: ${sentence(draft.objectionReason)}`
        );
      }
      prayer = `It is therefore prayed that ${target} be rejected.`;
      break;
    }
  }

  // Every application.
  if (trimmed(draft.otherDetails)) paragraphs.push(sentence(draft.otherDetails));
  const documents = draft.supportingDocuments.filter((row) => row.files.length);
  if (documents.length) {
    const names = documents.map((row) => trimmed(row.name)).filter(Boolean);
    paragraphs.push(
      `${count(documents.length, "supporting document")} ${
        documents.length === 1 ? "accompanies" : "accompany"
      } this application${names.length ? `: ${names.join(", ")}` : ""}.`
    );
  }

  return {
    court: `Before the ${courtLongForm(record.court)}`,
    caseNumber: record.caseNumber,
    matter: `In the matter of ${complainant} v. ${accused}`,
    title,
    filedFor,
    facts,
    paragraphs,
    prayer,
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
  generated: GeneratedApplication
): string {
  return [
    generated.court,
    `Case no. ${generated.caseNumber}`,
    generated.matter,
    "",
    generated.title,
    "",
    ...generated.facts.map((fact) => `${fact.term}: ${fact.value}`),
    "",
    ...generated.paragraphs.map(
      (paragraph, index) => `${index + 1}. ${paragraph}`
    ),
    "",
    `Prayer: ${generated.prayer}`,
    "",
    `Filed for ${generated.filedFor}`,
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
