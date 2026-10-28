# Witness deposition and examination of the accused
Updated: 2026-10-28
Status: implemented: a Recorded statements view on the court's order screen (branch `feature-witness-deposition`)

## Current outcome

On the court's order screen for a hearing, the view switch reads **Order | Order data |
Recorded statements**. Recorded statements holds what was taken at this hearing. Each
record is one typing screen with a **Statement type** dropdown (witness deposition,
evidence of the complainant, examination of the accused) and a **person** dropdown
filtered by that type. Signing still follows the type's family (in-court for deposition-
family; SMS link for the accused).

- **Way in.** The view is there in every order state: draft, and sent for signing. A
  warning count on the switch shows records the person has not signed yet. The empty
  view offers **Record a statement**, which opens a draft typed to the hearing's
  purpose (accused examination, complainant evidence, or witness deposition). Only a
  hearing's order has the view; cognizance and application orders do not.
- **Tabs.** One tab per record, labelled "PW-2 · Name" or the person's name, with its
  status (Not signed / Sent to sign / Signed by the witness or accused). **Record
  another** starts another blank draft. A draft can be discarded from its tab, after a
  confirmation.
- **Who.** The witness picker groups the complainant, the case's witnesses, then each
  accused who is not already listed. **+ Add a witness** is a link at the right of the
  Witness label, not a row in the list. A party already on the
  witness list is not offered twice. The hint sits under the dropdown, so the label and
  box line up with the read-only witness mark beside them. Add a witness asks the way
  the advocate's form does: a full name or a designation, optional age, one contact,
  optional addresses, who called them, and what they will prove. Only the name or
  designation is required; a started address must be complete. The number is the next
  free one on that side, and it is kept once they sign. Closing a half-filled form asks
  before discarding it.
- **Typing.** The witness mark is a read-only field. Typing uses the rich text field
  with the `/` deposition shortcuts and a Shortcuts dialog: the list on the left, the
  add or edit form beside it from a medium width up. **Review and sign** needs a
  person, some text and no `[blank]` left. If one is missing, it focuses the editor and
  selects the first blank.
- **Signing**, in one dialog: the sheet, dated by the court's day → the method → done.
  - Witness: Aadhaar OTP or an uploaded paper copy → Signed.
  - Accused: SMS link to a 10-digit mobile → Sent to sign; or paper → Signed.
  - Signed and sent records are read-only.
- **Stored** per hearing in this browser (`dristi.hearing-evidence.v1`), like order
  drafts, so typing survives a reload.

Files:
- [evidence-view.tsx](../../../apps/dristi-app/src/components/employee/evidence-view.tsx)
- [hearing-evidence.ts](../../../apps/dristi-app/src/lib/employee/hearing-evidence.ts) and its [test](../../../apps/dristi-app/src/lib/employee/hearing-evidence.test.ts)
- [deposition-shortcuts.ts](../../../apps/dristi-app/src/lib/employee/deposition-shortcuts.ts), moved from `lib/cases`
- [deposition-shortcuts-panel.tsx](../../../apps/dristi-app/src/components/employee/deposition-shortcuts-panel.tsx), moved from `components/cases`
- Edits to [order-editor.tsx](../../../apps/dristi-app/src/components/employee/order-editor.tsx) (the third view and its count) and [order-door-screen.tsx](../../../apps/dristi-app/src/components/employee/order-door-screen.tsx) (passes the hearing, people and court day)
- The advocate-side dialog and `lib/cases/recorded-evidence.ts` are deleted.

## Decisions

