# Pending tasks — how the front end works, and where the backend plugs in

The pending-tasks area (`/tasks/**`) is a working front end with **no server**: people,
cases, tasks and uploads live in the browser (IndexedDB), the current person is a
sandbox identity chosen from the account menu ("Viewing as"), and pay / sign / file are
sandboxes that behave like the real services will. Two tabs signed in as two people see
each other's changes at once (`BroadcastChannel`). The seams below are where engineering
swaps the local implementation for DRISTI's services. Screens do not change when that
happens.

## Model

`types.ts` is the contract. `Person`, `Case` (with `signatories` — on the vakalatnama,
first = the main advocate — and `advocates` — everyone on the case, signatories included)
and `Task`. A task is created by a court, registry or system event (`why`), says what to
do, may carry an amount and fee head, has a deadline with a kind and provenance
(`dueKind`, `deadlineNote`), may be anchored to a hearing (`hearingAt`, `isBlocking`),
and moves through the statuses below. `draft` / `prepared` record who last saved or
finished the preparation; `returned` carries scrutiny's defects; `completion` records how
it closed; `history` is the audit trail — every transition appends one line.

### Kinds → category pills

The pills are the four citizen-side categories of the Pending Tasks PRD (attribute 6,
"Category") and the Coda task catalogue, in their order and words. `kind` still decides
the verb and the flow; `categoryOf(task)` folds it into a category.

| Kind | Category | What it is |
| --- | --- | --- |
| `pay` | Pay | A fee: process fee, court fee, copying fee |
| `sign` | Sign | A vakalatnama, affidavit, application or memo needing the advocate's e-sign |
| `file` | File/Submit | A document or application due with the court |
| `returned` | File/Submit | A filing sent back for compliance — fix the defects and re-file (the catalogue files "Correct defects" here) |
| `draft` | File/Submit | A filing or application someone started — counted as the filing it will become |
| `review` | Others | A decision addressed to this advocate — a request for their removal from the case |
| `hearing` | Others | Court-initiated, anchored to a posting: the plea, a deposition, the sworn statement, arguments — done in court, marked done by hand |

The category follows **the act still needed**, never how far along the task is: a
filing left in draft counts under **File/Submit** from the start, and stays there once
marked ready or filed.

These were six count cards until 2026-09-15, when they became one row of
pills (six kinds until 2026-10-08, then the four PRD categories) (`components/tasks/kind-pills.tsx`). A card that filters is a summary and a control
at once, and the pressed kind was then named a second time as a chip in the filter row;
the counts a card carried now sit where each one answers something — the pill's own
number, the header line's overdue count, and the due bands inside the list.

### Statuses → views (`viewOf` — per viewer)

The tab a task lands in depends on who is looking. `viewOf(task, user, case)` puts a
task under **Needs action** when this viewer holds its acting verb (`verbFor` returns
Pay / Sign / File / Re-file / Continue / Mark done): a vakalatnama signatory on
open/ready items of kinds they can complete; anyone on the case on a draft or a hearing
task. The same open or ready item is **Waiting on others** from a junior's chair — it
waits on the signatory, and the row says so ("R. Manoj — signature") with a quiet View
verb. `awaiting-court` and `payment-confirming` wait for everyone. `done` · `expired` ·
`obsolete` → **Completed**; `archived` → **Archived** (restorable, `archived.from`
remembers the state it left).

## Seams (swap these; keep the signatures)

| Seam | Today | Replace with |
| --- | --- | --- |
| `data/repository.ts` → `data/indexeddb.ts` | IndexedDB (`dristi-tasks`: `people`, `cases`, `tasks`, `files`) + `sessionStorage` for the current person | HTTP repository against the tasks/case services; `getRepository()` in `data/index.ts` is the single choice point |
| `store.tsx` — `useTasks()` | Loads, seeds `sandbox.ts` on first run (re-seeds when `SEED_VERSION` moves), `dispatch(taskId, transition)` applies a pure transition and writes it | The same provider over the HTTP repository; the session replaces `setUser` |
| `sandbox.ts` | Five advocates, 19 cases, ~38 tasks, dates relative to today | Nothing — delete once the services answer |
| Pay / sign / court (`components/tasks/act/*`) | Sandbox outcome controls: gateway result, any 6-digit OTP, "Court: accept / return with defects" | Payment gateway, eSign provider, registry scrutiny events driving the same transitions |
| Cross-tab sync | `BroadcastChannel("dristi-tasks")` | Server push / polling |

