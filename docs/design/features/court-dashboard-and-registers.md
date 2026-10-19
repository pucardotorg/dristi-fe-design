# Court dashboard and registers
Updated: 2026-10-19
Status: implemented (uncommitted on `feature-courtside-dashboard-v3`); v2 is merged to `main`

## Current outcome

**2026-10-19, fourth v3 build (current).** Rebuilt to the owner's revised
`Case Flow Dashboard.html` (frozen at 18:06): four panels on the muted canvas.
**Overview** (date picker inside the panel, now opening on "This month" with a
"Compare with" choice: period before / same period last year / average of last 6 / none;
cases filed and closed with comparisons; pending with net change; age of pending cases;
"Where the pending cases are" six-stage path with "waiting over N days" lists).
**Needs attention** as of today in three columns by who acts (Office, Magistrate,
Outside the court), adding applications undecided over 7 days and no activity for 90
days. **Trends** (five charts, month-range select incl. custom). **How cases were
closed** (100% outcome bar for the period and the comparison, key with shares and point
changes, conviction rate). The "Every stage" table was retired by the design. Files:
`court-dashboard-screen.tsx`, `court-dashboard-attention.tsx`,
`dashboard-date-picker.tsx`, `court-flow.ts` (+ tests).

**2026-10-19, third v3 build (replaced the same day).** Rebuilt to the owner's standalone
`Case Flow Dashboard.html` (Desktop), replacing the six-screenshot layout: header with
the same date picker; movement strip; **Needs attention** (owner filter tiles, ranked
checks with "Act now", three-shade how-far-past bar on one scale, 8-week trend, who
acts, rows open their cases, top 6 / show all, all-clear footer); **Every stage** table
(A, C, B, D bands, owner chips per stage); **Which way it is heading** (six monthly
trend cards with Improving / Worsening / Steady against the 3-month average); **In
this period**. Files: `court-dashboard-screen.tsx`, new `court-dashboard-attention.tsx`,
`dashboard-date-picker.tsx`, `court-flow.ts` (`checksFor`, `severityOf`,
`monthlyTrends`, `wentOutBy`, `STAGE_OWNER`, `STAGE_WHY`) and tests.

**2026-10-19, second v3 build (replaced the same day).** The owner rejected the first v3 build as
"poorly built" next to the standalone designs and supplied six screenshots of the target
page. `ui-designer` (owner-tagged) rebuilt `/employee` to them: date picker top right
(quick picks, Monday-first calendar, days outside the records disabled, Cancel/Apply,
"Latest" pill, "Back to latest"); came in → pending → went out strip; "One view across
the case stages" (A case status, B time in the current stage, C hearing gaps and next
dates, D pending process) with "Reading this view"; "Is pending work growing or
shrinking?" (filed vs disposed line chart, month reconciliation, older pendency); "What
needs a closer look before hearings?" (upcoming hearings with process pending by day,
outstanding process, how far apart hearings are); "How long do process steps take?";
"The full case position" (six register tiles, age of active cases, no next date, ST
disposed this month); "About the measures" disclosure. The picked date drives the page by
`readingFor`. Files: `court-dashboard-screen.tsx`, new `dashboard-date-picker.tsx`,
additions to `court-flow.ts` (+ tests). The "Show" switch and "What to do first" tiles
of the first v3 build were dropped because the design does not have them.

**2026-10-19, first v3 build (replaced the same day).** The magistrate dashboard is now two parts, under a
"Show" switch (Everything · To do · Case status · Delayed cases · Hearing gaps ·
Process):

1. **What to do first**, as of today whatever the period: hearing within 14 days with
   process not served (office acts), no next hearing date, applications waiting for a
   decision, and reserved for judgement over 10 days (the magistrate acts). Each row
   opens its cases under itself.
2. **How cases are moving**, for a chosen period (This month, the default; Last month;
   Last 3 months; Custom range):
   - a strip: came in → pending (ST, CMP, awaiting registration, long pending register)
     → went out;
   - one table with the six stages as columns and the note's sections as bands: case
     status (A), past the review point (C), time between hearings (B), process (D).
   Counts that name cases open them below the table. Choosing one section also shows
   its detail: how cases went out and judgements (A), the gap histogram (B), month-end
   past-limit trend (C), average days to pay and deliver (D).

