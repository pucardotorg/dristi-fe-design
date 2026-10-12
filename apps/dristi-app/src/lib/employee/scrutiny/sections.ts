import type { FlatField, SectionDef } from "@/lib/employee/scrutiny/types"

/**
 * The filed information, exactly as the advocate submitted it, grouped by the
 * filing's own sections. One continuous scroll in the left panel; the tab strip
 * above it is a scrollspy indicator over these sections, not a panel switcher.
 */
export const SECTIONS: SectionDef[] = [
  {
    id: "party",
    num: "1",
    title: "Party Details",
    groups: [
      {
        id: "compl",
        icon: "user",
        title: "Complainant Details",
        fields: [
          {
            id: "c-name",
            label: "Full name",
            value: "Prateek Agrawal",
            doc: "aadhaar",
            ocrfail: true,
            failnote: "Not on the uploaded Aadhaar — only the address side was uploaded",
          },
          { id: "c-mob", label: "Mobile number", value: "+91 98790 44120" },
          { id: "c-mail", label: "Email address", value: "prateek.agrawal@gmail.com" },
          { id: "c-id", label: "ID proof", value: "", thumb: "aadhaar" },
          {
            id: "c-perm",
            label: "Permanent address",
            value:
              "B-403, Shyam Avirah, Opp. Vasani International School, Nr. Suyog-99, Nava Naroda, Ahmedabad, Gujarat — 382345",
            doc: "aadhaar",
            region: [2, 23, 53, 42],
          },
          { id: "c-pip", label: "Party in person", value: "No" },
        ],
      },
      {
        id: "advo",
        icon: "scale",
        title: "Advocate Details",
        fields: [
          { id: "adv-name", label: "Advocate name", value: "Adv. Bijini Rejen" },
          { id: "adv-for", label: "Advocate for", value: "Complainant" },
          {
            id: "adv-bar",
            label: "BAR registration",
            value: "G/60/1992",
            ident: true,
          },
        ],
      },
      {
        id: "accu",
        icon: "userSearch",
        title: "Accused Details",
        fields: [
          {
            id: "a-name",
            label: "Full name",
            value: "Deepak Choudhary",
            doc: "cheque",
            region: [70, 52, 29, 24],
            srcnote: "Signatory on the cheque",
          },
          { id: "a-age", label: "Age", value: "45" },
          { id: "a-mob", label: "Mobile number", value: "+91 98675 66316" },
          {
            id: "a-addr",
            label: "Permanent address",
            value: "12, Shanti Kunj Society, Naroda, Ahmedabad, Gujarat — 382330",
            unfound: "Not in any document",
          },
        ],
      },
    ],
  },
  {
    id: "case",
    num: "2",
    title: "Case Details",
    groups: [
      {
        id: "chq",
        icon: "cheque",
        title: "Cheque Details",
        fields: [
          {
            id: "q-no",
            label: "Cheque number",
            value: "230270",
            ident: true,
            doc: "cheque",
            region: [25, 77, 52, 16],
            srcnote: "MICR band",
          },
          {
            id: "q-date",
            label: "Date on cheque",
            value: "05/04/2019",
            doc: "cheque",
            region: [69, 1, 30, 17],
          },
          {
            id: "q-amt",
            label: "Amount",
            value: "₹ 52,05,000",
            doc: "cheque",
            region: [66, 25, 33, 19],
            docread: "₹ 50,25,000/-",
            skipped: true,
          },
          {
            id: "q-ifsc",
            label: "IFSC code",
            value: "SBIN0007558",
            ident: true,
            doc: "cheque",
            region: [36, 7, 32, 10],
          },
          {
            id: "q-bank",
            label: "Bank name",
            value: "State Bank of India",
            doc: "cheque",
            region: [1, 2, 34, 17],
          },
        ],
      },
      {
        id: "memo",
        icon: "memo",
        title: "Cheque Return Memo",
        fields: [
          {
            id: "m-pres",
            label: "Date of presentation",
            value: "04/04/2016",
            doc: "memo",
            region: [71, 9, 27, 7],
          },
          {
            id: "m-ret",
            label: "Date of return",
            value: "04/04/2016",
            doc: "memo",
            ocrfail: true,
            failnote: "Not legible in the memo scan",
          },
          {
            id: "m-why",
            label: "Return reason",
            value: "Funds insufficient",
            doc: "memo",
            region: [3, 83, 48, 11],
          },
        ],
      },
      {
        id: "notice",
        icon: "mail",
        title: "Legal Demand Notice",
        fields: [
          {
            id: "n-date",
            label: "Date of demand notice",
            value: "12/04/2016",
            doc: "notice",
            region: [26, 87, 42, 6],
          },
          {
            id: "n-mode",
            label: "Mode of dispatch",
            value: "Registered post (RPAD)",
            nodoc: "No postal receipt uploaded",
          },
          {
            id: "n-del",
            label: "Whether delivered",
            value: "Yes",
            nodoc: "No delivery proof (A.D.) uploaded",
          },
          { id: "n-reply", label: "Reply received from accused", value: "No" },
          { id: "n-pay", label: "Payment received after notice", value: "No" },
        ],
      },
      {
        id: "jur",
        icon: "pin",
        title: "Jurisdiction & Limitation",
        fields: [
          {
            id: "j-court",
            label: "Court",
            value: "24×7 ON Court, Ahmedabad",
          },
          { id: "j-cause", label: "Date of cause of action", value: "28/04/2016" },
          { id: "j-file", label: "Date of complaint filing", value: "04/07/2026" },
          {
            id: "j-delay",
            label: "Reason for praying condonation of delay",
            value:
              "Settlement discussions were ongoing between the parties; the accused repeatedly assured payment and sought time.",
            long: true,
          },
        ],
      },
      {
        id: "adr",
        icon: "doc",
        title: "ADR, Other Details & Prayer",
        fields: [
          { id: "p-adr", label: "Willing to settle outside court", value: "No" },
          {
            id: "p-final",
            label: "Final relief",
            value:
              "It is most respectfully prayed that this Hon'ble Court may be pleased to take cognizance of the offence committed by the accused under Section 138 of the Negotiable Instruments Act, 1881; direct the accused to pay compensation of ₹52,05,000 with interest @ 6% p.a. from the date of dishonour; and grant such other and further reliefs as this Hon'ble Court may deem fit.",
            long: true,
            doc: "complaint",
            region: [9, 58, 82, 20],
          },
          {
            id: "p-aff",
            label: "Affidavit",
            value: "Signed & uploaded (scanned copy)",
            doc: "affidavit",
            region: [8, 10, 84, 24],
            scannote: "Scanned upload — check for blur or missing pages",
          },
        ],
      },
    ],
  },
  {
    id: "evid",
    num: "3",
    title: "Evidence",
    groups: [
      {
        id: "wit",
        icon: "user",
        title: "Witness Details",
        fields: [
          { id: "w-name", label: "Witness name", value: "Rakesh Patel" },
          { id: "w-age", label: "Age", value: "38" },
          { id: "w-addr", label: "Address", value: "7, Ambika Nagar, Naroda, Ahmedabad — 382330" },
        ],
      },
      {
        id: "docs",
        icon: "doc",
        title: "Documents",
        fields: [
          {
            id: "d-affidavit",
            label: "Affidavit",
            value: "Scanned & signed",
            docrow: "affidavit",
            scannote: "Scanned upload — check for blur or missing pages",
          },
          { id: "d-cheque", label: "Cheque (front)", value: "Uploaded at filing", docrow: "cheque" },
          { id: "d-memo", label: "Cheque return memo", value: "Uploaded at filing", docrow: "memo" },
          {
            id: "d-notice",
            label: "Legal demand notice",
            value: "Uploaded at filing",
            docrow: "notice",
          },
          {
            id: "d-aadhaar",
            label: "Aadhaar — Complainant",
            value: "Uploaded at filing",
            docrow: "aadhaar",
          },
        ],
      },
    ],
  },
]

/** Every field, flattened once, with the group and section it came from. */
export const ALL_FIELDS: FlatField[] = SECTIONS.flatMap((section) =>
  section.groups.flatMap((group) =>
    group.fields.map((field) => ({
      ...field,
      group: group.title,
      section: section.title,
      sectionId: section.id,
    }))
  )
)

export const FIELD_BY_ID: Record<string, FlatField> = Object.fromEntries(
  ALL_FIELDS.map((f) => [f.id, f])
)

/**
 * Structured reasons for challenging a document itself. Free-text marks are
 * legitimate only when the document — not the value — is the problem.
 */
export const DOC_REASONS = ["Blurry / unreadable", "Wrong document", "Page missing"] as const

/** The officer's standing checks — visible, tickable, never hover-gated. */
export const CHECKS = [
  "Names match across cheque, ID and notice",
  "Cheque details match the instrument",
  "Notice within 30 days of return memo",
  "Filing within limitation (or condonation prayed)",
  "Jurisdiction consistent with addresses",
  "Signatures on complaint & affidavit",
  "All documents legible and the right ones",
]
