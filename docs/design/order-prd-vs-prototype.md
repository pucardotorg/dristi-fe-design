# Order generation PRD vs the prototype

**Status:** 2026-10-20. A review only: it compares, and changes nothing. The spec is
`order-generation.md` (dristi-be/PRDs) v8.1 (2026-10-19), with
`court-roles.md` (dristi-be/PRDs) v9 and the three order tasks in
`pending-task-drafts.md` (dristi-be/PRDs). The prototype is
`Pucar-Dristi-2.0` on `origin/main` at `d14f815`, which already includes PR #129 (Classic
flow and screens A–D removed) and PR #127 (Case history tab). File paths below are relative
to `Pucar-Dristi-2.0/apps/dristi-app/src/`.

**Readers.** The owner decides from the summary, §3 and §4. A developer builds from the
tables in §2.

**Work already under way.** Two sessions worked on parts of this. Both are merged into the
same pull request as this report (`feature/order-prd-alignment`), which replaces PRs #130
and #131. Rows they cover are marked *In progress*; read them as *addressed in this PR*.

| Session | Was | Covers |
|---|---|---|
| overview-case-history | PR #130, `feature/overview-shared-case-history` | `CLS-11`: the overview reuses the order screen's Case history, and adds Pass over and Data flags |
| align-prototype-hearing | PR #131, `feature/cause-list-hearing-controls` | `HRG-*`, `CLS-02`, `CLS-06`, `CLS-07`, `CLS-09`, `CLS-10`, `CLS-12` |

---|---|---|---|
| overview-case-history | `feature/overview-shared-case-history` | None yet: the branch has no commits beyond `main` | `CLS-11`: the overview reuses the order screen's Case history, and adds Pass over and Data flags |
| align-prototype-hearing | `feature/cause-list-hearing-controls` | None yet: the branch has no commits beyond `main` | `HRG-*`, `CLS-02`, `CLS-06`, `CLS-07`, `CLS-09`, `CLS-10`, `CLS-12` |

`gh pr list --repo pucardotorg/dristi-fe-design` shows nothing open. The latest merged PRs
are #127–#129.

---

## 1. Summary

The prototype has the right **shape**. It has order screen E with Order and Order data
views, a page with a fixed heading and signature block, `/` shortcuts, Send for signing,
Pending orders with signature and order-data pills, triggering once both are done, and a
cause list with configurable columns and bulk actions. Most of the Order view and the
order-item picker already match.

It predates most of the 19–20 October rewrite. The gaps cluster in five places:

1. **Roles are staff titles, not roles.** Every gate reads a seat: `magistrate`,
   `bench-clerk`, `typist` or `scrutiny-officer`. "The steno fills, the magistrate signs"
   is wired in. It should read the six PRD roles, assigned per state as in court-roles §3.
   This one change decides who sees hearing controls, the Next hearing column, bulk mode,
   signing, filling, moving back to draft, and the Pending orders count.
2. **Pending orders has the old stage model.** *Order data to fill* holds only signed
   orders. The PRD has it run alongside *Awaiting signature*, with an order in both tabs at
   once. Sending for signing again keeps "complete". No pending tasks exist.
3. **Signing.** Pending orders signs with a bare confirmation: no choice of Aadhaar e-sign
   or DSC, and bulk signing of any number. The PRD makes Aadhaar one order at a time and
   bulk signing DSC-only.
4. **Missing from the order.** It has no title. There is no A-Diary text option. Attendance
   has no *not required*, lists one party per side and no PoA holders, and is not required
   before sending. A draft cannot be discarded.
5. **Order data still runs on template text.** Order items carry sentences and
   locked/optional variables. Any blank in that sentence blocks adding the item and marking
   the order data complete. The PRD has no template text, and only *mandatory to enter*
   fields block anything.