## State machine (`transitions.ts`)

```
open · draft · ready ──saveDraft(note?, files?)──▶ draft        (anyone on the case)
open · draft ──markReady(note?, files?)──▶ ready                (anyone on the case)
open · draft ──fixDefect(n)──▶ draft                            (returned tasks; anyone on the case)
open · draft · ready ──sign──▶ done                             (signatory; event)
open · draft · ready ──recordPayment──▶ done · payment-confirming
                                       · failed: the same state, "Payment failed — try again"
open · draft · ready ──file──▶ awaiting-court                   (signatory)
open · draft · ready ──refile──▶ awaiting-court                 (signatory; every defect fixed)
payment-confirming ──confirmPayment──▶ done                     (event)
awaiting-court ──courtAccepted──▶ done                          (event)
awaiting-court ──courtReturned(defects)──▶ obsolete + a new open `returned` task
open · draft · ready ──markDone──▶ done                         (anyone on the case; manual)
any non-closed state ──archive──▶ archived                      (anyone on the case)
archived ──unarchive──▶ the state it left                       (anyone on the case)
any open state ──redate · expire · obsolete──▶ …
```

`markDone` is the escape hatch for work completed outside DRISTI — at the counter, in
court, on paper. Any kind, any open state, anyone on the case; the screens confirm it
first ("this records that it was completed outside DRISTI") and `completion.how` says
`"manual"`.

When a signatory completes work someone else prepared, the history line reads
"Completed by X — prepared by Y · …". Every transition validates the from-state and the
actor's permission and throws a `TransitionError` (`illegal-state` · `forbidden` ·
`invalid`) otherwise.

## Permissions (`permissions.ts`) — file-share, not assignment

`canView` = on the case (`advocates`) · `canComplete` = on the vakalatnama (`signatories`).
Nobody is assigned anything; nobody approves anything. A non-signatory prepares (draft,
ready); a signatory completes (sign, pay, file, re-file) — directly, or after someone
else prepared it. `verbFor` derives the one verb a row shows at render time:
**Sign · Pay · File · Re-file** (signatory, open/ready) · **Continue** (anyone, on a
draft) · **Mark done** (hearing tasks — done in court) · **Unarchive** (archived tasks)
· **View** (waiting, closed, or an open/ready item whose completion belongs to a
vakalatnama holder the viewer is not — a quiet ghost, never a disabled verb).

**Modal vs page (the owner's rule): apart from uploading files and making payments,
nothing acts in a modal.** Pay and File act in a **modal** over the table
(`components/tasks/act/act-modal.tsx`). Sign, Re-file and filing-flow drafts continue in
their own **full pages** — `/tasks/[id]/sign` · `/tasks/[id]/fix` · `/tasks/[id]/continue`
(`act/act-page.tsx`) — behind a dialog that says the work continues in that flow (the
scrutiny and e-filing pages are interim until those flows are built; a sign-kind draft
continues on the sign page, everything else on the file page). On completion the page
returns to `/tasks?task=<id>` with the row focused. The `/tasks/[id]/pay|file|submit`
routes stay redirects to `/tasks?task=<id>` — those act in place.

`canViewTask` adds the task's `visibility` on top of `canView`: `"case"` (default) —
everyone on the case's side; `"actors"` — only the people who can act on it (vakalatnama
holders for completing kinds; anyone on the case for hearing tasks and drafts). The 1.0
attributes doc's third audience — courtroom staff — is out of scope for this
advocate-side app and is not modelled. Every seeded task stays `"case"`; the field is a
backend seam, not invented behaviour.

