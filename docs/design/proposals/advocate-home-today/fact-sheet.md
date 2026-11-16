# Advocate Home: fact sheet

Status: groundwork, Nov 13 2026. Nothing here is a design. Every fact names where it lives on
`main` (worktree `dristi-advocate-dashboard`, branch `feature/advocate-dashboard-home`).

## 1. The principle (owner's words, condensed)

On the first visit of the day the advocate should know **how the day looks**. Home is a
**synthesis** of everything, plus an easy way in: act on a thing if they want, or go to the
page that owns it. Every other page is the detailed version of its own work. Home is not any
of those pages.

## 2. Constraints

| # | Constraint | What it means for Home |
|---|---|---|
| C1 | No AI | Every line is a fixed template filled from named fields. No generated prose. |
| C2 | Deterministic | Same data and same clock give the same screen, in the same order. Order uses one comparator. Ties break on id. |
| C3 | Backend-backed | Every statement maps to fields a service returns today or is specified to return. Anything else is marked **gap**. |
| C4 | Per viewer | Visibility and verbs come from the existing permission rules: `canView`, `verbFor` (`lib/tasks/permissions.ts`), `canSeeApplication` (`lib/cases/application-access.ts`). A clerk and a senior see different Homes on the same data. |
| C5 | Scales | Each statement is an aggregate with a fixed cap on examples. Its size does not grow with the data. 0, 1 and 300 items each have a defined shape. |
| C6 | Doors are real | Every door is a route that exists today, with its filter. |
| C7 | Time windows are fixed | Without a "last seen" record (gap G4), "new" means a fixed window, such as since 00:00 yesterday. |

## 3. What main can say about an advocate's day

Status key: **Model** = typed as a service contract, sandbox behind a seam. **Fixture** = hand-authored JSON for one demo case. **Simulated** = computed from the clock in the browser, no real source yet.

### Court

| Fact | Source | Status |
|---|---|---|
| Matters listed today, per court | `Case.nextHearingAt`, `Case.court` (`lib/tasks/types.ts`); `timelineOn`, `courtRooms` (`lib/advocate/home.ts`) | Model |
| Item number in the court's list | `HomeHearing.item`, **derived from time order** | Simulated (G2) |
| Heard, being heard, still to come | `statusOf`, a 90-minute window from the listed time | Simulated (G1) |
| Matters still ahead of mine | `queueOf` | Simulated (G1) |
| Passed over, and carried from which day | `Case.passedOver`, `Case.passedOverOn` | Model |
| Fixed time vs rough order | `Case.timeFixed` | Model |
| Next day with anything listed | `nextHearingDayAfter` | Model |
| Ready / not ready, and why | `HomeHearing.blockers` (open blocking tasks on the case), `HomeHearing.ready` | Model |

### Work owed (tasks)

| Fact | Source | Status |
|---|---|---|
| Open tasks this viewer can act on | `tasksInView(world, "needs-action")`, `railTasks` | Model |
| Kind: sign, pay, file, re-file, review, hearing, draft | `Task.kind` | Model |
| Why it exists (the order, notice or return) | `Task.why.event`, `Task.why.at` | Model |
| Deadline and what set it | `Task.dueAt`, `Task.dueKind`: statutory, court-set, before-hearing, none | Model |
| Overdue | `isOverdue` (`lib/tasks/urgency.ts`) | Model |
| Blocks a hearing, and which | `Task.isBlocking`, `Task.hearingAt` | Model |
| Prepared by someone else, waiting for the signatory | `Task.status = ready`, `Task.prepared.by`, `.at` | Model |
| A decision addressed to me | `Task.kind = review`, `Task.review.of` | Model |
| Amount and fee head | `Task.amountPaise`, `Task.feeHead` | Model |
| Deadline moved with the hearing | `Task.redate` | Model |
| One order for every list | `compareUrgency`: overdue, then blocking an upcoming hearing, then next consequence date, then id | Model |

### Applications (yours and the other side's)