The cause list's hearing model is the other large gap. It has one Ongoing hearing at a
time, Passed over cannot be restarted, there is no grouping by status and no times are
recorded. Most of that is *In progress*. The **Next case** button is not: it still ends this
hearing and starts the next.

**Counts by status:**

| Status | Rows |
|---|---|
| Missing | 16 rows |
| Differs | 34 rows |
| In progress | 8 rows |
| Matches | 57 requirements, counted per section |

A row can cover several IDs. Three rows (`HRG-00`, `HRG-08`, `HRG-10`) may fall under the
`HRG-*` work in progress; that needs confirming with the session.

The 15 extras are in §3, and the 16 open questions are in §4.

---

## 2. Section by section

### §1 Context, §2 Where the screen is used

Matches: 9 (`ORD-01`–`ORD-05`, `ORD-07`, `ORD-09`, `ORD-10`, `ORD-10a`).

| ID | PRD says | Prototype does | Change needed | Status |
|---|---|---|---|---|
| `ORD-06` | Opened from the case (*New order*), or from the work that calls for an order | Doors exist for a hearing, cognizance and an application only (`components/employee/order-door-screen.tsx:41-44`). There is no *New order* on a case | Add *New order* from the case | Missing |
| `ORD-08` | Outside a hearing, the next hearing defaults to the hearing the case is listed for. Changing it adds a *Rescheduling of hearing date* item, with the old and new dates filled | Outside a hearing the next hearing opens blank (`lib/employee/order-draft.ts:115-123`). Only a door's *Scheduling* item is folded into it (`lib/employee/order-door.ts:40-61`). Nothing adds a Rescheduling item | Default to the listed hearing; on change, add the Rescheduling item with both dates | Differs |
| `ORD-10a` | Pre-added items can be removed | Every door passes `fixedIds: []`, so all items can be removed. The code path that made them unremovable remains (`components/employee/order-items.tsx:118`, `order-editor.tsx:578`) | Remove the dead "fixed" path | Matches; tidy-up only |

### §3 Roles

| ID | PRD says | Prototype does | Change needed | Status |
|---|---|---|---|---|
| `ROL-01`–`ROL-05` | Six roles. A person holds any mix and sees the controls for each role they hold. No staff title holds a permission (`RLE-08`) | `CourtRole` is four seats named by title (`lib/employee/content.ts:17-21`), picked in Court settings › Working as. Gates are by title: the typist fills, the magistrate signs (`pending-order-screen.tsx:196-201`, `pending-orders-screen.tsx:119-120`); anyone but the typist gets hearing controls, the scrutiny officer included (`lib/employee/court-role.ts:64-66`); only the bench clerk sets the next hearing (`court-role.ts:74-76`) | Model the roles as a set held by the signed-in person. Seed each seat from court-roles §3 per state. For example, the Kerala Typist holds Order drafter, Order data filler and Next hearing setter, and the Magistrate holds Hearing controller and Next hearing setter too. Every gate below then reads a role | Differs |
| `ROL-06` | Enforced server-side. Without the role, a person sees the control read only | Gates are "a view rule, not a permission" (`court-role.ts:11-14`). Most controls are hidden rather than shown read only | Show read only, not hidden. Server enforcement is the backend's | Differs |

Copy names titles in several places: "goes to the magistrate" (`order-editor.tsx:990`),
"the steno has completed it" (`pending-order-screen.tsx:370-371`, `pending-orders-screen.tsx:421-422`).
Change it to role-neutral wording (`RLE-08`). The Punjab & Haryana label maps the scrutiny
seat to "Ahlmad" (`content.ts:50-54`), but court-roles §3.3 has Ahlmad as Order data filler.

### §4 The screen

Matches: 7 (`ORD-11`, `ORD-12`, `ORD-16`–`ORD-20`). `ORD-13` (the page is the signed PDF's
rendering) cannot be tested, because the prototype produces no PDF.