Every number is compared with the period before: totals against the previous period's
totals, positions on the last day against the previous period's last day. Colour marks
only good or bad news on a change, always with ▲/▼ and words.

New: `apps/dristi-app/src/lib/employee/court-flow.ts` (periods, any past day's position,
to-do lists) with `court-flow.test.ts`. `court-docket.ts` now also dates each hearing
gap (`gapLog`) without drawing anything extra, so the generated court is unchanged.

The five-section layout described below is the v2 "Briefing" build, now replaced.

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
| 2026-10-19 | The dashboard is primarily for the **magistrate**; the bench clerk is secondary. Court terms are fine on screen. | Owner | confirmed |
| 2026-10-19 | Combine the note's sections A–D into one stage-by-stage view, with a control to see everything or one section. | Owner request | implemented |
| 2026-10-19 | "What changed" comes from choosing a period; "what to do first" is a section of its own. | Owner | implemented |
| 2026-10-19 | One comparison rule: the same stretch of the calendar one step back (whole month vs whole month, this month to date vs the same days last month, else the same number of days before). Replaces the mockup's mixed "vs 30 days earlier" / "vs start of range" / "2–31 Aug". | Coordinator review of the owner's mockup, accepted by the build request | implemented |
| 2026-10-19 | Four presets plus a custom range, not eight; "This month" is the default and "Latest day" is dropped (it showed the same numbers with a different comparison). | Coordinator review, accepted by the build request | implemented |
| 2026-10-19 | Counts stay in body ink; only a change is coloured, by good or bad news. | Coordinator review, accepted by the build request | implemented |
| 2026-10-19 | Built on new branch `feature-courtside-dashboard-v3` from `origin/main` `465775a`, which already contains v2. | Owner | confirmed |
| 2026-10-19 | Hearing gaps work for any period (dated gaps from the generator), so there is no "today only" state; the mockup's was a demo-data limit. | Coordinator | implemented |
| 2026-10-19 | Who acts: next dates, applications and judgements are the magistrate's ("You"); chasing unserved process is the office's. | Owner rule (only the magistrate gives next dates) plus coordinator mapping | implemented; mapping not separately confirmed |
| 2026-10-19 | First v3 build rejected: "really poorly build, the standalone designs are much better than this". | Owner | superseded the first v3 layout |
| 2026-10-19 | Build the supplied design screenshots as the dashboard, with "the exact date picker" from the owner's standalone mockup (8 quick picks, single day or range, Cancel/Apply). This reverses the earlier 4-preset recommendation. | Owner, `@ui-designer` tag | implemented |
| 2026-10-19 | DS adaptations of the design: sentence-case labels instead of uppercase eyebrows; DS warning for "past the review point"; disposed series in a second chart colour; DS heading roles (smaller than the design); no decorative teal rules; day bars as focusable HTML buttons; no hover range preview (DS `Calendar` remounts its grid on re-render). | `ui-designer`, within DS Laws | implemented; owner to accept |
| 2026-10-19 | "About the measures and stakeholder coverage" text was written by the builder from code facts; the design did not show it. | `ui-designer` | needs owner text |
| 2026-10-19 | Build `Case Flow Dashboard.html` as the dashboard; it replaces the six-screenshot layout. | Owner, `@ui-designer` tag | implemented |
| 2026-10-19 | Case lists omit the HTML's cheque amount, bank, police station and process route: the docket has no such fields and adding them would change every generated case. | Coordinator | implemented; owner may want them |
| 2026-10-19 | Severity shades: warning-muted / warning / warning-ink (dark mode: destructive for far past, since warning and warning-ink are both yellow there). Hover tooltips replaced by accessible names and text shown when a row opens. Pending split adds "Awaiting registration" so the parts add up. | `ui-designer` | implemented; owner to accept |
| 2026-10-19 | Build the revised `Case Flow Dashboard.html` (Overview, Needs attention by who acts, Trends, How cases were closed; stage table retired). | Owner | implemented |
| 2026-10-19 | Outcome hues use DS categorical chart-1…5 (the design used two teals and three greys); age ramp uses brand tokens; severity shades as before; applications counted once per case; "No activity for 90 days" is 0 in our docket. | `ui-designer` | implemented; owner to accept |
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

