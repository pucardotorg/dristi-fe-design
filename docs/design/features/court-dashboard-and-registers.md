# Court dashboard and registers
Updated: 2026-10-11
Status: implemented (uncommitted on `feature-courtside-dashboard-v2`)

## Current outcome

The court side's landing page (`/employee`) is rebuilt as the **magistrate dashboard**
from the owner's note *"Note On Dashboard, Reports And Registers"* (section A2), in the
**Direction 1 "Briefing"** layout. It is one scrolling page with five sections in the
note's order:

1. Case status and disposal: ST pending / disposed, CMP pending / disposed, long pending
   (LPR). Each tile opens its register. Below them is a judgements-per-month chart.
2. Time between hearings: median and average gap, and per-stage charts of the days
   between hearings and the hearings held in the current stage.
3. Overdue cases: one row per stage with its limit; a row expands to that stage's cases.
4. Process: payment pending over 7 days, delivery pending over 14 days, and pending with
   a hearing within 2 weeks; plus the average days to payment and delivery for notice,
   summons and warrant.
5. Undated cases: active cases with no next hearing date.

**Registers** (note section B) are a new rail item. `/employee/registers` is an index
of all 18 registers in seven groups, and `/employee/registers/<id>` is one page per
register with sub-views, search, a period filter, paging and a CSV download. Registers
1–10 have rows. Registers 11–18 show the note's columns and a "Source to confirm" empty
state.

Both read one generated, deterministic demo court (`lib/employee/court-docket.ts`) of
about 2,500 cases since Nov 2024, anchored to the court's today. Every dashboard figure
equals the row count of the register or list it opens.

Main files:
- `apps/dristi-app/src/components/employee/court-dashboard-screen.tsx`
- `registers-screen.tsx` and `register-screen.tsx`
- `docket-table.tsx` and `count-bar-chart.tsx`
- `apps/dristi-app/src/lib/employee/court-docket.ts`, `registers.ts`, `register-rows.ts`
- `navigation.ts` (the Registers row and trail)
- `src/components/ui/chart.tsx`: the DS chart primitive, synced unedited, with
  `recharts` added.