| ID | PRD says | Prototype does | Change needed | Status |
|---|---|---|---|---|
| `ORD-15` | Side panel tabs: Case file, Case history (last order highlighted, filter to orders), Data flags | All three tabs exist (`order-case-panel.tsx:194-213`). Case history is given only on a hearing's order. Cognizance and application orders get none (`order-door-screen.tsx:171-175`) | Give Case history on every order of a case | Differs |

### §5 The order text, §5.1 Shortcuts, §5.2 Title

Matches: 10 (`TXT-01`, `TXT-03`, `TXT-05`, `TXT-06`, `SHC-01`–`SHC-05`, and `TXT-04` apart
from the A-Diary text, which is under `PUB-04`).

| ID | PRD says | Prototype does | Change needed | Status |
|---|---|---|---|---|
| `TXT-02` | Paragraphs, numbered and **lettered** lists, emphasis, tables; toolbar stays in view | Bulleted and numbered lists only (`components/cases/rich-text-field.tsx:124-127`). Tables and the sticky toolbar are there | Add lettered lists | Missing |
| `SHC-06`, `SHC-07` | Saved per **courtroom**. Any order drafter maintains the set. No personal shortcuts | Kept in localStorage, "per person and per device" (`lib/employee/order-shortcuts.ts:17-20`). Not gated by role. Seeded from the catalogue's template sentences (`order-shortcuts.ts:38-45`) | Key the set to the courtroom. Offer it to order drafters. Seed it without template text (see §3, item 1) | Differs |
| `TIT-01`, `TIT-02` | Every order has a title, taken from its order items and editable | Nothing. The draft has no title field (`order-draft.ts:92-114`) | Add a title, derived from the items and editable | Missing |
| `TIT-05` | Editable until triggered, then fixed | No title | Follows `TIT-01` | Missing |
| `TIT-06` | Lists show the title | Pending orders shows the cause title (`pending-orders-screen.tsx:288`) | Show the order's title | Missing |

### §6 The order data

Matches: 8 (`ITM-01`–`ITM-03`, `ITM-05`, `ITM-07`–`ITM-09`, `VAR-07`). `VAR-01`, `VAR-02`,
`VAR-04` and `ITM-12` were not checked field by field.

| ID | PRD says | Prototype does | Change needed | Status |
|---|---|---|---|---|
| `ITM-04` | Contextual (accept/reject) items can be found and chosen like any other, then ask which application | Contextual items are left out of browse and search (`lib/employee/order-templates.ts:899-901`). Their reason reads "Comes from an application" (`:889-890`) | Offer them in search and categories, and ask for the application before adding | Differs |
| `ITM-06` | Several of the same item are allowed, unless configuration restricts it | The order data panel allows it. Bulk add refuses any item "Already in this order" (`lib/employee/order-bulk-items.ts:47-50`) | Apply only the configured restrictions in bulk too | Differs |
| `ITM-10` | From Pending orders, the filler selects **hearing** orders and adds items to each. Fields are filled order by order | Only signed orders in *Order data to fill* can be selected, of any origin (`pending-orders-screen.tsx:121-128`). Orders awaiting signature cannot be. Items are added unfilled, which matches | Allow hearing orders in either open stage (see §4, Q9) | Differs |
| `VAR-03` | Never guess a choice. Fill a party only where there is exactly one candidate | Every required party field opens on the first side not taken (`lib/employee/order-composer.ts:252-264`) | Leave it unanswered when there is more than one candidate | Differs |
| `VAR-05`, `VAR-06` | Only *mandatory to enter* fields block completion. Any other field may be left blank. No locked or optional variables | *Add to order* is disabled while any blank remains (`order-items.tsx:579`). A blank is a required field **or** any field that fills a template slot (`order-composer.ts:396-399`). Mark complete refuses on the same blanks (`pending-order-screen.tsx:205-216`). Items still carry `locked` and `optional` lists (`order-templates.ts:75-81, 143-144`) | Block only on `required`. Allow adding an item with blanks. Remove the slot logic and the locked/optional lists | Differs |
| `APL-01` | The order data lists pending applications under the items | Listed only on a hearing's order (`order-door-screen.tsx:168`) | List them on every order of the case | Differs |

