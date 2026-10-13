/**
 * Prototype stand-in for the verification service's rejected registrations.
 * Delete when the real endpoint lands — only the sign-in block and the
 * resubmission flow read it.
 *
 * The mechanism (PM, Sept 3): a rejected registrant is told by SMS to sign
 * in again; the sign-in screen recognises the number and routes them into a
 * correction round — the registration steps minus the role question, their
 * answers pre-filled and the officer's ONE general message shown on every
 * step. The officer's field marks only tint the stepper; fields carry no
 * flags (owner, Sept 18). Resubmitting sends the same application back for
 * approval.
 */

/** Which parts of the registration the officer marked. */
export type RejectedField = "name" | "email" | "regNumber" | "idFile";

export type RejectedRegistration = {
  mobile: string;
  fullName: string;
  email: string;
  regNumber: string;
  /** What they uploaded last time. */
  idFileName: string;
  applicationId: string;
  /** The one general message the checking officer typed on rejection. */
  officerMessage: string;
  flagged: RejectedField[];
};

/**
 * Demo login for the rejected path: sign in with 9999999999 (any password
 * or OTP) to land in the correction round. The officer marked the name
 * (does not match the Bar record) and the ID scan (unreadable); the number
 * and Bar registration number were fine.
 */
const REJECTED: RejectedRegistration[] = [
  {
    mobile: "9999999999",
    fullName: "Sreelakshmi Menonn",
    /* The name carries the deliberate error ("Menonn") — the field the
       officer flagged. Everything unflagged is authored correct. */
    email: "sreelakshmi.menon@gmail.com",
    regNumber: "K/1742/2019",
    idFileName: "bar-council-id.jpg",
    applicationId: "KL-ADV-483920-2026",
    officerMessage:
      "The name entered does not match the Bar Council record: the enrolment register holds the surname as Menon, not as entered. The Bar Council ID uploaded is also not readable; the registration number and photograph cannot be made out from the scan, so the document cannot be verified against the register. Correct the name to match the Bar Council record exactly, upload a clear and complete scan of the Bar Council ID with the registration number visible, and resubmit the registration for approval.",
    flagged: ["name", "idFile"],
  },
];

/** The rejected registration on this number, if any. */
export function rejectedRegistrationFor(
  mobile: string
): RejectedRegistration | undefined {
  return REJECTED.find((entry) => entry.mobile === mobile);
}
