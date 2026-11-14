# Court dashboard and registers
Updated: 2026-11-10
Status: in progress. The Overview redesign is implemented and committed on `feature-courtside-dashboard-v3` (not pushed); v3 is merged to `main` through PR #148

## Current outcome

**2026-11-10, section-by-section redesign (current).** The owner found the v4 dashboard
visually inconsistent. Example: "compared with before" appeared as grey text, red text,
a red pill and small coloured lines. The dashboard is now being redone one section at a
time: agree the content first, then explore directions, then build. The order follows the
note's 1.2: Overview, case status and disposal, time between hearings, outliers, process.

- **Overview (built):** direction 1, "Calm cards". Cases filed, Cases closed and Pending
  today share one card shape: label, count, change, one fact line. Change has one style:
  arrow and amount, coloured only when better or worse, then what it is compared with.
  A new card shows how long pending cases have been in court, in the note's 5.3 groups
  (0–6 months, 6–12 months, 1–2 years, over 2 years), shown as four numbers with their
  share of pending rather than bars. The comparison breakdown and the
  oldest-case line were removed after owner review. The stage path has moved out of the
  Overview into its own panel, with its content unchanged for now. Commits `628b6f73` (comparison
  logic) and `d5994dff` (cards). Exploration artifact:
  https://claude.ai/artifact/C1mN8ALhhcnwpfwG1tSvFj (v3).
- **Case status and disposal (picked, not built):** the "Register shelf", with the court
  term on each card and a plain line under it. It becomes the breakdown of the Overview
  cards (pending by register; closed by how), so no number appears twice.

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
| 2026-10-19 | One comparison rule: the same stretch of the calendar one step back (whole month vs whole month, this month to date vs the same days last month, else the same number of days before). Replaces the mockup's mixed "vs 30 days earlier" / "vs start of range" / "2–31 Aug". | Coordinator review of the owner's mockup, accepted by the build request | superseded the same day |
| 2026-10-19 | Month to date compares with the **whole previous month**, not the same days of it. The picker already says "vs last month"; showing "1–19 Sep" against "1–19 Oct" was wrong. Same rule for year/6-period baselines that step by months. | Owner | implemented |
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
| 2026-10-19 | Trends gets the same date picker as the Overview, replacing its "Show" select and month selects. Its quick picks are Last 6 months, Last 12 months (default), This year, Last year and All records. It has no "Compare with", because each chart already carries its own verdict. A picked range covers its months whole, and the last month is read to the range's last day. | Owner request; picks, no-comparison and whole-month rule chosen by the coordinator | implemented |
| 2026-10-19 | No "Back to …" link beside either date picker: a reset outside the control is poor practice ("If the user wants to change something they will click on the calendar option and change it or reset to default inside that"). Reset now sits in the picker footer, left of Cancel/Apply. It returns the draft period (and, in the Overview, the comparison) to the opening one, and it is applied with Apply. It is disabled when the draft is already the default. | Owner | implemented |
| 2026-10-19 | "Make the data containers more interactive and detailed". The coordinator interpreted this as follows, and `ui-designer` built it: every chart mark shows its value on hover and keyboard focus (DS Tooltip); every case count opens its cases in the panel; Needs attention lists filter by shade; each stage has a Detail disclosure (days-in-stage bands, median/longest, hearings held, usual gap, its lists); each trend opens a DS Sheet with the month-by-month table, the verdict inputs, highest/lowest and the method; the comparison shows what its baseline is made of. Trends moved to `court-dashboard-trends.tsx`. | Owner request (`@ui-designer`); interpretation by the coordinator, not separately confirmed | implemented |
| 2026-10-19 | The Trends chart no longer draws text inside the plot. The "100% level", "3-month average" and "Best"/"Worst" labels overlapped whenever their values sat close together (clearance), so they now appear in a key under the chart, which also gives the values. Worst is a square and best a circle. A month not over is labelled with its year ("Oct ’26"), not "Oct so far", which had pushed "Sep" off the axis. | Owner ("text are overlapping and it looks completely broken"); fix by the coordinator | implemented |
| 2026-10-11 | The shared `ListFooter` now shortens long pagers (first, last, current ±1, with ellipses) above 7 pages, and wraps. Lists of 7 pages or fewer render as before. The calendar register's 255 page links had made the footer about 10,800px wide. | Coordinator (shared component) | implemented |