### §7 The draft

Matches: 2 (`DFT-01`, `DFT-07`).

| ID | PRD says | Prototype does | Change needed | Status |
|---|---|---|---|---|
| `DFT-02` | Concurrent editing ideally blocked, with least effort | Not handled. One browser, and cross-tab saves overwrite | Leave to the build team. For the prototype, nothing, or a note on the seam | Missing (backend) |
| `DFT-03` | Several drafts may stand open on one case | One draft per hearing, per cognizance act and per application, keyed by those (`lib/employee/pending-orders.ts:27-30`). There is no way to start a second | Comes with *New order* (`ORD-06`), with one draft per press | Differs |
| `DFT-04` | Saved on the server, not in the browser | localStorage (`pending-orders.ts:32-34, 92`) | Expected in a front end with no server. Keep the seam documented | Differs (backend) |
| `DFT-05` | Listed under *Drafting* once **created**, through a *Draft order* pending task | Listed once the text has words (`order-editor.tsx:763-774`). No task | List it on creation (see Q12). Model the task, `§15` | Differs |
| `DFT-06` | The order drafter may discard a draft | No Discard on screen E or in Pending orders | Add Discard, with confirmation. It releases any provisional date (`NXT-13`) | Missing |

### §8 Sending for signing

Matches: 2 (`SND-02`, `SND-04`).

| ID | PRD says | Prototype does | Change needed | Status |
|---|---|---|---|---|
| `SND-01` | Confirmation says it goes to the **order signer** | "It goes to the magistrate in Pending orders" (`order-editor.tsx:990`) | Role wording | Differs |
| `SND-03` | Next hearing settled, and **in a hearing, attendance complete** | Checks the text and the next hearing only (`order-editor.tsx:776-791`) | Also refuse while anyone on the roll is unmarked (`ATT-04`) | Differs |
| `SND-05` | The order drafter moves it back to draft before signing | The editor offers it to any seat (`order-editor.tsx:945-963`). Pending orders offers it only to the typist (`pending-order-screen.tsx:201`) | Gate on order drafter in both places | Differs |
| `SND-06` | **Editing the text** puts complete order data back to incomplete | Also triggered by changing attendance or the next hearing on the page (`order-editor.tsx:887`) | Reset only on text edits, unless the owner says otherwise (Q11) | Differs |
| `SND-07` | Sending creates two tasks, Sign order and Fill order data, worked in parallel | No tasks. The stage is derived from flags (`pending-orders.ts:208-217`) | Create both, see `PND-02` and `§15` | Missing |
| `SND-08` | Moving back clears both tasks. Sending again recreates them and puts complete order data back to **not complete**, keeping values | Moving back keeps `workflowComplete` (`pending-orders.ts:173-178`), and so does sending (`:158-170`) | On send-again, set `workflowComplete: false` | Differs |

### §9 Attendance and the next hearing

Matches: 5 (`PLC-02`, `ATT-03`, `NXT-01`, `NXT-02`, `NXT-04`). `NXT-03` matches inside a
hearing; outside one, see `ORD-08`.