| Fact | Source | Status |
|---|---|---|
| Status from draft to decision | `FilingStatus` (`lib/cases/applications.ts`) | Model |
| Waiting on my signature or payment | `applicationStepFor` | Model |
| My clerk's draft waiting on me | `waitingOn`, `Submission.createdById` | Model |
| Decision date | `Submission.decisionOn` | Model |
| Other side's application: visible **only once the court onboards it** (ALC-17) | `canSeeApplication` | Model |
| Objection invited, due midnight the day before the decision (ALC-13) | `objectionInvitations` | Model, but **not a task** (G5) |
| Demo data for all of the above | `applications-dummy.json`, one case, `isDummyData: true` | Fixture (G3) |

### Cases

| Fact | Source | Status |
|---|---|---|
| Stage and substage | `CaseRecord.stage`, `.substage` (`lib/cases/types.ts`) | Model |
| Last change on the case, with a plain note | `CaseRecord.updatedOn`, `.latestUpdate` (free text) | Model (G6) |
| Next hearing and its purpose | `CaseRecord.nextHearing.on`, `.purpose` | Model |
| Long pending | `CaseRecord.longPending` | Model |

### Process and service

| Fact | Source | Status |
|---|---|---|
| Summons or notice per person, per channel: sent, delivered, not delivered | `ProcessChannel.status`, `.statusOn` (`lib/cases/process-status.ts`) | Model, channel list unconfirmed (open question SVC-15) |

### Vakalatnama

| Fact | Source | Status |
|---|---|---|
| Where a vakalatnama is: executant sign, advocate accept, attestation, payment, executed | `VakStatus` (`lib/vakalatnama/types.ts`) | Model, browser store |
| Has this advocate accepted | `Advocate.accepted` | Model |

## 4. Where the synthesis comes from: facts that join

Synthesis is not a summary of each page. It is a **join** across them. These joins exist in the data.

| Join | Key | The sentence it makes possible |
|---|---|---|
| Hearing + blocking task | `Task.caseId` = the listed case, `isBlocking`, open status (`blockersOf` in `lib/advocate/home.ts`; it does not check `hearingAt`) | "Item 14 in Court A can't go ahead: process fee unpaid" |
| Task + who prepared it | `Task.prepared.by` to `Person` | "2 things Rahul prepared are waiting for your signature" |
| Other side's application + its decision date + your objection window | `Submission.decisionOn`, `objectionDeadline` | "Objection to the discharge application due Thursday; decided Friday" |
| Application decision date + the hearing that day | `decisionOn` = `Case.nextHearingAt` day | "Your bail application is decided at tomorrow's hearing" (needs G3) |
| Statutory deadline + today | `Task.dueKind = statutory`, due today | "A statutory window closes today" |
| Case change + recency | `CaseRecord.updatedOn` within the window | "3 of your cases changed since yesterday" |
| Hearing tomorrow + tasks due before it | `Case.nextHearingAt` = tomorrow, `Task.hearingAt` same | "Tomorrow: 4 matters, 2 still need something from you" |

## 5. Gaps and constraints found

| # | Gap | Effect on Home | Who resolves |
|---|---|---|---|
| G1 | Where the court has reached is simulated from the clock. There is no live court-board feed. | "Court A is at item 9" or "4 ahead of you" cannot be promised. Use the list order and the listed status only. | Engineering: does the court side publish the current item? |
| G2 | Item numbers are derived from time order, not the published cause list. | Fine for the prototype. The real number must come from the cause list. | Engineering |
| G3 | **Two demo worlds that don't share cases.** Tasks run on a sandbox of 19 cases. Applications, orders and hearings detail are one fixture case. | Joins between tasks and applications can't be shown truthfully in the prototype until one joined fixture exists. | Us, before any mock |
| G4 | No record of when the advocate last looked. | No "since you last looked". Use a fixed window. | PM: is a last-seen record wanted? |
| G5 | The objection invitation is computed in the case view, not raised as a task. Take action does not list it. | Home would be the first surface to bring it into the day. Its door is the case, not Take action. | PM: should it become a task? |
| G6 | `latestUpdate` is free text. | It can be shown, not classified or counted by type. Counting orders vs filings needs a typed event feed (`lib/cases/timeline.ts` has event types, but only for the fixture case). | Engineering |
| G7 | `/tasks` has URL filters (`due=overdue/today/week/before-hearing`, `view`, `kind`, `court`), but **no case filter**. | Doors to "this case's tasks" go to the case page instead. | Fine as is, or a small add |