Approved visual reference: the five-direction HTML mockup published as a private
artifact (https://claude.ai/artifact/Vn5JjfdhnAGAzJRfQ4Db9k). Only Direction 1 applies.

## Decisions

| Date | Decision and reason | Source | Status |
|---|---|---|---|
| 2026-10-10 | Court-side work focuses on the **magistrate dashboard (A2) and registers (B)** of the note. The public dashboard (A1) is out of scope. | Owner (Neer) | confirmed |
| 2026-10-10 | The previous `/employee` dashboard (Gujarat "act on these first" categories) is replaced. Owner: it "was just the dummy stuff. It is not accurate." | Owner | confirmed |
| 2026-10-10 | Explore before building: five HTML directions (Briefing, Exceptions first, Stage pipeline, Report workspace, Inspection month). | Owner | done |
| 2026-10-11 | **Direction 1 "Briefing"** chosen: one page in the note's order; registers as a grouped index, then one page per register. | Owner | confirmed |
| 2026-10-11 | Build branch `feature-courtside-dashboard-v2`, cut from `origin/main` `c9bb1c7`. The owner chose this name; the older `feature-courtside-dashboard` (18 Sep) is left untouched. | Owner | confirmed |
| 2026-10-10 | Stage grouping maps the note's six stages onto the app's seven. Registration = filed, not yet registered. Appearance covers process and appearance. Bail = appeared, bail not yet granted. Trial = plea + evidence + arguments. | Coordinator proposal, carried in the mockup the owner chose | proposed; not explicitly confirmed |
| 2026-10-10 | Limits as in the note (3 / 70 / 60 / 14 / 45 / 10 days; process 7 / 14 / 14), held in one constant (`COURT_LIMITS`) so they can become configuration. The note gives no source for them. | Note, plus an implementation choice | open: source unknown |
| 2026-10-10 | Registers 11–18 show columns and "Source to confirm" with no rows, so the demo doesn't claim DRISTI records batta, fines, refunds or warrants in execution. | Coordinator proposal, carried in the chosen mockup | proposed |
| 2026-10-11 | One shared demo dataset feeds the dashboard and the registers, so the numbers reconcile. There is no backend. | Build agreement | implemented |
| 2026-10-11 | The 24-month statement and the fees register show whole, never split across pages, because a statement is read whole at inspection. | Coordinator review fix | implemented |
| 2026-10-11 | Removed the dashboard's "Open registers" button, because Registers is already in the rail. | Owner review | implemented |
| 2026-10-11 | Time between hearings: the stage filter moved to the left, above what it filters (on the right it was "a very bad product decision"). The median and average gaps now sit in cards, not flat on the surface. | Owner review | implemented |
| 2026-10-11 | Overdue cases: a stage's case list opens directly beneath the row clicked (an expansion row inside the table), not below the whole table. One row opens at a time. | Owner review | implemented |
| 2026-10-11 | Every list (undated, process, overdue expansions, registers) uses the court side's shared `ListFooter`: 10/20/30/50 per page plus a pager, as All cases does. This replaces "Show all" and a hand-rolled pager. | Owner review | implemented |
| 2026-10-11 | Median and average gap cards sit beside the stage filter, on the same row, not below it. The row wraps on narrower screens: side by side from about 1440px, stacked below. | Owner review | superseded the same day (next row) |
| 2026-10-11 | The two gap figures became one compact strip at the filter's own height (40px) and radius, on the right of the filter's row. The tall cards beside a 40px control had left a block of white space between the heading, the tabs and the charts. Labels shortened to "Median gap" and "Average gap", since the filter already names the stage. On a phone the strip goes full width with each label above its value. Spacing is now an even 16px from heading to row and from row to charts. | Owner review | implemented |
| 2026-10-11 | Every bar on every dashboard chart shows its value; a tooltip appears on hover. Previously only the tallest and latest bars were labelled, which looked arbitrary. | Owner review | implemented |
| 2026-10-11 | The shared `ListFooter` now shortens long pagers (first, last, current ±1, with ellipses) above 7 pages, and wraps. Lists of 7 pages or fewer render as before. The calendar register's 255 page links had made the footer about 10,800px wide. | Coordinator (shared component) | implemented |

## Changes and tradeoffs

- **Reversal.** The earlier dashboard rested on the Gujarat finding that judges did not
  want analytics on the landing screen. The owner's note supersedes it: the dashboard now
  carries disposal statistics and hearing-gap charts as well as the lists people act on.
- **Directions not taken.** Exceptions first, Stage pipeline, Report workspace and
  Inspection month remain in the mockup for reference.
- **Disagreeing case lists.** The new demo court is separate from the 23-case
  `COURT_CASES` behind All cases and the cause list, so their counts disagree.
- **Implementation choices made by the builder:**
  - Register sub-views arrive by `?view=`.
  - The breadcrumb back to Registers is the top-bar trail; there is no second one inside
    the page.
  - Stat-tile figures use the title text role, because the DS has no stat-figure role.

## Verification and open work

**Checked on 2026-10-11, in this checkout against `:3001`, DS pin e0cadea6b9d4:**
- The builder rendered every dashboard and register route at 1440 and 375 px in light
  and dark, plus the interactions, the keyboard path, the Gujarat and Punjab courts, CSV
  download and the 404 for an unknown register.
- The coordinator viewed the dashboard (1440 light, 375 dark), the registers index and
  the statements register, and confirmed the statement fix on the served page:
  24 of 24 rows and no pager. The calendar still pages at 20.
- Gates: tokens, typography, ui-sync and table-rows pass. ESLint has 0 errors and `tsc`
  is clean.
- New tests: 47/47 pass. They cover determinism, statement reconciliation, tile count
  equal to register count, and navigation.

**Re-checked after the owner's review fixes (2026-10-11):**
- On :3001 at 1440 and 375, there is no sideways page scroll on the calendar register,
  the dashboard or Today's hearings. There are no page errors.
- At page 3 the calendar's pager reads `1 2 3 4 … 255`, and the hearings pager still
  lists every page. On page 2 the visible footer reads "11–20".
- The builder's screenshots (`scratchpad/dash-build/shots/fix2/`) show the gap cards,
  the Appearance expansion directly under its row, and undated cases on page 2.
- Gates pass apart from the spacing failure already on `main`. ESLint and `tsc` are
  clean, and the employee tests pass 804/804.

**Failures that are already on `main`, not caused by this work** (confirmed against
untouched `c9bb1c7`):
- `check:spacing` flags `companion-rail.tsx:226` (`gap-3.5`), so `verify:ui` stops there.
- 3 of 31 filing tests fail in `filing/queue.test.ts` and `sample-drafts.test.ts`.

**Not checked:** a real screen reader, 200% zoom, Indic-script labels. The review was
not independent: no `ui-reviewer` was tagged, so the coordinator reviewed its own work.

**Open:**
1. The source of the overdue limits, and whether they should become court configuration.
2. Owner confirmation of the stage grouping.
3. Registers 11–18: where DRISTI would get the data.
4. Kerala-only labels (CMP, ST, LPR, `LP/`, `CA/`, "Kerala fee schedule") have no
   re-voicing rule for other states yet.
5. The ₹10 application fee is a demo rate with no source.
6. The scrutiny-officer seat's narrowed rail does not include Registers. Including it is
   a one-line owner call.
7. Chart keyboard focus has no visible ring: [DS request 21](../ds-requests.md).
8. Demo data shape: the 61–90 and 90+ day gap buckets are always empty, and CMP pending
   only falls in the current year.
9. The dashboard and All cases use different datasets.
10. Nothing is committed yet. `package.json` also has an npm-made alphabetical move of
    `@fasterfixes/react`.