| ID | PRD says | Prototype does | Change needed | Status |
|---|---|---|---|---|
| `PLC-04` | Court setting `nextHearingEntry`: *on the cause list* (default) or *in the order*. Whoever enters it must hold Next hearing setter | Values are `"reader"` and `"steno"`, labelled by staff title (`lib/employee/next-hearing-entry.ts:17-28`). Stored per browser. The cause-list column goes to the bench clerk only. In-order fields are editable by any seat | Rename the values to the two places. Gate on the role. Hold it as the court's setting | Differs |
| `ATT-01` | Every complainant, every accused, every PoA holder; one advocate line under each party that has counsel | One complainant and one accused, from `hearing.parties[side]`, with one counsel line per side. No PoA holders (`order-draft.ts:61-87`) | Build the roll from all parties and PoA holders, with an advocate line under each represented party | Differs |
| `ATT-02` | Present, absent or **not required**. Unmarked may default to not required. One action marks everyone present | Present and absent only. Pressing again clears (`order-draft.ts:35`, `order-sections.tsx:204`). *Mark all present* matches (`order-editor.tsx:513-522`) | Add not required, or the default to it (the PRD allows either) | Differs |
| `ATT-04` | Attendance complete before sending for signing | Not checked | See `SND-03` | Missing |
| `NXT-10`, `NXT-13`, `NXT-14` | A date on a draft makes a provisional listing, which moves with the date, is released on discard, and becomes the hearing when triggered | None | Mostly backend. The prototype can count draft dates in the load (`NXT-11`) | Missing |
| `NXT-11`, `NXT-12` | Every day-load view counts provisional listings, shown apart from confirmed ones | The cause-list calendar counts that sitting's cause-list postings (`lib/employee/listing-load.ts:1-9`). The order page's date picker shows no load (`order-sections.tsx`, `OrderDatePicker`). Nothing is marked provisional | Show load on the order's picker. Count draft dates. Mark them provisional | Missing |

### §10 Hearings

Matches: 1 (`HRG-03`).

| ID | PRD says | Prototype does | Change needed | Status |
|---|---|---|---|---|
| `HRG-00` | Hearing controls only for the hearing controller, only on the cause list. The order screen has only Next case | Seat-gated (`court-role.ts:64-66`). The order screen's header button ends this hearing and starts the next (`order-screen.tsx:95-104`). With none left it reads **End hearing** (`:126`) | Remove the hearing control from the order screen. Gate on the role | Differs; may fall under `HRG-*` in progress, so confirm with that session |
| `HRG-01`, `HRG-02`, `HRG-04`, `HRG-05`, `HRG-06`, `HRG-07` | Five statuses; Passed over is restartable the same day and sits last; Abandoned at midnight; several Ongoing; bulk end and pass over | "Completed" not "Heard", plus a "Rescheduled" status (`lib/employee/hearings.ts:42-60`); Start on Scheduled only (`:130-132`); a single `ongoingId`, "one cause at a time" (`lib/employee/hearing-session.ts:30-31`); Abandoned only in fixtures | As listed in the session's brief | In progress |
| `HRG-08` | Every start, pass over, end and abandonment is timed; heard time = the sum of Ongoing periods | The session holds ids only (`hearing-session.ts:29-40`) | Record a timestamp per transition | Missing; may be inside `HRG-*` in progress |
| `HRG-09` | The order opens once the hearing is started; the draft stays reachable after end or pass over | The typist seat can open it on Scheduled (`hearings.ts:175-177`). A Passed over listing's Orders control is disabled even when it has a draft (`hearings-table.tsx:545-549`) | Open only after start. Keep the draft reachable on Passed over | Differs |
| `HRG-10` | Next case opens the next **Ongoing** hearing, is disabled while there is none, names its item number, and updates live | Targets the next **Scheduled** listing by item number (`order-draft.ts:283-294`). Ends and starts hearings. Never disabled. No item number. Live updates match | Rebuild as described | Differs; may be inside `HRG-*` in progress |

### §10.1 The cause list screen

Matches: 3 (`CLS-01`, `CLS-03`, `CLS-04`).

