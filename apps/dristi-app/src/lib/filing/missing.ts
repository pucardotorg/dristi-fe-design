/**
 * The required fields a section still has empty — every field the form marks with an
 * asterisk, in the order the screen shows them (design feedback #11).
 *
 * The rail counts these on a section the person has left, and the section shows them as
 * field errors when the person comes back. Each entry carries the `name` its `FormField`
 * is given and the instance (`CorrectionInstance`) it sits in, so the error lands on the
 * field itself. Fields only on screen under a condition (a PoA holder, the second
 * cheque's own bank) are listed only while that condition holds.
 *
 * This is wider than `sectionComplete`, which gates filing on fewer fields: the owner
 * chose to flag every asterisk while leaving what blocks a filing unchanged
 * (2026-10-30). Rules that are not about an empty field — a date before another, a
 * CIN/PAN in the wrong shape — keep their own errors and are not counted here.
 */

import { isPartyInPerson, limitationView, representedIndices, witnessComplete } from "./selectors";
import type { Address, FilingDraft, Representative, StepId, Witness } from "./types";

export type MissingField = {
  /** Which complainant, accused, cheque, notice or witness — 0 for a single record. */
  instance: number;
  /** The `name` of the field's `FormField`. */
  name: string;
  /** Shown under the field. */
  message: string;
};

const blank = (value: string | undefined) => !value?.trim();

/** Collects the missing fields of one instance. */
function collector(out: MissingField[], instance: number) {
  return (empty: boolean, name: string, message: string) => {
    if (empty) out.push({ instance, name, message });
  };
}

type Check = ReturnType<typeof collector>;

/** `AddressFields` names its fields `<name>.<key>`; every one is required. */
function address(check: Check, name: string, a: Address) {
  check(blank(a.pin), `${name}.pin`, "Enter the pincode.");
  check(blank(a.city), `${name}.city`, "Enter the city or town.");
  check(blank(a.district), `${name}.district`, "Enter the district.");
  check(blank(a.state), `${name}.state`, "Choose the state or UT.");
  check(blank(a.line1), `${name}.line1`, "Enter the address line.");
}

/** The people summoned for an accused entity (`RepresentativeList`). */
function summonedPeople(check: Check, reps: Representative[]) {
  reps.forEach((r, i) => {
    check(blank(r.name), `reps.${i}.name`, "Enter the full name.");
    check(blank(r.designation), `reps.${i}.designation`, "Enter the designation.");
    address(check, `reps.${i}.addr`, r.addr);
  });
}

function witnessStarted(w: Witness): boolean {
  return (
    [w.fullName, w.designation, w.age, w.prove].some((v) => !blank(v)) ||
    w.contacts.some((c) => !blank(c.mobile) || !blank(c.email)) ||
    w.addresses.some((b) => !blank(b.police) || Object.values(b.addr).some((v) => !blank(v)))
  );
}