Real doors that exist today: `/tasks?due=overdue`, `/tasks?due=today`, `/tasks?due=before-hearing`, `/tasks?view=waiting`, `/tasks?task=<id>` (one task opened), `/cases/<id>`, `/advocate` (Hearings), `/cases?join=1`, `/filings`, `/raise-application`, `/vakalatnama`.

## 6. Deterministic statements: a first draft of the rules

Each statement shows only when its condition holds. Fixed order. Each line is a template.
"Act" uses the existing `useTaskAct` (pay and file in place, the rest through their pages).

| Order | Statement | Condition (exact) | Template | Examples shown | Door |
|---|---|---|---|---|---|
| 1 | Not ready for court today | Hearing today, not concluded, ≥1 open blocking task | "{n} of today's matters can't go ahead yet" | Up to 2: item, court, first blocker title, verb | `/tasks?due=before-hearing` |
| 2 | Statutory deadline today | Needs-action task, `dueKind = statutory`, due today | "A statutory deadline falls today" | Up to 2, with verb | `/tasks?due=today` |
| 3 | Overdue | Needs-action task, `isOverdue` | "{n} overdue" | The oldest 1 | `/tasks?due=overdue` |
| 4 | Waiting on you | `status = ready`, `prepared.by` ≠ viewer, viewer is a signatory | "{n} prepared for your signature by {names}" | Up to 2 | `/tasks?view=needs-action` (no filter for "prepared"; see G7) |
| 5 | Your decision | `kind = review`, `review.of` = viewer | "{n} request(s) need your decision" | 1 | `/tasks?task=<id>` |
| 6 | Court today | Hearings today on visible cases | "{n} matters in {m} courts today" plus passed-over count | None. It is the frame. | `/advocate` |
| 7 | Objection window | `objectionInvitations` non-empty (G3, G5) | "Objection to {type} due {date}" | Up to 2 | `/cases/<id>` |
| 8 | Changed on your cases | `CaseRecord.updatedOn` ≥ 00:00 yesterday | "{n} of your cases changed since yesterday" | Up to 2: `latestUpdate` | `/cases` |
| 9 | Tomorrow | Hearings tomorrow, and tasks before them | "Tomorrow: {n} matters, {k} still need something" | None | `/tasks?due=before-hearing` |

Caps never change with volume. Counts can grow, examples can't.

## 7. Scenarios the rules must survive

| Scenario | What happens |
|---|---|
| New account, no cases | The existing shell home (`AdvocateShellHome`) takes over. Already on main. |
| No hearings today (holiday, weekend, nothing listed) | Statement 6 says so and names the next listed day (`nextHearingDayAfter`). Statements 1 and 9 hide or shift. |
| 30 matters across 8 courts | Statement 6 stays one line. Statement 1 shows 2 examples and a count. |
| Everything ready, nothing due | Statements 1–5 hide. Home is the court frame, changes and tomorrow. |
| Afternoon, all heard | Statement 1 hides (concluded matters drop out). Statement 9 leads. |
| Clerk or junior viewing | Verbs become "View" or "Continue" (`verbFor`). Statement 4 inverts: "{n} waiting on Adv. X's signature" (`waitingOnOf` in `lib/tasks/format.ts`). |
| Single-court deployment | Court names drop. `inOneCourt` already handles it. |
| Data still loading, or offline | One loading state. No partial counts. |
| Very large volume (300 open tasks) | Every statement is an aggregate plus a fixed cap. Nothing scrolls inside Home. |

## 8. Questions only PUCAR can answer

1. Does the court side publish which item is being heard? (G1)
2. Should "objection invited" become a task, so it lives in Take action? (G5)
3. Is a "last seen" record wanted, so Home can say "since you last looked"? (G4)
4. Is there or will there be a typed case-event feed (orders, filings, service)? (G6)
5. Who opens Home in practice: the advocate, the clerk, or both? It changes statements 4 and 5.