| ID | PRD says | Prototype does | Change needed | Status |
|---|---|---|---|---|
| `CLS-02` | Grouped by status, then by the generated sequence | Flat list with a sort select (`hearings-screen.tsx:101-105`) | Group by status | In progress |
| `CLS-05` | Column choice sticky **per person** | Keyed by seat and setting in this browser (`use-cause-list-columns.ts:18-23`). The bench clerk's default hides Status and Orders (`cause-list-columns.ts:95-119`) | Key by person. Review the defaults | Differs |
| `CLS-06` | Offer by role | Offer by seat (`cause-list-columns.ts:88-89`, `hearings-screen.tsx:178-183`) | Read roles | In progress |
| `CLS-07` | Filters on any column, including Orders and Next hearing; Status multi-select | Status pills are single choice. No Orders or Next hearing filter (`hearings.ts:836-845`) | As described | In progress |
| `CLS-08` | Start on Scheduled **or Passed over**. Orders column shows draft or recorded | Start on Scheduled only. "Recorded" means `status === "completed"`, not the order's state (`hearings-table.tsx:555`) | Allow Start on Passed over. Read the order's real state (Q5) | Differs; Start may be inside `HRG-*` |
| `CLS-09` | Bulk mode for a hearing controller or an order drafter | Bench clerk with the reader setting, or the typist (`hearings-screen.tsx:178-183`) | By role | In progress |
| `CLS-10` | One dialog; End needs Scheduled or Ongoing; ending a Scheduled listing starts and ends it at the same time | Bulk End also takes Passed over (`cause-list-bulk.tsx:181-182`). No start is recorded. The next-hearing half is not separately gated | As described | In progress |
| `CLS-11` | Overview with the order screen's Case history, Data flags, and Pass over in the foot | Its own `CaseHistoryPanel` and a Last hearing panel (`hearing-overview-screen.tsx:322-345, 747+`). No Data flags. No Pass over (`hearings-screen.tsx:520-536`). View case always opens `c-1001` (`hearing-overview-screen.tsx:372-376`) | As in the brief. Also fix View case to open this listing's case | In progress, apart from View case: Differs |
| `CLS-12` | An order drafter adds the same text to several orders | Typist seat only (`hearings-screen.tsx:181`). Otherwise matches (`cause-list-bulk.tsx:524-598`) | By role | In progress |

### §11 Pending orders

Matches: 2 (`PND-05`, `PND-08`).

| ID | PRD says | Prototype does | Change needed | Status |
|---|---|---|---|---|
| `PND-01` | Every order, from its first text until triggered | From the first words, which matches, but also keeps the *Triggered* tab, which the PRD lists as a stage | None, beyond `DFT-05` | Matches |
| `PND-02` | Once sent for signing: in *Awaiting signature* until signed **and** in *Order data to fill* until complete, both at once | One stage per order. *Order data to fill* holds only signed orders (`pending-orders.ts:208-217`) | Make the two tabs independent, so an order sits in both while both are open | Differs |
| `PND-03` | Row: title, case, origin, a signature column and an order data column | Cause title instead of title. Both pills in one Status column (`pending-orders-screen.tsx:311-331`). Origin matches | Add the title. Splitting the column is a design choice | Differs |
| `PND-04` | Opens on the viewer's move. The nav count is the orders at that stage | By seat: magistrate → Awaiting signature, typist → Order data to fill (`pending-orders-screen.tsx:74-78`, `pending-orders.ts:233-249`) | By role (see Q13 for someone holding both) | Differs |
| `PND-06` | A signer **with a DSC** signs several at once | Bulk sign for the magistrate seat, with no instrument (`pending-orders-screen.tsx:378-443`) | See `SGN-03`–`SGN-06` | Differs |
| `PND-07` | Filler adds the same items to several hearing orders | See `ITM-10` | — | Differs |

### §12 Signing

Matches: 2 (`SGN-02`, `SGN-04`). The `SGN-02` text names "the steno"; see §3 copy.

