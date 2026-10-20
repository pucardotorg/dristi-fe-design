# Bulk filing (Provakil push and Excel upload)

Updated: 2026-10-20
Status: implemented (demo branch `bulk-filing`, not proposed for `main`)

Source of truth for fields: the Superhuman Docs PRD "Bulk Filing Problem Statement" (v1.4,
2026-10-19), which carries field IDs from the e-filing handover. Where this record and the
handover disagree, the handover wins.

## Current outcome

Two ways a batch of S-138 complaints reaches SARAS 2.0 (DRISTI's Gujarat deployment). Both
land in **File a case › Bulk filing** as their own batch, never in the regular drafts list.

1. **API push** from a litigation system, shown with `apps/provakil-mock`: a stand-in for
   Tata Capital's Provakil workspace (Legal Collections, Section 138 workflow). The legal
   manager assigns an empanelled advocate, ticks the cases and files them on SARAS 2.0. Each
   advocate's cases go as one batch to that advocate's account, with every document.
2. **Excel upload** on SARAS 2.0. A file in the template's layout goes straight in. Any other
   layout opens a column-matching screen, and list values the court does not know open a
   value-matching screen. Provakil exports both layouts.

Every batch then runs the same steps on one screen
(`apps/dristi-app/src/components/bulk/batch-screen.tsx`): Cases, Documents, Scrutiny, Sign,
Pay. A case filed from a batch is an ordinary `FilingDraft`, built from `createBlankDraft` and
checked with the single filing's own selectors (PRD §1, constraint 2).

Run it with `npm run demo` (SARAS 2.0 on port 3000, Provakil on 3100). The team guide is
`BULK-FILING-DEMO.md` at the repository root.

## Decisions

| Date | Decision and reason | Source | Status |
|---|---|---|---|
| 2026-10-20 | Provakil mock is a second app in this repo (`apps/provakil-mock`), kept on the `bulk-filing` branch and not proposed for `main`. | Owner | decided |
| 2026-10-20 | Cases are filed in Gujarat's deployment (SARAS 2.0, SARAS Court, Ahmedabad). S-138 goes to a magistrate, not the High Court. Bulk screens switch the court to Gujarat when opened. | Owner | implemented |
| 2026-10-20 | Mapping and checks are rules only. No AI reads, summarises or infers anything. | Owner | implemented |
| 2026-10-20 | Scrutiny raises two kinds of flag. A **check** (the value is there but deserves a look, such as a return reason other than insufficient funds) can be skipped and the case goes ahead. A **hold** (a requirement is not met) keeps the case in draft while the rest of the batch proceeds. | Owner; PRD §1, constraint 4 | implemented |
| 2026-10-20 | Signing offers four methods, least friction first, each with a hint: mobile OTP (fastest, one OTP for the batch), DSC (more secure, needs a DSC token, one PIN per signer), Aadhaar eSign (secure, slowest, 5 cases per OTP in succession), upload signed copies (most manual). Whether mobile OTP signing is coming is PRD §8 Q9, still open. | Owner; PRD §4.3 | implemented |
| 2026-10-20 | Mobile OTP is a single OTP, to the filing advocate's mobile, that signs every case in the selection for the advocate and the complainant's representative. PRD §4.3 (`SIG-03`) holds that an advocate's signature does not discharge the complainant's; that question is open and blocking in the PRD, so this is a demo position, not a settled one. | Owner | implemented |
| 2026-10-20 | Each hold that a filer can correct carries its fix inline on Scrutiny: a field for a value, a choice for a list, an upload slot for a missing document. Two holds have nothing to correct in place: a case whose cause of action has not arisen yet, and a cheque already filed in another case. Documents are also listed per case on the Documents tab, one slot per document. | Owner | implemented |
| 2026-10-20 | Bulk screens are space conscious: documents are one 40px line each, two or three to a row, all shown at once (no expanding), with text View and Replace buttons as elsewhere in the product. Batch tabs show what is pending on each step as a count, or a tick when nothing is. Paid cases move to a Filed tab with receipts and case numbers, and a fully filed batch says Done on the batch and in the list. | Owner | implemented |
| 2026-10-20 | Provakil holds 220 generated cases (the first 38 unchanged), most clean, with the same kinds of faults spread through them; the list pages 50 at a time. Bulk screens use plain words ("Needs fixing", "To check", "Finish scrutiny first"), grey out steps with nothing to do, slide the tab highlight, and close payment on a green "Successfully filed" screen that also lists the cases still pending with their flags. | Owner | implemented |
| 2026-10-20 | The Excel upload's complainant choice names the company only; its representative comes with it. Advocates are a multi-select of the signed-in advocate (always on record) and the advocates on their People page; clerks are not offered. Every advocate chosen is on each case and signs it (Gujarat: every advocate signs); mobile OTP still goes to the filing advocate once. | Owner | implemented |
| 2026-10-20 | Provakil's empanelled advocates are the same eight as the SARAS 2.0 login's People page (Anjali Parmar and her office), under their Gujarat names and Bar numbers. SARAS looks a Gujarat-form Bar number up in the same register as the Kerala-form one the demo data keeps. | Owner | implemented |
| 2026-10-20 | The Aadhaar option says up front how many OTPs it takes, and its hint cites the limit: CCA [eSign API Specifications v3.3](https://cca.gov.in/sites/files/pdf/esign/eSign-APIv3.3.pdf#page=14) (09 Dec 2020), §3.3.1.1, `InputHash` `id`: "Maximum 5". The PRD's eSign v2.1 allows one per OTP. | Owner; CCA spec | implemented |
| 2026-10-20 | An API push sends every file with the case. A case missing a required file is held until it is added on the Documents tab. | Owner | implemented |
| 2026-10-20 | Each push or upload is its own batch. Batches never mix and never appear in the regular drafts list. A filer may club open batches for the same complainant (PRD §8 Q10 leaves mixing complainants open). | Owner | implemented |
| 2026-10-20 | In Provakil an advocate is assigned before filing, and a push is split into one batch per advocate, since each batch lands in that advocate's account. | Owner | implemented |
| 2026-10-20 | Provakil's filing menu lists other courts (Kerala's 24×7 ON Court, NACT, eCourts) but only SARAS 2.0 is open for these Gujarat cases. Filed cases show "Filed on SARAS 2.0", and the word DRISTI does not appear in Provakil. | Owner | implemented |
| 2026-10-20 | The client is Tata Capital Ltd. Its name and registered office are public; the CIN, officers, contacts and every borrower are placeholders. | Owner | implemented |
| 2026-10-20 | Bulk payment is one gateway transaction for the selected cases, with a receipt per case. Payment files the case, as in the single flow. | PRD §4.2 | implemented |
| 2026-10-20 | The template carries a format row and an example row so the expected format is clear; upload spots and discards both automatically. Two demo spreadsheets ship with the branch, one in the template and one in a lender's own layout. | Owner | implemented |
| 2026-10-20 | Derived values (cause of action, filing date, delay, fee bill) are never accepted from the API or the sheet. | PRD §3.5, constraint 3 | implemented |

## Provakil to SARAS 2.0 mapping

Provakil keeps each NPA matter against a loan account number (LAN), with the borrower, the
dishonoured cheque and the demand notice. The company, its authorised officer and the
empanelled advocate are set in Provakil, not per matter. The rules live in
`apps/provakil-mock/src/lib/connector.ts`, which the connector settings page also shows.

A value no rule can translate is sent as it is, and scrutiny holds it and names it.

### Set once per batch

| SARAS 2.0 field | Provakil source | Rule |
|---|---|---|
| `LIT-1` party in person | Fixed | No (an advocate files) |
| `LIT-2` complainant type | Fixed | Institution |
| `LIT-17` type of institution | Company profile: constitution | `Public Ltd` to Public limited company |
| `LIT-18` institution name | Company profile: legal name | As is |
| `LIT-18a` CIN or PAN | Company profile: CIN | Upper case |
| `LIT-21` institution address | Company profile: registered office | Line, city, pincode |
| `LIT-22` to `LIT-26` authorised representative | Authorised officer for the region with most of the cases | Age from date of birth |
| `ADV-3` bar registration | Assigned advocate: enrolment number | As is; SARAS 2.0 looks up the name (`ADV-4`) |
| `PRY-5` ADR | Connector setting | No |
| `PRY-2` to `PRY-4` prayers, affidavit | Not sent | SARAS 2.0's standard templates |

### Per matter

| SARAS 2.0 field | Provakil source | Rule |
|---|---|---|
| Case reference | LAN | The filer's reference, not a court field |
| `ACC-1` accused type | Borrower constitution | Individual, Sole proprietorship to Individual; firm, company, LLP to Institution |
| `ACC-2` / `ACC-5` name | Borrower name | For a proprietorship, the proprietor |
| `ACC-3` age | Date of birth (KYC) | Whole years today |
| `ACC-4` type of institution | Borrower constitution | Partnership firm, Private limited, Public limited, LLP |
| `ACC-6` mobile | Borrower mobile | Digits only, `+91` and leading `0` dropped |
| `ACC-7` email | Borrower email | Lower case |
| `ACC-8` to `ACC-13` addresses | Borrower addresses | Residence, office, permanent, in that order |
| `ACC-14` to `ACC-17` persons responsible | Directors and partners | One per person |
| `CHQ-1`, `CHQ-2`, `CHQ-3` | Cheque date, amount, number | Number zero-padded to 6 digits |
| `CHQ-5` IFSC | Drawee IFSC | Upper case; bank and branch looked up |
| `CHQ-7a` account number | Drawer account | Sent; the draft model has no field for it yet (gap below) |
| `CHQ-8`, `CHQ-9` | Deposit date, return date | As is |
| `CHQ-10` return reason | Return memo reason code | NPCI codes: `01` Funds insufficient, `02` Exceeds arrangement, `04` Payment stopped, `12` Account closed, `22` Signature differs, `30` Amount mismatch, `88` Refer to drawer |
| `LDN-1` nature of debt | Product | Any loan to Loan / advance repayment |
| `LDN-2`, `LDN-3`, `LDN-4` | Notice date, mode, consignment number | RPAD, Speed post, Courier, Email |
| `LDN-5` to `LDN-8` service | Notice status and date | Delivered to Yes; Returned to No with the reason; In transit to unknown, held |
| `LDN-9` replied | Reply received | Yes / No |
| `LDN-10`, `LDN-11` payment after notice | Receipts after dispatch | Over zero to part payment with the amount |
| `JUR-1`, `JUR-2` | Collecting branch IFSC | Deposited in own account; the company's banker's branch |
| `JUR-12` condonation reason | Matter note tagged condonation | Sent when present |
| `DCM-1` to `DCM-12` documents | Matter documents by tag | Cheque, Return memo, Legal notice, Postal receipt, Tracking report, Reply, Loan agreement, Authorised officer ID, Vakalatnama. Notice papers are sent against each cheque, since the court keeps them per cheque |

## Excel template (bare minimum)

Defined once in `apps/dristi-app/src/lib/bulk/excel-spec.ts`; a test fails if its lists drift
from the form's options. Complainant, representative and advocate are chosen once on the
upload screen, so the sheet carries only what changes per case.

- **Cases** (required): one row per case, header in row 1, the 36 columns below.
- **Extra cheques** and **Extra accused** (optional): further cheques or accused, keyed by
  Case reference.
- **Lists**: allowed values, wired into the dropdowns. An **Instructions** sheet explains the
  format.
- On every sheet, row 2 states what each column takes ("Date, DD-MM-YYYY. Required",
  "Choose: Individual / Institution. Required"), and on Cases row 3 is a filled example.
  Upload discards both by rule (`isGuideRow`): a value starting `EXAMPLE`, three or more
  format hints, or most of the example's distinctive values (an example with its reference
  edited). The review step states how many rows were discarded.