| Date | Decision and reason | Source | Status |
|---|---|---|---|
| 2026-10-26 | Build witness deposition, broad enough for the examination of the accused; replace 1.0's "Add Questions" with the order screen's shortcuts. | Anshumanth (Slack), relayed by Neer | Confirmed |
| 2026-10-26 | It lives on the case page's ⋮ menu, as in the 1.0 demo video — not behind the order screen. First prototype put it behind the order screen; Neer rejected it. | Neer, after the video | Confirmed |
| 2026-10-26 | Advocate side of the product only. Agent noted twice that in 1.0 a court user (the judge) drove it; Neer: the person in the video was only demoing. | Neer | Confirmed |
| 2026-10-26 | ⋮ beside the primary rather than another place on the page. | Neer ("yeah build it") on the agent's recommendation | Confirmed |
| 2026-10-26 | Standalone HTML prototype reviewed before the build (claude.ai/artifact/9mrd7SvqpNqapLgvT5AdZk). | Neer | Confirmed |
| 2026-10-26 | **Reopened: built on the wrong side.** Anshumanth: a deposition is taken while a hearing is ongoing, usually by the same person typing the orders, sometimes outside a hearing; asked for an entry point in the hearing and order experience. Proposal published for Neer (https://claude.ai/artifact/T9w5JAHNt3a8ap8z8BAZ4p): a Take deposition / Examine accused button in the order screen beside Shortcuts, shown by the hearing's purpose; the same actions in a ⋮ on the court's case page for outside a hearing; the advocate's ⋮ removed. The deposition window itself is unchanged. | Anshumanth via Neer; proposal by agent | Awaiting Neer's decision |
| 2026-10-26 | **Revised proposal after Anshumanth's "Order and Hearing Entity Explainer".** A deposition is a record of the hearing (like Attendance), not an order item or an item workflow: an item belongs to one order and its workflow runs only after the order is signed and its data complete, while a witness signs before leaving and evidence can span hearings (`WitnessDeposition.hearingIds`). Proposed: a section under Attendance on the order page titled by the hearing's purpose, listing what was recorded and whether signed, writing an editable line into the order text; a quiet button beside Shortcuts for other hearings; the court case page ⋮ outside a hearing. One section for the four section workflows in `docs/product/order-templates.md`. Eight questions for Anshumanth listed in the review. | Agent analysis, same artifact (v2) | Awaiting Neer / Anshumanth |
| 2026-10-27 | **Built: the Evidence view (v4).** Neer approved it ("I like this direction now, can you build this for me in the product"). Built as reviewed, except that entry from the court case page outside a hearing is not built yet. A deposition is stored as a hearing record keyed by hearing id, not as an order item. | Neer | Implemented, not committed |
| 2026-10-27 | **Witnesses can be added while recording.** Most demo cases list no witnesses, so the picker was a dead end. Now the picker offers: the complainant first, unless they're already listed as a witness, because in a cheque case they are usually PW-1; then the listed witnesses; then **Add a witness** at the end. The form asks for a name, the side the witness is for (prosecution, defence or court) and an optional mobile number. Nobody chooses the number: it is the next free one on that side (PW-, DW- or CW-), shown before signing and fixed when the witness signs. Added witnesses are kept per case in this browser, so they appear at the next hearing. Not yet decided: whether they also join the case's Parties tab (for Anshumanth). | Neer: "yes build it" | Implemented, not committed |
| 2026-10-27 | **The person field's help sits above the dropdown.** Neer pointed at the witness hint ("The complainant and the witnesses on this case…") and asked for it above the list. The same field is used for the accused, so that hint moves with it. The validation message stays under the dropdown. | Neer | Superseded the same day: the hint sits under the dropdown so the label lines up with the witness mark |
| 2026-10-27 | **The parties are offered, and Add a witness matches the advocate form.** The picker groups complainant, witnesses, then each accused not already listed. The hint sits under the dropdown again so that field lines up with the read-only witness mark. A draft is discarded from its tab. Shortcuts list on the left with the form beside them. Add a witness asks for a name or designation, age, one contact, addresses and what they will prove; only the name or designation is required. A half-filled form asks before it is discarded. | Neer | Implemented |
| 2026-10-27 | **The view is named Examinations.** The order-screen switch reads Order, Order data, Examinations. An accused's S. 351 answers are not evidence, and "evidence" already names the marked exhibits. | Neer | Superseded 2026-10-28: Recorded statements |
| 2026-10-28 | **Rename Examinations → Recorded statements.** One screen for complainant evidence, witness deposition, and examination of the accused (and more types later as court master data). | Anshumanth / Abhiram (design sync), Neer build | Implemented |
| 2026-10-28 | **Replace type buttons with dropdowns.** Empty state is one "Record a statement"; the editor has Statement type + person (filtered by type). Record another starts another blank draft — no type menu. | Anshumanth / Abhiram (design sync), Neer build | Implemented |
| 2026-10-28 | **Statement type leads; no help text under the fields.** Statement type is alone on the first row, defaulting to Witness deposition. The person picker and Witness mark as sit side by side on the row below (stacked below `sm`). The hints under Statement type and the person picker are removed and must not return; validation messages remain. | Neer: "please remove these and don't add them back" | Implemented, not committed |
| 2026-10-28 | **Witness mark as is a dropdown of sides.** Beside the Witness picker. Three rows: Prosecution (complainant), Defence (accused), Court. Each row has its mark as a coloured pill (green PW, red DW, blue CW) showing the number this witness would really hold on that side. Unsigned witnesses hold distinct marks, in the order their depositions were started. The side is kept on the deposition (`witnessSide`). The field is locked once the witness has a number from the case's list or from signing. The Add a witness dialog no longer asks "Witness for"; a new witness starts as the prosecution's. | Neer (screenshot of the side list: "this is what needs to show when I click on the dropdown") | Implemented, not committed |
| 2026-10-28 | **Add a witness follows DRISTI 1.0's sections.** *Witness basic details*: first name, middle name (optional) and last name (optional), then "or", then witness designation and age (optional). *Witness contact details*: mobile number and email ID. *Witness location*: type of address (Residential / Office, radio choices), then address line, pincode, state, city / town and district. The PIN still fills the district and state. *Purpose / documents to be presented*: an optional text box. Only a first name or the designation is required. Contact details and location stay optional, but a started location needs its type and every field. The police station is no longer asked. The section headings use sentence case, as the DS requires. The State dropdown and the address-type choice now have accessible names; the State fix also reaches filing. | Neer: "This how you need to structure the module … Build this for me now" | Implemented, not committed |
| 2026-10-28 | **The order's Shortcuts window uses the Recorded statements panel.** One shared `ShortcutsPanel` (`shortcuts-panel.tsx`): the list is a well on the left, each row with Insert / Edit / Remove, and the New shortcut form is beside it, always in view. Below md they stack. Insert in the order adds the shortcut at the end of the order text and closes the window, the same as in statements. Each screen keeps its own shortcut store and its `/` completion. The order's text field keeps tables and the page's paragraph spacing. | Neer: "the shortcuts in the order tab also needs to be similar to how we designed in the recorded statements" | Implemented, not committed |
| 2026-10-28 | **Add a witness moves out of the picker.** It is now a link with a plus icon at the right of the Witness label, instead of the last row in the list. It shows only for a draft deposition. The list now holds only people. | Neer: "maybe the +add a witness can be outside in the same section as witness header and on the right" | Implemented, not committed |
| 2026-10-27 | Sides are named in the court's terms, which the letters stand for: "Witness for" Prosecution (complainant) / Defence (accused) / Court. The beside-picker line reads "Prosecution witness, called by the complainant". Before this, the labels were Complainant / Accused / Court. | Neer | Implemented, not committed |
| 2026-10-27 | **Entry point consolidated: an Evidence view on the order screen.** Neer found the header button + side-panel tab + order line + case page "fragmented". Revised to one place: a third choice, Evidence, in the order screen's view switch (`aria-label="What to work on"`, beside Order and Order data), hosting the deposition design in place of its dialog; a count on the switch for unsigned records; purpose decides the first choice in the empty view; present in every order state. Case page opens the same view outside a hearing. Review v4, same link. | Neer feedback; agent proposal | Approved 2026-10-27 |
| 2026-10-27 | **Entry point revised to the order screen's chrome.** Keep the deposition window as designed. Way in: a split button in the order screen header beside Side panel, labelled by the hearing's purpose (Take deposition / Examine accused / Record plea), the others behind the chevron (the cause list's Pass-over pattern). Status: an Evidence tab in the side panel listing this hearing's records and earlier ones. Replaces the section-under-Attendance idea: the order page is the signed order's rendering (`ORD-13`) and goes read-only once sent for signing; the Shortcuts row exists only in the draft Order view. Review v3: https://claude.ai/artifact/T9w5JAHNt3a8ap8z8BAZ4p | Neer asked to settle the entry point on the order page; agent proposal | Superseded by the Evidence view |
| 2026-10-26 | **Advocate-side entry removed.** The ⋮ (Take witness deposition, Record examination of accused) is off the advocate's case page and the Documents tab no longer merges recorded evidence; `case-header-actions.tsx` and `case-documents.tsx` are back to `HEAD`. The dialog, shortcut panel and their two `lib` modules stay on the branch, unused, for the rework. | Neer: "not needed. We will rework on this" | Done |
| 2026-10-26 | Witness number is read from the Parties tab, not chosen. Every witness in 2.0 already carries PW/DW/CW from its side; the prototype's "Witness marked as" choice and its "can't be changed" confirmation are dropped. | Agent, from the 2.0 data model | Implementation choice — review |
| 2026-10-26 | No direct "Add a witness": in 2.0 an advocate adds one with an Addition of witness application, which the court decides. The field links to it instead. | Agent | Implementation choice — review |
| 2026-10-26 | Shortcut blanks are `[cheque number]`-style, as on the order screen; the prototype's auto-filled case facts are dropped — no single source holds a case's cheque details. | Agent | Implementation choice — review |
| 2026-10-26 | Examination shortcuts start "Accused:", not "351": the shared field never completes a slash followed by a digit (so case numbers do not trigger it). | Agent, from `lib/rich-text/ghost.ts` | Implementation choice |
| 2026-10-26 | A separate shortcut list from the order screen's, same shape and rules, so questions do not appear while typing orders. | Agent | Implementation choice — review |
| 2026-10-26 | One dialog with stages (Shortcuts is a stage too), per ui-craft's "a flow progresses inside one modal". | Agent | Implementation choice |
| 2026-10-26 | Examinations are filed under the Deposition type: the register's types are DSB-11's six and none is an examination. | Agent | Implementation choice — review |

## Changes and tradeoffs

- Signing copy is the witness's or accused's, not "you": the e-sign dialog's stages
  (`ChoiceCard`, `OtpEntry`, paper fallback, upload field) are reused, its "your"
  wording and DSC choice are not — a witness has no DSC.
- A question and its answer are one paragraph (answer on the next line), because the
  field selects a blank only in the first paragraph of what a shortcut inserts; an empty
  box starts on a paragraph so shortcuts insert after the line, not into it.
- A Pending review record has no file, so its record shows "No file attached".

## Verification and open work

### Evidence view (2026-10-27)

Checked on the owner's dev server (localhost:3000, this checkout, DS pin
`e0cadea6b9d4`) in headless Chromium, typist seat:

- h-241 (evidence hearing, order sent for signing), 1440px:
  - Empty state and errors; the picker; the `/cr` grey suggestion; Tab inserts the
    question with `[cheque number]` selected.
  - The blank gate selects `[answer]`.
  - The sheet is dated 27 October 2026; OTP; done; the tab reads "Signed by the
    witness".
  - Record another → Examine accused picks the only accused automatically.
  - The switch shows "Evidence 1 not signed".
  - Records are still there after a reload.
- h-253 (examination of accused): the empty state offers Examine accused first.
- 390px: no horizontal overflow. Dark mode checked. No page errors.
- `tsc`: no errors in `src`. ESLint is clean on the changed files.
- `check:tokens`, `check:ui-sync` and `check:table-rows` pass. `check:typography` and
  `check:spacing` fail only on files outside this change; those failures were already
  there.
- `npm test`: 1412 pass, 0 fail. Six of those tests are new, in `hearing-evidence.test.ts`.
- This review was the agent's own, not independent.
- Add a witness, on h-243 (a case with no listed witnesses):
  - The picker lists the complainant, then Add a witness.
  - The form's errors work: a missing name, and a mobile number that isn't 10 digits.
  - After adding, focus goes back to the witness field.
  - The sheet reads "Deposition of CW-1, court witness"; once signed, the tab reads
    "CW-1 · Village Officer, Thevally".
  - The complainant then shows PW-1, given at signing.
  - Added witnesses are still there after a reload.
  - h-241 doesn't list the complainant twice.
- Checked at 390px (no overflow) and in dark mode. `npm test`: 1414 pass.

### Recorded statements rename and type dropdowns (2026-10-28)

Checked on the owner's dev server (localhost:3000, this checkout, branch
`feature-witness-deposition`) in the IDE browser, on ST/254/2026 → Recorded statements:

- Switch label reads Recorded statements; empty state is one Record a statement button.
- Draft shows Statement type + person dropdowns; type options are Witness deposition,
  Evidence of the complainant, Examination of the accused.
- Choosing Examination of the accused relabels the person field to Accused.
- `npm test`: 1415 pass. This check was the agent's own, not an independent review.

### Witness mark as dropdown (2026-10-28)

Checked headless against localhost:3000 (this checkout) on h-254, ST/254/2026, as the typist:

- Before a witness is chosen, the field is disabled and reads "Choose the witness first".
- After Priya Menon is chosen, it reads Prosecution (complainant) PW-1. The list shows PW-1 / DW-1 /
  CW-1. Choosing Defence changes the field to DW-1.
- The Add a witness dialog has no "Witness for".
- Checked at 1440px and 375px. At 375px the list fits. Dark mode not checked: the capture
  ran in light mode.
- `npm test`: 1416 pass, including distinct held marks. eslint, tokens, ui-sync and table-rows pass.
  The typography and spacing gates fail only on advocate files this change doesn't touch.
  This check was the agent's own, not an independent review.

### Add a witness beside the label (2026-10-28)

Checked headless against localhost:3000 (this checkout) on h-254, as the typist, at 1440px
and 375px, light mode:

- The link is at the right of the Witness label. The Witness and Witness mark as boxes
  line up (both at y 430.5 at 1440px). At 375px the fields stack, and the link stays on
  the label row.