| ID | PRD says | Prototype does | Change needed | Status |
|---|---|---|---|---|
| `SGN-01` | Only an order signer | Magistrate seat only (`pending-order-screen.tsx:197`) | By role | Differs |
| `SGN-03`, `SGN-05`, `SGN-06` | Signer chooses Aadhaar e-sign or DSC. Aadhaar signs one order at a time. Bulk needs a DSC | Pending orders signs on a plain confirmation, one or many (`pending-order-screen.tsx:364-389`, `pending-orders-screen.tsx:410-443`). The old Sign orders flow has Aadhaar, DSC and paper, and signs a whole batch with one Aadhaar OTP (`sign-order-flow.tsx:270-279`) | Put the instrument choice into Pending orders. Allow bulk only with DSC. Aadhaar signs one at a time | Missing |

### §13 Completing and triggering

Matches: 4 (`CMP-01`, `CMP-04`, `CMP-05`, `CMP-06`). All four are gated by the typist seat;
see `ROL`.

| ID | PRD says | Prototype does | Change needed | Status |
|---|---|---|---|---|
| `CMP-02` | Mark complete is refused only for an unanswered mandatory field. It names what is missing and where | Refused for any blank (see `VAR-05`). Also refused for an unset next hearing and an undated postponement (`pending-order-screen.tsx:217-253`). The message names the item, not the field | Check mandatory fields only. Name the field. The extra checks are in §3, item 9 | Differs |

### §14 Once triggered

Matches: 1 (`PUB-06`). `PUB-01`–`PUB-03` and `PUB-05` cannot be tested: there is no
numbering, PDF, trigger order or stage listener.

| ID | PRD says | Prototype does | Change needed | Status |
|---|---|---|---|---|
| `PUB-04` | Order data view: *The A-Diary text and order text are the same*, checked by default. Unchecking lets the A-Diary text be typed. Set by the order data filler. Shown cut at about a paragraph | Nothing in the order screen or Pending orders | Add the option and the text field to Order data, under pending applications (§6 order) | Missing |
| `PUB-07` | The next hearing is announced when triggered | No announcement. Ties to `NXT-10`–`NXT-14` | Backend; the prototype could say so on trigger | Missing |

### §15 Pending tasks

| ID | PRD says | Prototype does | Change needed | Status |
|---|---|---|---|---|
| §15 | Draft order, Sign order and Fill order data tasks, as a view of the court-side Pending Tasks list | No court-side pending tasks exist. Pending orders reads flags directly | Model the three tasks and their open/close triggers (pending-task-drafts §1–3). Pending orders then reads them | Missing |

---

## 3. Extra in prototype