Dates are `DD-MM-YYYY` (Excel date cells also work). Yes/No columns take Yes or No.

| # | Column | Field | Required |
|---|---|---|---|
| 1 | Case reference | Filer's reference | Yes, unique in the file |
| 2 | Accused type | `ACC-1` | Yes |
| 3 | Accused name | `ACC-2` / `ACC-5` | Yes |
| 4 | Accused institution type | `ACC-4` | When Institution |
| 5 | Accused age | `ACC-3` | No |
| 6 | Accused mobile | `ACC-6` | Mobile or email |
| 7 | Accused email | `ACC-7` | Mobile or email |
| 8 | Accused address | `ACC-8` | Yes |
| 9 | Accused city | `ACC-8` | Yes |
| 10 | Accused pincode | `ACC-8` | Yes, 6 digits |
| 11 | Accused police station | `ACC-13` | No |
| 12 | Person responsible name | `ACC-14` | When Institution |
| 13 | Person responsible designation | `ACC-15` | No |
| 14 | Cheque number | `CHQ-3` | Yes, 6 digits |
| 15 | Cheque date | `CHQ-1` | Yes |
| 16 | Cheque amount | `CHQ-2` | Yes |
| 17 | Drawer bank IFSC | `CHQ-5` | Yes |
| 18 | Drawer account number | `CHQ-7a` | Yes |
| 19 | Presentation date | `CHQ-8` | Yes |
| 20 | Return date | `CHQ-9` | Yes |
| 21 | Return reason | `CHQ-10` | Yes, from list |
| 22 | Deposited in complainant's own account | `JUR-1` | Yes |
| 23 | Complainant branch IFSC | `JUR-2` | When 22 is Yes |
| 24 | Drawer branch police station | `JUR-6a` | When 22 is No |
| 25 | Nature of debt | `LDN-1` | Yes, from list |
| 26 | Notice dispatch date | `LDN-2` | Yes |
| 27 | Notice mode of service | `LDN-3` | Yes, from list |
| 28 | Notice tracking number | `LDN-4` | No |
| 29 | Notice delivered | `LDN-5` | Yes |
| 30 | Notice delivery date | `LDN-6` | When delivered |
| 31 | Notice return date | `LDN-7` | When not delivered |
| 32 | Reason for non-delivery | `LDN-8` | When not delivered, from list |
| 33 | Accused replied | `LDN-9` | Yes |
| 34 | Payment after notice | `LDN-10` | Yes in the template; in another layout, the amount paid decides |
| 35 | Amount paid | `LDN-11` | When part payment |
| 36 | Reason for condonation of delay | `JUR-12` | Only when a delay is computed |