- The list shows only Priya Menon · complainant and Sabari Textiles · accused.
- The link opens the Add a witness dialog. Closing it returns focus to the Witness dropdown.
- eslint and tsc report nothing new in this file. Dark mode not checked. This check was
  the agent's own, not an independent review.

### Shared shortcuts panel (2026-10-28)

Checked headless against localhost:3000 (this checkout) on h-254, as the typist, at 1440px
and 375px:

- Order → Shortcuts shows All shortcuts (14) beside New shortcut. At 375px they stack.
- Insert on "Case transfer" closes the window. "The case is transferred to another court for
  further proceedings." is now on the order page, below Attendance.
- Recorded statements → Shortcuts shows the same panel.
- `npm test`: 1417 pass, including `appendShortcut`. tsc (source), eslint, tokens and ui-sync
  pass. Typography and spacing report nothing in these files. This check was the agent's
  own, not an independent review.

### Help above the person dropdown (2026-10-27)

Checked on the owner's dev server (localhost:3000, this checkout, branch
`feature-witness-deposition`) in the IDE browser, light theme, desktop width, on
ST/254/2026 → Examinations → a new deposition:

- The hint is between the Witness label and the "Choose the witness" dropdown.
- Review and sign with nobody chosen shows "Choose the witness." under the dropdown,
  and the hint stays above it.
