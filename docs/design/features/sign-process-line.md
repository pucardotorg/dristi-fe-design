# Sign process — the process line
Updated: 2026-10-06 (craft pass)
Status: implemented (not committed; branch `feature/process-management-courtside`)

## Current outcome

`/employee/sign-process` is three tabs, cut by who the process is waiting on, with
single-select status pills inside each tab:

| Tab | Waits on | Pills (All first) | Acts |
|---|---|---|---|
| RPAD collection | the advocate's cover | — (one status) | Send for signature |
| Sign & send | the court | To sign · To post · Error | Sign · Mark posted · Resend |
| Track | the channel | In progress · Completed · Failed | Record returns (RPAD only) |

- Acts come from the selection: one button per kind of work selected, the first one primary.
- Signing forks on the channel: electronic (Police via ICOPS, SMS, email) goes straight to Track
  or lands in Error; RPAD lands in To post until it's marked posted.
- Type a case number and press Enter to add to the pile on all three paper moments: covers
  collected, covers posted, returns received. The tray shows what's on the pile.
- Record returns: one window, one "Returned on" date for the batch, Delivered/Not delivered
  (Executed/Not executed for warrants and proclamations) per cover, and a reason only when unserved.
- Under All, rows band by status. Banding is decided on the whole view, and band counts span pages.

Files: `apps/dristi-app/src/lib/employee/sign-process.ts` (model, acts, data),
`components/employee/sign-process-screen.tsx`, `sign-process-table.tsx`,
`sign-process-dialog.tsx`, `record-returns-dialog.tsx` (new), `components/chrome/pill-plate.ts`
(new; the pending-tasks pill treatment, now shared; `tasks/kind-pills.tsx` reads it).
HTML iterations v1–v3: `docs/design/explorations/sign-process-*.html` (gitignored).

## Decisions