| # | What | Where | Recommendation |
|---|---|---|---|
| 1 | **Template text on order items**: each item's sentence (`botd`), slots, conditional clauses, locked/optional variable lists, and the dialog's "In the order" sentence (off in E but still in code) | `lib/employee/order-templates.ts:131-157`, `order-items.tsx:514-519, 548-557` | **Remove.** The PRD dropped template wording from scope. The slots are what make blanks block (`VAR-05`) |
| 2 | **Trigger summary** in the Mark complete dialog, listing attendance, next hearing, each item's workflow and each application | `pending-order-screen.tsx:393-412, 471-523` | **Ask the owner.** `CMP-03` (summary of what triggering will do) was removed in v8.1 |
| 3 | **Old Sign orders screen**: `/employee/sign-orders`, its Draft orders tab and the `SignOrderFlow` (Aadhaar, DSC, paper; Aadhaar signs a batch) | `app/employee/(court)/sign-orders/page.tsx`, `sign-orders-screen.tsx`, `sign-order-flow.tsx` | **Remove the screen. Reuse the instrument step in Pending orders** (`SGN-05`). Hidden from every seat's nav (`navigation.ts:540-565`) but still routed |
| 4 | **The application workstation's own order path**: sign or discard a draft "before the order screen took over" | `application-workstation.tsx:767-889` | **Ask the owner** whether it is still a way in. If kept, it should open screen E |
| 5 | **Per-person shortcuts**, kept in this browser | `order-shortcuts.ts:17-20` | **Remove** the per-person model (`SHC-07`) |
| 6 | **Next case ends and starts hearings** | `order-screen.tsx:95-104` | **Remove** (`HRG-00`, `HRG-10`) |
| 7 | **Statuses "Completed" and "Rescheduled"** | `hearings.ts:42-60` | **Remove** or rename to Heard. In progress |
| 8 | **User sort** on the cause list (by name, newest) | `hearings-screen.tsx:101-105` | **Ask the owner** (Q4) |
| 9 | **Extra completion checks**: next hearing set, and a date for an accepted postponement or advance | `pending-order-screen.tsx:217-253` | **Ask the owner.** The next-hearing check repeats `SND-03`. The postponement check is not in the PRD |
| 10 | **Bulk "Already in this order"** rule | `order-bulk-items.ts:47-50` | **Remove** (`ITM-06`) |
| 11 | **Typist opens the order on a Scheduled listing** | `hearings.ts:175-177` | **Remove** (`HRG-09`) |
| 12 | **Last hearing panel** in the overview | `hearing-overview-screen.tsx:322-345` | **Remove**: the changelog replaces it with Case history. In progress |
| 13 | **"This sitting" row and a disabled Join VC button** | `hearing-overview-screen.tsx:429-460`, `hearings-screen.tsx:660-674` | **Ask the owner.** Not in `CLS-11`; harmless |
| 14 | **Hearing date filter** in place of a date chooser | `hearings-screen.tsx:628-639` | Fits `CLS-01` (chosen by date). **Keep** |
| 15 | **Paper signing** as a third instrument | `sign-order-flow.tsx:86-90` | **Ask the owner.** `SGN-05` names only Aadhaar and DSC |

---

## 4. Can't tell

These are places where the PRD is silent or ambiguous, so the change cannot be decided yet.

1. **`APL-02`.** The prototype's actions on a pending application are Allow and Dismiss
   (`listing-application-dialog.tsx`). application-lifecycle.md owns them. Are those the
   right actions?
2. **`ORD-08`.** Outside a hearing, what does the next hearing default to when the case has
   no hearing listed, for example at cognizance?
3. **`HRG-10`.** With several hearings Ongoing, which is "the next": the next by item
   number after this one, wrapping round, or something else?
4. **`CLS-02`.** May a person re-sort within the status groups, as the prototype's sort
   allows, or is the generated sequence fixed?
5. **`CLS-08` / `CLS-07`.** What does "recorded" mean in the Orders column and filter:
   sent for signing, signed, or triggered?
6. **`CLS-12`.** Can bulk text go on listings not yet started, when `HRG-09` says an order
   opens only once the hearing has started?
7. **`CLS-10`.** For someone who holds Hearing controller but not Next hearing setter (or
   the reverse), does the dialog show only the half they hold?
8. **`PLC-04`.** "Each court chooses": a courtroom or the court establishment (`RLE-00`)?
9. **`ITM-10` / `PND-07`.** "Hearing orders" in which stages: drafting, awaiting
   signature, signed but not triggered? The prototype allows signed only.
10. **`TIT-02`.** How the title follows items as they are added, reordered and removed is
    "left to the design". A design decision is needed before it can be built.
11. **`SND-06`.** Does changing attendance or the next hearing on the page count as
    "editing the text"? They print on the order but are order data.
12. **`DFT-05`.** When is a draft "created": on opening the screen, or on the first thing
    typed or entered? The prototype uses the first words of text.
13. **`PND-04`.** Which tab opens, and what is counted, for someone holding both Order
    signer and Order data filler?
14. **`CLS-11` / `ORD-15`.** Data flags are "not yet defined". Is a named empty tab what
    the owner wants until they are?
15. **`ATT-02`.** Should *not required* be a visible third choice, or only the default for
    anyone left unmarked? The PRD allows either.
16. **`ROL-06`.** Without a role, the PRD says "sees what that role would change, read
    only". On the cause list, does that mean showing every Action column read only to
    everyone?
