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
   manager ticks the cases (Gmail style: Shift for a range, Ctrl or Cmd for one), chooses the
   court, then gives each case one of that court's advocates for the company. Each advocate's
   cases go as one batch to that advocate's account, with every document. SARAS 2.0 flags an
   unopened push in the notifications bell until someone opens it.
2. **Excel upload** on SARAS 2.0. A file in the template's layout goes straight in. Any other
   layout opens a column-matching screen, and list values the court does not know open a
   value-matching screen. Sections that repeat (a second accused, cheque, witness) are
   further columns ending `_2`, `_3`. Provakil exports both layouts.

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
| 2026-10-20 | Mapping and checks are rules. A separate AI review adds findings that are not validation (a document that disagrees with the case, a value that looks wrong next to the others). It follows the court's `aiMode` and `?ai=on\|off\|unavailable`; with AI off the flow is fully manual and nothing is marked as AI. The demo's AI is a rules stand-in (`ai-review.ts`). | Owner | implemented (stand-in) |
| 2026-10-20 | Fields that can occur more than once repeat in the API as arrays and in Excel as numbered columns: `Cheque number_2`, and for a section inside an accused, accused then item (`Accused address_1_2`). Unnumbered means the first. Repeats are per case: the file carries as many numbered columns as its busiest case needs, and every other case leaves them blank. Which fields repeat follows the PRD's 1..n sections and the single filing flow (table below). | Owner; PRD §3.3 | implemented |
| 2026-10-20 | The column-matching screen mirrors the single filing: its sections in the same order and names, a secondary nav on the left (from 1280px wide) with the filing rail's own rows and marks, each section's title outside its card, and repeating sections on the filing flow's own tabs (`SectionTabs`): Accused 1 always, Accused 2 once there is a second, with Add after the last tab. Adding an accused gives it the same address and person slots as the first. Each row is app field, then an arrow on a line between the columns, then the sheet column: green with a white arrow when matched and the values fit the field, amber when matched but they do not (the reason shows under the column), white when not matched. The column dropdown is the DS Select, each option the column name with its first value set apart in small grey mono. Requirement codes (ACC-1, CHQ-10, DCM-5) are not shown to filers anywhere in bulk filing. Optional fields stay behind **Show optional fields**. Phones get stacked rows, a stacked header and full-size controls; the batch list becomes cards. | Owner | implemented |
| 2026-10-20 | A push through the API raises a notification in the bell (warning tone, kept until the batch is opened) and a **New** mark on the batch list, so the next person to sign in deals with it first. | Owner | implemented |
| 2026-10-20 | Scrutiny raises two kinds of flag. A **check** (the value is there but deserves a look, such as a return reason other than insufficient funds) can be skipped and the case goes ahead. A **hold** (a requirement is not met) keeps the case in draft while the rest of the batch proceeds. | Owner; PRD §1, constraint 4 | implemented |
| 2026-10-20 | Signing offers four methods, least friction first, each with a hint: mobile OTP (fastest, one OTP for the batch), DSC (more secure, needs a DSC token, one PIN per signer), Aadhaar eSign (secure, slowest, 5 cases per OTP in succession), upload signed copies (most manual). Whether mobile OTP signing is coming is PRD §8 Q9, still open. | Owner; PRD §4.3 | implemented |
| 2026-10-20 | Mobile OTP is a single OTP, to the filing advocate's mobile, that signs every case in the selection for the advocate and the complainant's representative. PRD §4.3 (`SIG-03`) holds that an advocate's signature does not discharge the complainant's; that question is open and blocking in the PRD, so this is a demo position, not a settled one. | Owner | implemented |
| 2026-10-20 | Each hold that a filer can correct carries its fix inline on Scrutiny: a field for a value, a choice for a list, an upload slot for a missing document. Two holds have nothing to correct in place: a case whose cause of action has not arisen yet, and a cheque already filed in another case. Documents are also listed per case on the Documents tab, one slot per document. | Owner | implemented |
| 2026-10-20 | Bulk screens are space conscious: documents are one 40px line each, two or three to a row, all shown at once (no expanding), with text View and Replace buttons as elsewhere in the product. Batch tabs show what is pending on each step as a count, or a tick when nothing is. Paid cases move to a Filed tab with receipts and case numbers, and a fully filed batch says Done on the batch and in the list. | Owner | implemented |
| 2026-10-20 | Provakil holds 220 generated cases (the first 38 unchanged), most clean, with the same kinds of faults spread through them; the list pages 50 at a time. Bulk screens use plain words ("Needs fixing", "To check", "Finish scrutiny first"), grey out steps with nothing to do, slide the tab highlight, and close payment on a green "Successfully filed" screen that also lists the cases still pending with their flags. | Owner | implemented |
| 2026-10-20 | The Excel upload's complainant choice names the company only; its representative comes with it. Advocates are a multi-select of the signed-in advocate (always on record) and the advocates on their People page; clerks are not offered. Every advocate chosen is on each case and signs it (Gujarat: every advocate signs); mobile OTP still goes to the filing advocate once. | Owner | implemented |
| 2026-10-20 | Provakil's empanelled advocates are the same eight as the SARAS 2.0 login's People page (Anjali Parmar and her office), under their Gujarat names and Bar numbers. SARAS looks a Gujarat-form Bar number up in the same register as the Kerala-form one the demo data keeps. | Owner | implemented |
| 2026-10-20 | The app keeps the ON Courts logo in every state on this branch (Gujarat's SARAS 2.0 placeholder mark is switched off in `brand-lockup.tsx`). Provakil's wording, which names SARAS 2.0, is unchanged. | Owner | implemented |
| 2026-10-20 | The Aadhaar option says up front how many OTPs it takes, and its hint cites the limit: CCA [eSign API Specifications v3.3](https://cca.gov.in/sites/files/pdf/esign/eSign-APIv3.3.pdf#page=14) (09 Dec 2020), §3.3.1.1, `InputHash` `id`: "Maximum 5". The PRD's eSign v2.1 allows one per OTP. | Owner; CCA spec | implemented |
| 2026-10-20 | An API push sends every file with the case. A case missing a required file is held until it is added on the Documents tab. | Owner | implemented |
| 2026-10-20 | Each push or upload is its own batch. Batches never mix and never appear in the regular drafts list. A filer may club open batches for the same complainant (PRD §8 Q10 leaves mixing complainants open). | Owner | implemented |
| 2026-10-20 | Provakil files court first: **File in court** asks for the court, then fetches that court's advocates for the company (`GET /api/bulk/v1/advocates`), then each case gets an advocate (prefilled from Provakil where that advocate is registered; tick several and **Assign** together). A push is split into one batch per advocate, since each batch lands in that advocate's account. | Owner | implemented |
| 2026-10-20 | Provakil's case list selects like Gmail: a checkbox ticks one, Shift + click ticks or unticks the range from the last click (filed cases skipped), Ctrl or Cmd + click on a row ticks it without opening it. | Owner | implemented |
| 2026-10-20 | Provakil's court step lists other courts (Kerala's 24×7 ON Court, NACT, eCourts) but only SARAS 2.0 is open for these Gujarat cases. Filed cases show "Filed on SARAS 2.0", and the word DRISTI does not appear in Provakil. | Owner | implemented |
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
from the form's options. The batch complainant, its representative and the advocates are
chosen once on the upload screen, so the sheet carries only what changes per case.

- **Cases** (required): one row per case, header in row 1. Repeats are more columns on the
  same row, never more rows or more sheets.
- **Lists**: allowed values, wired into the dropdowns. **Instructions** lists every column
  with its section and whether it repeats, and explains `_2` and `_1_2`.
- Row 2 states what each column takes ("Date, DD-MM-YYYY. Required", "Choose: Individual /
  Institution. Required"), and row 3 is a filled example. Upload discards both by rule
  (`isGuideRow`): a value starting `EXAMPLE`, three or more format hints, or most of the
  example's distinctive values (an example with its reference edited). The review step
  states how many rows were discarded.

Dates are `DD-MM-YYYY` (Excel date cells also work). Yes/No columns take Yes or No.

### Columns

| Section | Columns (template header) | Fields | Required |
|---|---|---|---|
| Case | Case reference | Filer's reference | Yes, unique in the file |
| Case | Additional details | `PRY-1` | No |
| Further complainant | Complainant type, name, institution type, CIN or PAN, age, gender, mobile, email, address, city, pincode, representative name, designation, age, mobile | `LIT-2` to `LIT-7`, `LIT-17` to `LIT-25a` | Only for a case with more than one complainant |
| Accused | Accused type, name, institution type, age, mobile, email | `ACC-1` to `ACC-7` | Type, name, and mobile or email |
| Accused address | Accused address, city, pincode, police station | `ACC-8`, `ACC-13` | Address, city, pincode |
| Person responsible | Person responsible name, designation, mobile, email, address, city, pincode | `ACC-14` to `ACC-18` | Name and mobile when the accused is an institution |
| Cheque | Cheque number, date, amount, Drawer bank IFSC, Drawer account number, Presentation date, Return date, Return reason | `CHQ-1` to `CHQ-10` | Yes |
| Demand notice | Nature of debt, Notice dispatch date, mode of service, tracking number, delivered, delivery date, return date, Reason for non-delivery, Accused replied, Payment after notice, Amount paid | `LDN-1` to `LDN-11` | As in the single flow (delivery date when delivered, and so on) |
| Jurisdiction | Deposited in complainant's own account, Complainant branch IFSC, Complainant branch police station, Drawer branch police station, Reason for condonation of delay | `JUR-1`, `JUR-2`, `JUR-5`, `JUR-6a`, `JUR-12` | `JUR-1`; IFSC or police station by its answer; condonation only when a delay is computed |
| Witness | Witness name, designation, age, What the witness will prove, mobile, email, address, city, pincode | `WIT-1` to `WIT-7` | For each witness: name or designation, and the address |
| Other pending case | Other pending case court, number | `JUR-7`, `JUR-8` | No |

### Fields that repeat

A section repeats where the PRD gives it as 1..n and the single filing flow lets the filer
add another. Unnumbered columns are the first; `_2`, `_3` are the next. A section inside an
accused carries two numbers, accused then item: `Accused address_1_2` is the first accused's
second address. In the API the same sections are arrays.

Repeats are per case, not per file. A file needs as many numbered columns as its busiest
case: if one case in fifty has a second cheque, the file has `Cheque number_2` and the other
49 leave it blank. A blank set of columns adds nothing to that case; only the first accused,
cheque and notice are always read, since every case has them. In the API, each case's
arrays simply have their own lengths.

| Section | Excel | API | Why it repeats |
|---|---|---|---|
| Complainant | `Complainant name_2` onwards (the batch complainant is the first) | `cases[].complainants[]` | PRD §3.3, complainant 1..n; the single flow's **Add complainant**. Each further complainant needs their own ID card and vakalatnama |
| Accused | `Accused name_2` | `cases[].accused[]` | PRD §3.3, accused 1..n; joint borrowers and guarantors |
| Accused address | `Accused address_1_2` | `accused[].addresses[]` | `ACC-8` to `ACC-13`, residence, office and permanent; summons go to each |
| Person responsible | `Person responsible name_1_2` | `accused[].personsResponsible[]` | `ACC-14` to `ACC-18`; S-141 reaches every director or partner in charge |
| Cheque | `Cheque number_2` | `cases[].cheques[]` | PRD §3.3, cheque 1..n; several cheques on one loan are one complaint |
| Demand notice | `Notice dispatch date_2` | `cases[].notices[]` | One per cheque in the single flow, which keeps notice papers per cheque |
| Witness | `Witness name_2` | `cases[].witnesses[]` | `WIT`, 0..n |
| Other pending case | `Other pending case court_2` | `jurisdiction.otherPendingCases[]` | `JUR-6b` to `JUR-8`, 0..n |

Not repeated: the case reference, jurisdiction (`JUR-1`, `JUR-2` are answered once per case,
as in the single flow), condonation, additional details, and the batch-wide complainant,
representative and advocates.

Not in the sheet, on purpose: cause of action, filing date, delay and fees (computed);
prayers and affidavit (standard templates); documents (added on the Documents tab).

**Column matching.** When every template header is present (case, spacing and punctuation
ignored), the matching screen is skipped. Otherwise each field is matched to a column,
with suggestions only from the header and a fixed list of aliases, including its `_2`, `_3`
forms. A list field can also take one value for every row (for example Nature of debt:
Loan / advance repayment). The screen opens with **Found in your file**: the most any
case has of each repeating section, with steppers. Where a
file names them another way (`Chq No 2`), the filer raises the count and the tabs below
follow. In each dropdown a column shows its first value (`Chq No · e.g. 004512`), and the
chosen column's value shows under it.

**Value matching.** List values the court does not know (`01 - Funds Insufficient`) are
matched once each, and every row using them follows.

**Document matching.** Files named `<Case reference>_<code>.<ext>`, for example
`GJ-PL-0041870_DCM-1.pdf`, attach themselves; a second cheque's ends `_2`. Anything else is
placed by hand.

**Demo files.** `npm run demo:files` writes `demo-files/tata-capital-bulk-filing-template.xlsx`
(12 cases, template layout, guide rows left in; one case with two accused, one with two
witnesses, one with two cheques and another pending case) and
`demo-files/tata-capital-recovery-mis.xlsx` (the same cases in a lender's report layout, with
a second cheque, for the matching screens), dated from today.

## AI review

`apps/dristi-app/src/lib/bulk/ai-review.ts`. Findings appear on Scrutiny as **AI check**
(sparkle mark), always skippable, never a hold. With the stand-in they are:

| Finding | Reads |
|---|---|
| Cheque number or amount on the cheque or return memo differs from the case | Document text |
| Demand notice addressed to someone who is not an accused | Document text |
| Consignment number on the notice papers differs from the case | Document text |
| An individual's name reads like a business | The case |
| City does not match the pincode's district | The case and the pincode register |
| Same accused elsewhere in the batch with another mobile | The batch and open batches |
| Notice delivered the day it was sent | The case |

Mode comes from the court profile's `aiMode`, overridden by `?ai=` on the page; the batch
screen keeps the parameter as you move between tabs. `off` hides AI entirely.
`unavailable` shows "AI review unavailable. Documents are not compared with the cases;
check them by hand." Provakil's demo sets a document mismatch on 13 of its 220 matters.

## Notifications

A batch from the API is stored with `openedAt: null`. While it is, the bell lists it
("2 new cases from Provakil API", batch number, advocate, date) in warning tone and keeps
the count badge, and the batch list marks it **New**. Opening the batch records the time and
clears both. Excel uploads and clubbed batches are opened by the person who made them, so
they never notify. The bell reads the batch list on each page change and every 30 seconds.

## Where it lives

| Part | Path |
|---|---|
| API contract | `apps/dristi-app/src/lib/bulk/contract.ts` |
| Intake (request to drafts) | `apps/dristi-app/src/lib/bulk/intake.ts` |
| Scrutiny rules | `apps/dristi-app/src/lib/bulk/scrutiny.ts` (tests beside it) |
| Sign, pay, club, fixes | `apps/dristi-app/src/lib/bulk/actions.server.ts` |
| Batch store (server, git-ignored) | `apps/dristi-app/.data/bulk` |
| Push API | `POST /api/bulk/v1/batches` (bearer key, `BULK_API_KEY`) |
| Advocates for a sender | `GET /api/bulk/v1/advocates` (bearer key) |
| Excel spec, sections, repeats | `apps/dristi-app/src/lib/bulk/excel-spec.ts`, `excel.ts` |
| AI review (stand-in) | `apps/dristi-app/src/lib/bulk/ai-review.ts`, `doc-text.ts` |
| Column matching | `apps/dristi-app/src/components/bulk/column-mapping.tsx` |
| API notifications | `useApiArrivals` in `apps/dristi-app/src/components/shell/top-bar.tsx` |
| Provakil filing dialog | `apps/provakil-mock/src/components/push-dialog.tsx` |
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
- The demo has one sign-in (Anjali Parmar). A batch pushed to another advocate is in the
  office's batch list with "To <advocate>" under its source, rather than in a separate
  account. Per-advocate accounts need the identity service.
- Jurisdiction is per case, as in the single flow. A case whose cheques were deposited in
  different branches cannot say so; the PRD does not settle whether `JUR-1` and `JUR-2` are
  per cheque.
- A further complainant's ID card and vakalatnama attach on the Documents tab or by file name
  (`<reference>_DCM-9_2.pdf` for the ID card, `_DCM-12_2` for the vakalatnama); the sheet has
  no column for documents.
- The AI review is a rules stand-in with the shape a model returns. Reading document text
  works on simple PDFs only.
- Review was by the coordinator, not an independent reviewer.