- The accused field uses the same order (hint, then the dropdown). Seen on an
  examination of Sabari Textiles before that draft was no longer on the hearing.
- A 375px capture did not apply: the viewport override left the tab at desktop width.
  The field is one column, so the order is the same when the page is narrow.
- The field itself was not captured in dark theme. Switching the page to dark happened
  after the draft was already gone. Light was restored.
- This check was the agent's own, not an independent review.

Not built or open:
- Whether an added witness joins the case's Parties tab.
- The case page's way in outside a hearing.
- A line in the order text naming the evidence taken (Anshumanth's question 4).
- Signed records reaching the magistrate's Sign witness deposition queue, which is
  static data today.
- Recording of plea.
- PRD role gating.
- Earlier records from past hearings, for a witness whose evidence continues.
- A warning before Send for signing or Next case while something is unsigned.
- In the Shortcuts dialog, Insert adds the text at the end, not at the caret. The
  "Saved" text is static.
- Questions for Anshumanth:
  - One sheet per sitting, or one that grows across sittings?
  - Who may record and sign?
  - Should an unsigned record block anything?
  - Are complainant evidence and a witness one tool?
  - Can the court add a witness here?
  - Should exhibits be marked from here?

### Advocate-side build (2026-10-26, since removed)

Checked 2026-10-26 on the owner's dev server (localhost:3000, this checkout, branch
`feature-witness-deposition` from `a2c881c7`, DS pin `e0cadea6b9d4`), headless Chromium:

- Witness flow end to end at 1440px: menu, picker, errors, `/cr` grey suggestion and ↓,
  Tab inserting with the blank selected, blank gate, sheet, OTP, done, Documents row as
  Pending review, its record. No page errors.
- Accused flow: `/acc`, link stage with its error, "Sent to sign" outcome, no row added.
- Close with unsaved text asks Save as draft / Discard; a saved draft comes back.
- 375px compose and menu; dark mode compose.
- ESLint clean on changed files; `check:tokens`, `check:ui-sync`, `check:table-rows` pass;
  `check:typography` and `check:spacing` fail only on files outside this change
  (pre-existing). `npm run verify:ui` stops at ESLint errors in `src/provakil/`
  (pre-existing).
- Review was the agent's own, not independent.

Open:
- Who records it: 1.0's demo used a court login; built for the advocate per Neer.
- The accused's pending-signature examinations are visible nowhere after the link is
  sent; a place for "waiting on the accused" is undecided.
- The record has no rendered sheet (no file) until a PDF is generated.
- Shared shortcuts with the order screen vs a separate list; auto-filling case facts.
- Mohit works in the same case-page files; coordinate before merging.