| Date | Decision and reason | Source | Status |
|---|---|---|---|
| 2026-10-06 | RPAD collection stays its own tab: only RPAD needs a cover before it can be signed and printed. | Owner | Implemented |
| 2026-10-06 | Signed / Sent / Completed are statuses, not stages. They become pills, the pending-tasks pattern, to cut complexity and reuse one pattern. | Owner | Implemented |
| 2026-10-06 | Three tabs: RPAD collection, Sign & send, Track. The first proposal (two tabs) was replaced after the team review. | Owner (team review) | Implemented |
| 2026-10-06 | Tabs cut by who the process waits on. A send failure (ICOPS) stays in Sign & send; a delivery failure is a Track result. | Claude proposal, owner agreed | Implemented |
| 2026-10-06 | RPAD is signed in a batch and posted later, so signing can't mean sent. Added the To post pill rather than a fourth tab. | Owner raised; Claude chose the pill | Implemented |
| 2026-10-06 | Bulk returns via the same Enter-to-pile tray as collection. | Owner | Implemented |
| 2026-10-06 | Pills are single-select; All exists to see the tab whole. | Owner | Implemented |
| 2026-10-06 | Channels are RPAD, Police (ICOPS), SMS, Email, per the owner's description. Court bailiff removed. | Owner's words; implementation choice | Implemented — confirm |
| 2026-10-06 | Tabs renamed **RPAD collection · Issuance · Service**. The owner rejected "Sign & send" and "Track"; the new names come from the product docs' own "issue of process" and "service of summons". Pills follow the pending-tasks row: they lead the filter row, with search and Filters at the far end. | Owner (rename, row); Claude (names) | Implemented — confirm names |
| 2026-10-06 | Search label is screen-reader only on this screen (and the RPAD tab's lone select label with it), so the pill row sits on one line. WCAG doesn't require a visible label on an icon-marked search; DS §12 is ambiguous, so it's logged as ds-requests #13. | Owner (remove label); Claude (advice) | Implemented |
| 2026-10-06 | No pagination: this is a bulk screen and paging hid statuses under All. | Owner | Implemented |
| 2026-10-06 | Electronic outcomes update themselves; only RPAD returns are recorded by hand. | Claude assumption, shown in v2 and not objected to | Implemented — confirm |

## Changes and tradeoffs

- Five stage tabs became three tabs plus seven statuses. `stage` became `status`, and
  `completedOn` became `returnedOn` + `outcome`.
- Mark posted stamps today. The v3 HTML had a "Posted on" date; dropped to keep the shared bulk
  confirmation. Re-add if posting is often recorded late.
- The legacy delivery dialog's Remarks field is not in bulk recording.
- Recording is selection-only. There's no Record button in the single-row overlay, which would
  have meant closing one modal and opening another.
- Row order is still the line's own order (newest first), not sorted by hearing date.
- The bulk confirmation's success line for Sign reports where the rows went (out / to post / failed).

## Craft pass, 2026-10-06

The owner found the build's craft below the mockup's. Measured on the render, then fixed:
- At 1280px the table was 1010px wide in a 910px panel, so it scrolled sideways and cut off Hearing date. Trimmed the minimum column widths; Status now stacks the word over its day or reason, so a failure no longer wraps over three lines with a stranded "·". Fits at 1280px.
- The tab strip and pill row drew grey scrollbar tracks when they overflowed. The `no-scrollbar` / `scrollbar-none` classes on DS primitives are defined nowhere in the app, so they do nothing; used `[scrollbar-width:none]`, after the document-record dialog's precedent.
- Band labels were 12px under 14px data; now 14px semibold, counted across pages, with pending-tasks padding.
- Pills moved into a new `leading` slot on `CourtFilters`; other `CourtFilters` screens are unchanged (checked on /employee/cases). Pill and input centres measure equal.
- The tray's "Clear selection" was `xs` (12px); now the DS default size, reading "Clear" on phones with the full accessible name kept.
- Record returns rows sat loose on the canvas; they're now on one lifted panel (`PANEL_CLASS` card).
- Empty pills are disabled, matching pending tasks.

## Design-mode review, 2026-10-06 (13 comments)

- **Search copy:** "Type a case number and press Enter" on views where Enter adds to the pile; "Search by case number" elsewhere.
- **Tray:** the "N covers in hand · N cases" sentence is gone. The chips are the count, and Clear selection sits on the chips' line at the chips' height and the DS 14px.
- **Bulk confirmations** are now a compact `AlertDialog` (`process-act-confirm.tsx`): the question, one line only where it earns it, then a success state in the same window. The lines kept are "This cannot be undone." for Sign, a consequential warning kept on Claude's judgement, and, for Mark posted, the owner's acknowledgement "I confirm these covers have been handed to the post office." The shared `SignBulkConfirmDialog` is untouched for the other four queues.
- **Pills:** each has a tooltip (hover and focus) saying what the status is. Counts show only where they're work: Completed has none, and Service's All has none.
- **Service is In progress · Completed.** Failed is gone as a status: a delivery that failed is a Completed row that reads "Not delivered / Door locked" in warning ink.
- **The supporting line under the title is removed** on every tab.
- **Single-row overlay rebuilt:** facts well on the left, the paper on the right in the registrations overlay's framed well, and Download plus the status's own act in the footer: Send for signature, Sign, Mark posted, Resend, or Record return. Quick acts ask their question in the footer; Record puts the outcome fields above the facts; Sign keeps its signature stage. Every outcome resolves in the footer line, so nothing on the stage moves.

## Round 3, 2026-10-06: back to the established pattern

- **Reversal:** the compact `AlertDialog` confirmation from the previous round felt soulless and broke the product's pattern (owner). Removed. Bulk acts use the shared `SignBulkConfirmDialog` again: the sentence band turns into the solid success band, with facts under it. The facts now count rows by **where they go**: "Moves to → Issuance · To sign" before the act, "Now in" after, read from where each row actually landed (so a refused ICOPS send shows as Send failed). This needed two optional, backward-compatible additions to the shared dialog's `selection`: `kindsHeading` and `doneKinds`. `ActCard` is now exported.
- **Single-row overlay:** acts move to an `act` stage carrying the same `ActCard` (one modal). Sign settles onto it after the signature stage; Record return settles onto it after the inline form.
- **Footer:** with no pages, a short list left the action bar mid-page with bare canvas under it. `mt-auto` seats it on the page floor.
- **Service filters:** Outcome (Successful / Failed) and Reason not served, only on Service; carrying them to another tab drops them.
- **Bug fixed on this screen:** applying several fields from the Filters sheet kept only the last one, because each field rebuilt the filters from a stale snapshot. Changes are now patches merged into the latest state. The same bug is on All cases, Other applications, Sign forms and Hearings, flagged as a separate task.

## Round 4, 2026-10-06: a confirmation designed for this line

- **Why the earlier ones failed:** a small card floating in a tall, empty tinted canvas; robotic sentences; "Service · In progress" jargon in a receipt-like list; "Cases: 4 cases"; no way onward. The owner called it amateurish.
- **`ProcessMoveDialog` / `MoveBody`** (`components/employee/process-move-dialog.tsx`), one presentation for bulk and single:
  - **Asking:** a plain question, then rows grouped by fate. Each has a big count, plain words ("Sent as soon as you sign — Police (ICOPS) and SMS"), and an arrow to the destination pill and tab. Sign carries one caution line; Mark as posted carries an **acknowledgement checkbox** that gates the button. The button repeats the act and count ("Sign 4 processes").
  - **Settled:** the solid success band states the *next step* (never a failure sentence on a success fill). Rows show where each actually landed with a tick or warning icon, and an **Open [pill]** link goes straight there.
  - White, only as tall as its content, `sm:max-w-lg`.
- **Single-row overlay:** the act takes over the facts column *beside the paper* rather than a stage of its own, which had been a short list in a document-sized window.
- **Record returns** settles on the same body.
- **Removed:** the round-3 additions to the shared `SignBulkConfirmDialog` (reverted to its original); `describeSignRun`, `signRunOf`, `processDestination`, `processPlace`.
- **Hearing date is a sort, not a filter** (owner): "Soonest hearing first" is the default, with "Latest hearing first" and "Recently updated first". It's a select on the row after Filters (new `CourtFilters` `trailing` slot), with its label for screen readers only. The hearing-date picker is gone from every tab.
- **Service tab counts In progress** (owner): tab counts now come from `countedStatuses`. The All pill counts only where every status is work.
- To fit pills, search, Filters and sort on one line at 1440px, the search narrows to 256px beside a leading control and the sort is 224px. Measured: all centres equal.

## Round 5, 2026-10-07: the plain confirmation (supersedes rounds 2–4)

- **Owner:** "just have a simple confirmation modal… one simple line saying where this is getting taken to… stick to our conventions."
- **Convention used:** the court side's alert confirmation, as Approve copy application has it: `ChromeAlertDialogContent`, a title question, one `AlertDialogDescription` line, then Back and the act. It closes on the act, and the bar's live line reports what happened.
- **The line** is `moveLine(act, rows)`: "They move to To sign in Issuance.", or for a forked sign run "3 move to In progress in Service, 1 moves to To post in Issuance."
- **Removed:** the move rows, success band, Open links, caution and acknowledgement checkbox; the domain's `MoveGroup`, `plannedMoves`, `landedMoves` and the act fields `caution`, `acknowledge`, `done`, `next`.
- **Record returns** keeps its form (outcome per cover), but closes on Record like every other confirmation, with no success stage.
- **Single-row overlay:** a quick act asks the same question in the header and the same one line in the footer beside Back and the act. It then returns to reading, with the facts showing the new status.

- **Correction, same day:** simplifying also stripped the success state, which the owner had not asked for. Restored, in the same small window:
  - The title says what was done ("4 processes signed").
  - The product's solid success band says where the rows are now (`landedLine`). A refused send goes on its own warning line (`refusedLine`), never on the success fill.
  - Download (signing only) and Done.
  - Record returns settles the same way. The single-process view shows the success line where the question stood, then Download and Done.

- **2026-10-07, final:** a further attempt to use the shared `SignBulkConfirmDialog` was rejected mid-way. The owner asked to keep the alert-with-success design above, and it was restored as it was. One change from that attempt was kept, at the owner's separate request: Record returns' Delivered / Not delivered is now the DS radio pair (the app's `YesNoField` pattern) instead of a segmented control.

- **2026-10-15, process PRD changes:** *Send failed* is renamed **Error**, still a retryable send error and not a final status. New channel **By hand** (warrant and proclamation only): after signing it waits under a new **To hand over** pill in Issuance until the CMO marks it sent; its return is recorded like RPAD's. Every proclamation goes By hand; downloading its signed copy records it Sent and Executed on the day (`DSP-10`). Signed and sent remain two stages with their own days on every channel (`DSP-02`); sending electronic channels on signing is this screen's choice.

## Verification and open work

- `npm run verify:ui`: lint 0 errors (16 warnings, all in files this change doesn't touch); token,
  typography, ui-sync, spacing, table-rows and rails checks pass.
- `npm test`: 1082 pass. The sign-process suite was rewritten (49 tests).
- Render, on this worktree's dev server at :3000: tabs and pills at 1280px; banding under All;
  mixed sign run (1 out, 1 to post, 1 failed); Enter-to-pile on Track; Record returns with a
  reason, and its settled state; focus returns to search; 375px in dark mode, no page overflow.
- Not checked: 200% zoom, a screen reader pass, keyboard-only walk of the record dialog, dark
  mode at desktop width. The spacing gate reports 15 baselined values gone; baseline not updated.
- Review was by the builder, not independent.
- Open: is the India Post article number recorded when posting? Remarks on returns? Is
  "Sign & send" the final tab name?