Not in the sheet, on purpose: cause of action, filing date, delay and fees (computed);
prayers and affidavit (standard templates); documents (added on the Documents tab).

**Column matching.** When every template header is present (case, spacing and punctuation
ignored), the matching screen is skipped. Otherwise each field is matched to a column,
with suggestions only from the header and a fixed list of aliases. A list field can also
take one value for every row (for example Nature of debt: Loan / advance repayment).

**Value matching.** List values the court does not know (`01 - Funds Insufficient`) are
matched once each, and every row using them follows.

**Document matching.** Files named `<Case reference>_<code>.<ext>`, for example
`GJ-PL-0041870_DCM-1.pdf`, attach themselves; a second cheque's ends `_2`. Anything else is
placed by hand.

**Demo files.** `npm run demo:files` writes `demo-files/tata-capital-bulk-filing-template.xlsx`
(12 cases, template layout, guide rows left in) and `demo-files/tata-capital-recovery-mis.xlsx`
(the same cases in a lender's report layout, for the matching screens), dated from today.

## Where it lives

| Part | Path |
|---|---|
| API contract | `apps/dristi-app/src/lib/bulk/contract.ts` |
| Intake (request to drafts) | `apps/dristi-app/src/lib/bulk/intake.ts` |
| Scrutiny rules | `apps/dristi-app/src/lib/bulk/scrutiny.ts` (tests beside it) |
| Sign, pay, club, fixes | `apps/dristi-app/src/lib/bulk/actions.server.ts` |
| Batch store (server, git-ignored) | `apps/dristi-app/.data/bulk` |
| Push API | `POST /api/bulk/v1/batches` (bearer key, `BULK_API_KEY`) |
| Screens | `apps/dristi-app/src/components/bulk/` |
| Provakil mock | `apps/provakil-mock` |

## Changes and tradeoffs

- A batch is a filer-side container only. After filing there is no batch at the court
  (PRD §5); each case is scrutinised and registered on its own.
- The PRD leaves the filing moment open (§5, blocking). The demo files each case when its
  payment completes and shows that time in IST on the receipt.
- The PRD leaves complainant mobile verification in bulk open (§4.1). The demo treats the
  advocate's link to the client as sufficient and does not send the representative an OTP
  at intake.
- Gujarat's oath at signing (`OTH-2`) is not taken in bulk; whether it can be is open.
- `CHQ-7a` (drawer account number) is collected by the API and the sheet but the draft
  model has no field for it, so it is not stored. It needs a field in `types.ts`.
- Batches are stored on the server for the demo, while single drafts stay in the browser.
  Engineering replaces both with the case service.
- Review was by the coordinator, not an independent reviewer.