## The 1.0 attributes doc → this model

The owner's WIP "Attributes of a Pending Task" (DRISTI 1.0), mapped to where each
attribute lives here:

| 1.0 attribute | Here |
| --- | --- |
| Task Name | `title` (verb-first, fixed vocabulary) |
| Due Date | `dueAt` + `dueKind` + `deadlineNote` (provenance). 1.0 windows honoured in the seed: scrutiny cure 3 days · process fees ~1 day · post-e-sign payments immediate · application-response SLAs (bail 2 · rescheduling 2 · settlement / transfer / withdrawal / production / extension / generic 4 · delay condonation 0) |
| Creation Trigger | `why` (`event` + `at`) |
| Closure Trigger | event transitions (`transitions.ts`) close it; `closesWhen` declares the rule — auto-closure included ("Closes on payment, or when the hearing passes"; "Closes when the court decides the application"; "Closes when this or any other vakalatnama fee on the case is paid") — and `completion.how` records how it actually closed |
| Archive Logic | `archive` / `unarchive` (manual, restorable) today; auto-archive rules are a backend seam — open |
| Users | `Case.signatories` / `Case.advocates` + `verbFor` (per-viewer verb) |
| Category | `categoryOf(task)` — Pay · Sign · File/Submit · Others |
| Associated Workflow | verb → surface: Pay / File → the act modal; Sign / Re-file / Continue → the flow pages |
| Status | ours is richer: open · draft · ready · awaiting-court · payment-confirming · done · expired · obsolete · archived. **Overdue stays derived from the date, never a stored status — it cannot go stale** |
| Case | `caseId` |
| Visibility | `visibility` (`"case"` / `"actors"`); courtroom staff out of scope |

## Urgency (`urgency.ts`)

One comparator: overdue first → tasks a listed hearing cannot proceed without ("blocking
and coming up", the owner's rule) → the next date that will hurt (that hearing while it is
still ahead, else the deadline) → earliest deadline → case → oldest created → id. Undated
tasks last. The rail on the home screen and the table here
sort with it.

## Selectors (`selectors.ts`)

`Filters` (view, kind, due, court, advocate, search) live in the URL. `applyFilters`
narrows and sorts; `summaryOf` feeds the header; `courtsOf` the Court filter.

**One count contract.** Every count follows the rows the list is showing, except the four
tab counts, which have to be cross-view to be any use. `categoryCounts(world, filters)`
applies the whole filter set *except* the kind, so a pill reading 5 always yields five
rows; `bandByDue(rows, now)` cuts the sorted list into Overdue / Due today / This week /
Later / No date set, and a band's number is the rows under it. `readsAsOverdue` is the one
overdue rule — past its date *and* still binding (`isBinding`) — shared by the Due cell,
the Overdue filter and the Overdue band, so they cannot disagree.

Banding outranks one part of `compareUrgency`: a task blocking a hearing later in the week
reads under **This week**, below a deadline due today, because the band answers *when it
bites*. Inside a band the comparator's order stands.

## Vocabulary (`format.ts`, brief D13 v2.1 — fixed)

Titles are verb-first ("Pay the process fee for the summons", "Fix 2 defects and re-file
the complaint", "Be present for the plea", "Continue the draft complaint"). There is no
Status column — the verb carries the action. Due cells are one format everywhere: a
relative primary from today — *{n} days overdue* (ink) · *Due today* · *Due in {n}
days* · *Before hearing in {n} days* · *No date* — over the absolute date ("18 Aug",
muted, tabular). Settled tasks recall the absolute date only, no ink. Waiting rows carry
one *Waiting on* phrase: *{main advocate} — signature/payment/filing* · *The court —
scrutiny* · *Payment confirming*. Completed and Archived rows carry the outcome: *Done
{date}* · *Expired — {why}* · *No longer needed — {why}* · *Archived {date}*. A row's
second line is the status note ("Payment failed — try again", "Prepared by S. Prakash")
or *Draft · X* (X is "you" for the draft's holder). The page header is today's date —
the anchor every relative phrase counts from.