| 2026-11-10 | Redesign the dashboard **section by section**: content first, then directions, then build. | Owner | confirmed |
| 2026-11-10 | Six re-skins of the v4 Overview were all rejected; the owner asked for fresh directions in simple language. | Owner | confirmed |
| 2026-11-10 | Case status and disposal: **Register shelf** chosen out of six directions. | Owner | confirmed; not built |
| 2026-11-10 | A four-line summary Overview (one line per section) was built as a mock-up and rejected. The owner prefers the filed / closed / pending cards users already know, plus a separate, properly designed age card. | Owner | confirmed |
| 2026-11-10 | Overview **direction 1, Calm cards** chosen out of four (others: cards with 12-month charts; in / out bars; change as chips). | Owner | confirmed; implemented |
| 2026-11-10 | **Month to date compares with the same days of last month** (1–10 Nov against 1–10 Oct). Comparing ten days with all of October made closings read "73% fewer" when they had risen (34 against 32). This reverses the v3 rule that month to date compared with the whole month. Whole months still compare with whole months. | Coordinator proposal, part of the direction the owner picked | implemented |
| 2026-11-10 | The age card uses the note's 5.3 groups instead of "filed in this period / up to 6 months earlier / more than 6 months earlier", whose first group moved with the date range. | Coordinator proposal, part of the chosen direction | implemented |
| 2026-11-10 | The CMP / ST split left the Pending card; it belongs to the case status section. | Coordinator proposal, part of the chosen direction | implemented |
| 2026-11-10 | **"What the comparison is made of" removed.** Owner: the chosen date range and the card's own line ("vs 1–10 Oct (32)") already say what the data is compared with. | Owner | implemented |
| 2026-11-10 | **Oldest pending case line removed** from the age card. Owner: a pathway to one case does not belong there; each age group's count already opens its cases, longest first. | Owner | implemented |
| 2026-11-10 | **Age card: four numbers, no chart** (option 1 of three; others: each group with its change since the period began, or with a 12-month line). Bars by share made the newest group dominate and the old groups slivers. The coordinator recommended the change option; the owner chose the simpler one. | Owner | implemented |
| 2026-11-10 | **Day tag removed from the age card.** It repeated the Pending card's label ("Pending today" / "Pending on 31 Oct"), whose count the age card's title reuses. | Owner question, coordinator agreed | implemented |
| 2026-11-10 | **"Where the pending cases are" leaves the Overview** for its own panel below it, with its own date picker and case list. It is the note's 1.2 C (outlier cases): its core is cases past each stage's limit; stage counts and typical days come from the public dashboard (1.1); in/out and the dot pills are not in the note. Content unchanged until that section is redesigned. | Owner | implemented |
| 2026-11-10 | **Change lines colour only a worse change.** Black for filings beside green for closings was confusing. A better or neutral change now takes the line's muted grey (a first pass in black still read as a colour); a worse one (pending up, closings down) stays destructive ink. The stage panel's red / green over-limit changes are left for that section's redesign. | Owner | implemented |
| 2026-11-10 | **Every fact-line number is a link.** Only "31 still waiting to be registered" opened a list. The coordinator proposed making all fact lines plain; the owner chose the opposite for consistency: disposed, moved to long pending and the long pending register now open their cases too. A zero stays plain. | Owner | implemented |
| 2026-11-10 | **Age card title moved above its box**, as a section heading, instead of inside the border. | Owner | implemented |
| 2026-11-10 | **Age card title shortened** from "How long the 875 pending cases have been in court" to "Pending cases by time in court". The total and the day are already on the Pending card beside it, and each group shows its share "of pending". | Owner asked; wording is the coordinator's | implemented |
| 2026-11-10 | **Stage counts join the Overview as "Pending cases by stage"**, paired with "Pending cases by time in court": both split the Pending card's cases on its day. Round 5 showed three pairings: A (stacked, same cells, CMP / ST band), B (side by side), C (one stage × age table). Owner picked B's layout with A's concept: side by side from xl, same cells, grouped before / after cognizance. The groups are named by cognizance rather than CMP / ST because cases at registration are not on the CMP register yet (round 5 wrongly showed CMP 373; the CMP register holds 342). | Owner; group naming is the coordinator's | implemented |
| 2026-11-10 | **Reversed the same day: option A, with option C as a table view.** The owner switched from B's side-by-side layout to A's stacked boxes, and asked for a toggle to the stage × time table. Cards are the default; a "Cards / Table" segmented control sits on the first heading's row in both views. In the table every non-zero cell opens its cases. The choice is not remembered across reloads. | Owner | implemented |
| 2026-11-14 | **Pending cases by stage moves above time in court.** The 11 Nov call with Satya put the overview cards, then pending by stage, first for every user; the Overview had time in court first. The Cards / Table switch moves with it, so it stays on the first heading's row. The call's other Overview points are not built: stage as one bar chart, time in court as a magistrate-only view one click away, and disposal and time to disposal added. | Owner, from the 11 Nov call | implemented |
| 2026-11-14 | **The Overview date pill shows only the dates until the viewer chooses something.** Opening state: "1–14 Nov 2026" alone, with no "This month" badge and no "vs same days last month". Once the viewer picks a quick pick (Latest day, Last 7 days, Last month, Last 90 days, This year, All records) or changes the comparison (Same period last year, Average of last 6, No comparison), the pill names that choice beside the dates. A custom range is its own dates, so it shows the dates only. Reset returns to the dates-only pill. The cards keep their own "vs 1–14 Oct (57)" lines, so the default comparison stays visible where it applies. Built in the shared picker, so all five dashboard pills follow it (Overview, Stages, Closures, Trends, Needs attention); the "Latest" badge and a custom range's day count went with it. | Owner | implemented |
| 2026-11-14 | **Date picker popover restructured so Apply is always reachable.** It was taller than the window and scrolled as one piece, so Reset / Cancel / Apply sat out of reach below Compare with. Now: quick picks and the month side by side; Compare with runs the full width under both, its four options in two columns; the footer (the drafted range, then Reset, Cancel, Apply) is pinned to the bottom. Only the middle scrolls, and only when the window is short (at 1280 × 900 the whole picker fits; at 640 tall and on a phone the footer stays put). | Owner | implemented |
| 2026-11-14 | **"Pending cases by time in court" becomes a plain table** under the stage cards: Time in court, Cases, Share, one row per group, oldest last, and an All pending row. The four cards gave the two empty groups (1–2 years, over 2 years: 0 in this court, whose records start Dec 2024) as much room as the full ones. In the table an empty group is a quiet row (0, –). Every non-zero count opens its cases, as before. Round 12 on the canvas explored seven other directions (A–G); the owner took none and chose the table. The Cards / Table switch still opens the stage × time table. | Owner | implemented |
| 2026-11-14 | **"How cases ended" and "Time to disposal" join the Overview** (note 1.2, all users b, c and e), between pending by stage and time in court, in both the Cards and Table views. Built from round 13, direction 1, after Satya showed the Kerala public and magistrate dashboards in the 11 Nov call (26:15–32:00 of the recording). How cases ended: contested and uncontested counts with shares and the change in the contested share, then one bar with a block per method (contested first), then every method with a count that opens its cases. Time to disposal: three cards, median days from filing to disposal for all, contested and uncontested, each against the baseline (a rise is worse, so only a rise is red). Contested means a judgment, as `UNCONTESTED` defines it. Colours: the outcome palette of "How cases were closed" (two teals, then neutrals) instead of the canvas's amber, so the panels match and every label keeps its measured contrast. On phones a block shows its count only. "How cases were closed" further down is unchanged and now overlaps; its future is open. | Owner | implemented |
| 2026-11-14 | **Time in court moves above how cases ended**, so the Overview reads: cards, pending by stage, pending by time in court, how cases ended, time to disposal. The two pending sections stay together. The Table view is unchanged (its one table already covers both). | Owner | implemented |
| 2026-11-14 | **The Overview loses its panel; each block gets its own container.** The title "Overview" and the date picker sit on the page. The three cards sit in one raised container; every section below (pending by stage, pending by time, how cases ended, time to disposal, and the stage × time table) has its heading and any switch on the page and its content in its own raised container (card fill, hairline edge, raised shadow, as the panels use). Heading "Pending cases by time in court" shortened to "Pending cases by time" the same day. Other panels (Where the pending cases are, Needs attention, Trends, How cases were closed) keep their panel form for now. | Owner | implemented |
| 2026-11-14 | **Pending by stage and pending by time become one section** in the Cards view: one heading, "Pending cases by stage and time", with the Cards / Table switch beside it, and one container holding the stage cells, a hairline, then the time table. The Table view takes the same heading (was "Pending cases by stage and time in court"), so the heading no longer changes with the switch. | Owner | implemented |
| 2026-11-14 | **Headings and controls go back inside each container.** Headings on the page read as too fragmented. The Overview stays as four separate containers, each now holding its own heading and controls: "Overview" with the date picker and the three cards; "Pending cases by stage and time" with the Cards / Table switch; "How cases ended"; "Time to disposal". The containers sit 16px apart (the page's panels are 32px apart), so they read as one Overview. | Owner | implemented |
| 2026-11-14 | **How cases ended and time to disposal share one container**, each keeping its own heading, with a hairline between them. The Overview is now three containers: Overview with the cards; pending by stage and time; how cases ended with time to disposal. | Owner | implemented |
| 2026-11-14 | **"How cases were closed" leaves the page.** It repeated the Overview's outcomes and median, and counted the long-pending transfer among them, so the page showed 51% decided at trial beside 52% contested. Its conviction rate moves to the contested card ("24 contested · 54% convicted"); closures by day and its own date picker go. The component file (`court-dashboard-closures.tsx`) is now unused. | Owner | implemented |
| 2026-11-14 | **How cases ended reworked for reading.** The owner found it hard to read: three figures spread across the width, the change away from its number, the grouping in colour only, and the smallest methods named only in a 12px legend. Now the bar comes first (a wider gap between the groups), then a column per group: its total, share and change ("Contested 24 · 52%, ▼ 10 pts vs 1–14 Oct"), then a row per method in body text with its count and share. The top line and the legend go. | Owner asked; layout is the coordinator's | implemented |
| 2026-11-14 | **Each group of how cases ended in its own small container**, in the cards' sunken form, as tall as its rows: the two-row Contested box no longer leaves empty space beside the four-row Uncontested one. | Owner | implemented |
| 2026-11-14 | **Replaced the same day: a card per method.** The owner meant cards for the methods, not containers for the groups. Each method is now a sunken card (swatch and name, count that opens its cases, share of disposed), under its group's heading, laid out like the stage cells: contested over two columns, uncontested over four, one row from xl, two cards a row on phones. Each heading carries its total and share, then its change on a second line (uncontested ▲ 10 pts, the mirror of contested), so both rows of cards start level. | Owner | implemented |
| 2026-11-14 | **The bar goes; time to disposal comes first.** The cards and group headings already carry every count and share, so the bar only repeated them; the colour dots on the cards, which keyed them to the bar, went with it. In the shared container, time to disposal now sits above how cases ended, a hairline between them. | Owner | implemented |
| 2026-11-14 | **The missing all-users parts are built** (round 14 on the canvas mapped them against note 1.2). **a(i) Registers**, in the Overview container under the cards: ST pending, ST disposed, CMP pending, CMP disposed, LPR (on the register, moved in this period) and judgments with the last 12 months as small bars (this month's bar lighter); pending uses `pendingSets`' own ST and CMP, so cases awaiting registration are on neither, and a line says so. **b** A third group in how cases ended, "Not disposed": a "To long pending" card, kept out of the contested and uncontested shares. **e** Under the median cards: time to disposal by filing quarter (filed, disposed so far with a bar, median days, still pending and on LPR), read on the period's last day; and "Mediated or not" as two empty cards saying no data yet, since DRISTI does not record mediation. Every count opens its cases. | Owner | implemented |
| 2026-11-14 | **"Not disposed" becomes one line.** The lone "To long pending" card on its own row read as a leftover, and was the third place that count appeared (Cases closed card, LPR tile). Under the method cards now: "1 case moved to the long pending register (2 in 1–14 Oct), not counted in the shares above"; the count opens its cases. | Owner | implemented |
| 2026-11-10 | **The stage panel becomes "Cases running late" (note 1.2 C)**, proposed name: the cases past each stage's limit. In / out, typical days and the day bars are decided in that round; the panel's own date picker goes. Until then the panel is unchanged, so stage counts briefly appear twice. | Coordinator proposal in round 5, not yet confirmed | proposed |

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

**Overview redesign, checked 2026-11-10 against `628b6f73` + `d5994dff` on
`localhost:3000`, which serves this checkout. The DS matches pin `e2cce9b88c2f`.**
- Tests: `court-flow.test.ts` 33/33 pass, including new tests for the same-days
  baseline, the shorter-month case and the age-group boundaries.
- Typecheck: the source is clean. The only errors are stale generated `.next` types for
  `/join-case`.
- ESLint passes on the changed files. `verify:ui` stops at lint because of 4 errors that
  were already in untouched files (`provakil/*`, `case-file.tsx` and others).
- Gates run directly: tokens, ui-sync, table-rows and ds-retired pass. Typography
  (`mobile-hearing-card.tsx:91`) and spacing (5 advocate, filing and join files) fail
  only in files this work does not touch.
- Render, headless, Kerala skin, magistrate seat:
  - Desktop 1440px in light theme and 375px in dark theme, with no horizontal scroll and
    no page errors.
  - "Open the case" opens ST/96/2026, 355 days in court.

**Not checked:** a real screen reader, 200% zoom, Indic labels. This review was not
independent: no `ui-reviewer` was tagged.

**Open:**
- `npm install` has not been run since this branch was fast-forwarded to `main`. The
  package lists changed, and the dev server is running on the old install.
- Case status and disposal (Register shelf) is still to build. Four questions for
  Sathyajith:
  - What counts as "monthly judgments"?
  - What closes a CMP case?
  - Does a move to the long pending register count as a disposal?
  - Is a case that is filed but not yet registered counted as pending?
- Count links stay teal, as on every other panel. The mock-up showed dark numbers; making
  only the Overview dark would create a new inconsistency.
- Stage path, Needs attention, Trends and Closures are not yet redesigned.

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