export function missingRequired(draft: FilingDraft, step: StepId): MissingField[] {
  const out: MissingField[] = [];

  switch (step) {
    case "complainant":
      draft.complainants.forEach((c, i) => {
        const check = collector(out, i);
        if (c.type === "institution") {
          check(blank(c.entType), "entType", "Choose the type of entity.");
          check(blank(c.entName), "entName", "Enter the entity name.");
          check(blank(c.entCinPan) && !c.entCinPanSkippedAt, "entCinPan", "Enter the CIN or PAN, or skip it.");
          address(check, "entAddr", c.entAddr);
          check(blank(c.rep.mobile), "rep.mobile", "Enter the mobile number.");
          check(blank(c.rep.name), "rep.name", "Enter the full name.");
          check(blank(c.rep.age), "rep.age", "Enter the age.");
          address(check, "rep.addr", c.rep.addr);
          return;
        }
        check(blank(c.mobile), "mobile", "Enter the mobile number.");
        check(blank(c.name), "name", "Enter the full name.");
        check(blank(c.age), "age", "Enter the age.");
        address(check, "res", c.res);
        if (c.permSame === "no") address(check, "perm", c.perm);
        if (!isPartyInPerson(c) && c.poa === "yes") {
          const h = c.poaHolder;
          check(blank(h.mobile), "poaHolder.mobile", "Enter the PoA holder's mobile number.");
          check(blank(h.name), "poaHolder.name", "Enter the PoA holder's full name.");
          check(blank(h.age), "poaHolder.age", "Enter the PoA holder's age.");
          address(check, "poaHolder.res", h.res);
          if (h.permSame === "no") address(check, "poaHolder.perm", h.perm);
        }
      });
      break;

    case "advocate": {
      const represented = representedIndices(draft.complainants);
      if (draft.complainants.length > 0 && represented.length === 0) break;
      const check = collector(out, 0);
      draft.advocates.forEach((a, i) => {
        const forSomeone = a.forComplainants.some((k) => represented.includes(k));
        check(!forSomeone, `advocates.${i}.for`, "Choose who this advocate appears for.");
        // The draft's own record, as signing reads it — not whether the stand-in register
        // knows the number, which the sample drafts' advocates are not on.
        check(blank(a.name) || blank(a.barNumber), `advocates.${i}.advocate`, "Find the advocate by name, bar number or mobile.");
      });
      break;
    }

    case "accused":
      draft.accused.forEach((a, i) => {
        const check = collector(out, i);
        const institution = a.type === "institution";
        if (institution) check(blank(a.entType), "entType", "Choose the type of entity.");
        check(blank(a.name), "name", institution ? "Enter the entity name." : "Enter the full name.");
        if (institution) summonedPeople(check, a.reps);
        a.addresses.forEach((b, k) => {
          address(check, `addresses.${k}.addr`, b.addr);
          check(blank(b.police), `addresses.${k}.police`, "Choose the police station.");
        });
      });
      break;

    case "cheque":
      draft.cheques.forEach((c, i) => {
        const check = collector(out, i);
        check(!c.dateOnCheque, "dateOnCheque", "Enter the date on the cheque.");
        check(blank(c.amount), "amount", "Enter the amount.");
        check(blank(c.chequeNumber), "chequeNumber", "Enter the cheque number.");
        if (i === 0 || c.sameAsPrev === "no") {
          check(blank(c.ifsc), "ifsc", "Enter the IFSC code.");
          check(blank(c.bankName), "bankName", "Enter the bank name.");
          check(blank(c.bankBranch), "bankBranch", "Enter the bank branch.");
        }
        check(!c.presentDate, "presentDate", "Enter the date of presentation.");
        check(!c.returnDate, "returnDate", "Enter the date of return.");
        check(blank(c.returnReason), "returnReason", "Choose the return reason.");
      });
      break;

    case "demand-notice":
      draft.notices.forEach((n, i) => {
        const check = collector(out, i);
        check(blank(n.natureDebt), "natureDebt", "Choose the nature of the debt.");
        check(!n.dispatchDate, "dispatchDate", "Enter the date of dispatch.");
        check(blank(n.modeService), "modeService", "Choose the mode of service.");
        if (n.delivered === "yes") {
          check(!n.deliveryDate, "deliveryDate", "Enter the date of delivery.");
        } else {
          check(!n.returnDate, "returnDate", "Enter the date it came back.");
          check(blank(n.nonDeliveryReason), "nonDeliveryReason", "Enter the reason for non-delivery.");
        }
        check(!n.paymentStatus, "paymentStatus", "Choose whether any payment was made.");
        if (n.paymentStatus === "part") check(blank(n.partAmount), "partAmount", "Enter the amount paid.");
      });
      break;

    case "jurisdiction": {
      const j = draft.jurisdiction;
      const check = collector(out, 0);
      if (j.deposited === "yes") {
        check(blank(j.ifsc), "ifsc", "Enter the IFSC code.");
        check(blank(j.payeeBankName), "payeeBankName", "Enter the bank name.");
        check(blank(j.payeeBankBranch), "payeeBankBranch", "Enter the bank branch.");
        check(blank(j.payeePolice), "payeePolice", "Choose the police station.");
      } else {
        check(blank(j.drawerPolice), "drawerPolice", "Choose the police station.");
      }
      if (j.otherPending === "yes") {
        j.otherCases.forEach((oc, i) => {
          check(blank(oc.court), `otherCases.${i}.court`, "Enter the court.");
          check(blank(oc.caseNumber), `otherCases.${i}.caseNumber`, "Enter the case number.");
        });
      }
      // The date is worked out from the notice when it can be; only an unknown one is asked.
      const limitation = limitationView(draft);
      check(!limitation.causeDate, "causeDate", "Enter the date of cause of action.");
      const delayed = limitation.elapsed !== null && !limitation.withinLimit;
      check(delayed && blank(j.condonationReason), "condonationReason", "Give the reason for the delay.");
      break;
    }

    case "witnesses":
      // Witnesses are optional and a new draft opens on one blank card, so a witness is
      // asked for its required fields only once something about them has been entered.
      draft.witnesses.forEach((w, i) => {
        if (!witnessStarted(w)) return;
        const check = collector(out, i);
        check(!witnessComplete(w), "identity", "Enter a full name or a designation.");
        w.addresses.forEach((b, k) => {
          address(check, `addresses.${k}.addr`, b.addr);
          check(blank(b.police), `addresses.${k}.police`, "Choose the police station.");
        });
      });
      break;
  }

  return out;
}