**Fourth v3 build, checked 2026-10-19 on `localhost:3000`:** builder renders in
`scratchpad/ui-designer/final3/` (1440/375, light/dark, picker with Compare with, each
comparison mode, single day, Last month, stage list, attention item, trends custom range)
and side-by-sides with the HTML. The coordinator viewed the side-by-sides and re-ran
eslint, tokens, table-rows, ui-sync, spacing (no dashboard hits) and the app suite
(1253/1253). Not checked: keyboard path for this version, far options in the trends month
list, screen reader, 200% zoom, touch. Review not independent.

**Third v3 build, checked 2026-10-19 on `localhost:3000`:** builder renders at 1440/375
light and dark (default, picker, owner filter, row opened, show all, past day, Last
month, range, table list) plus side-by-sides with the HTML; app suite 1250/1250; eslint,
tokens, table-rows, ui-sync pass; typography/spacing fail only on files already failing on
`main`. The coordinator viewed the side-by-sides and re-checked the served page (tile
names, no sideways scroll). Not checked: screen reader, 200% zoom, touch, Indic labels.
Review not independent.

**Second v3 build, checked 2026-10-19 on `localhost:3000` (this checkout, uncommitted):**
the builder captured 1440/1280/1024/375 in light and dark, picker open, Last month, a
custom range (draft and applied), a case list, the gap stage select; no sideways scroll;
keyboard path through the picker and a count list driven over CDP. `court-flow.test.ts`
20/20, app suite 1248/1248, eslint clean, tokens/table-rows/ui-sync pass; typography and
spacing fail only on files already failing on `main`. The coordinator re-ran the flow
tests, eslint and table-rows and viewed the 1440 default, picker and 375 renders.
Not checked: screen reader, 200% zoom, touch devices, Indic labels. Review not
independent (no `ui-reviewer` tagged).

**First v3 build, checked on 2026-10-19, in this checkout (`feature-courtside-dashboard-v3`, uncommitted
on `465775a`) served at `localhost:3000`, DS pin e0cadea6b9d4:**
- Rendered with headless Chrome: Everything at 1440 light; Process with a list open;
  Case status at 1440 dark; Last month on Delayed cases with a past list open; Custom
  range with the calendar open; Everything at 375 light; To do with a list open at 375
  dark. No sideways page scroll at either width (the stage table scrolls inside its
  panel on a phone).
- Last month reads "Sep 2026. Compared with Aug 2026."
- Tests: `court-flow.test.ts` 11/11, including that today's position equals today's
  measures and that a month's opening + in − out = closing, matching the statement of
  pendency. The app suite passes 1239/1239.
- Gates: tokens, ui-sync and table-rows pass; ESLint is clean on the changed files.
  `check:typography` and `check:spacing` fail only on files already on `main`
  (`mobile-hearing-card.tsx:91`, `poa-join-fields.tsx:286`), so `verify:ui` stops at
  lint. `tsc` reports only stale `.next` route types for `/join-case`.

**Not checked (v3):** keyboard path through the period select and calendar, a screen
reader, 200% zoom, other courts' labels. The review was not independent: no
`ui-reviewer` was tagged.

**Open (v3):**
1. The calendar offers days outside the records; the screen clamps the range
   afterwards ([DS request 22](../ds-requests.md)).
2. A past period's case list shows today's stage and next hearing; its days are counted
   to the period's end, and the list says so.
3. "Gaps over twice the usual" is a count only: the gap log does not name cases.
4. The demo shows 166 applications waiting, a generator volume rather than a target.
5. Nothing is committed.

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
