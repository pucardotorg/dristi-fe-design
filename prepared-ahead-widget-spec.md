# Prepared-ahead widget: build spec

This document defines how the advocate dashboard widget is calculated and displayed, every edge case agreed so far, the data needed, and test scenarios with expected results.

Items marked **Default** are decisions made so the build is not blocked. The product team can change them later without changing the rest of the logic.

## 1. Purpose

The widget shows an advocate how they handle their pending tasks, and nudges them to finish each task at least one day before its due date. It has three parts:

1. A headline percentage for last week, with the change from the week before.
2. A bar per working day, showing what was on the advocate's plate that day and what they did with it.
3. A callout for today: what is left to do now.

## 2. Core definitions

**Due date.** Every task already has its own due date, taken from the pending tasks page. It depends on the task type. For example, "File reply" may be due 24 or 48 hours before its hearing. **All rules in this spec use the task's due date, not the hearing date.**

**Expiry date.** Every task already has its own expiry date, also taken from the pending tasks page.

**Working day.** A day the court sits, taken from the court's holiday calendar (holidays, vacations, Saturday rules). Sundays and holidays never get a column.

**Day boundary.** A day ends at midnight, local court time (IST). States are judged by calendar day, not by the time of day in the due date.

**Task states.**

| State | Rule |
|---|---|
| Done ahead | Completed on any calendar day before the due date |
| Done on the day | Completed on the due date |
| Overdue | Due date has passed, not completed, not expired |
| Overdue cleared | Completed after the due date |
| Expired | Reached its expiry date without being completed |

Example: a reply is due Monday for a Wednesday hearing. Done Saturday = done ahead. Done Monday = done on the day. Done Tuesday = overdue cleared.

**Ahead verdict.** Each task gets one verdict, "ahead" or "not ahead", recorded at the moment its due date begins (midnight). Completed before then = ahead. Anything else = not ahead. The headline percentage is built only from these verdicts. If the task's due date changes, its verdict is recalculated (section 7).

## 3. Which tasks count

| Task | In the bars? | In the percentage? | Why |
|---|---|---|---|
| Normal task | Yes | Yes | |
| In-court task (for example "be present for the plea", "produce PW-2") | No | No | Can only be done in court on the day. **Default:** if the system has no way to identify these, skip this rule. |
| Late-created task (created on or after its due date) | Yes | No | Could never have been done ahead |
| Task with no due date | No | No | Cannot be judged. Shown as a count in the today callout instead (10.6). |

A late-created task is not overdue when it is created. It behaves like any task due that day: gray if done that day, carried over if left undone.

**Tasks with no due date** are kept off the chart and out of the percentage, but never hidden: the today callout shows how many there are. Whether they should be given a due date is an open question for the product manager (section 14).

## 4. The daily bar: calculation

There is one column per working day. Each column shows the advocate's plate for that day. Segments stack upward from zero.

### 4.1 Segments for a past working day D

| Segment | What goes in it | Counted |
|---|---|---|
| Done ahead | Tasks completed on D that are due after D | Once, on D |
| Done on the day | Tasks completed on D that are due on D | Once, on D |
| Overdue cleared | Tasks completed on D that were due before D | Once, on D |
| Carried to next day | Tasks still open at the end of D that were due on or before D | Every working day they stay open |
| Expired | Tasks that expired on D | Once, on D |

Carried tasks are deliberately counted on every day they stay open. This is the compounding effect. A task cleared on D appears as "overdue cleared" on D, not as carried, so clearing everything in one sitting leaves that day clean.

### 4.2 Today's column

Today isn't over, so nothing in it is carried yet.

| Segment | What goes in it |
|---|---|
| Done today | Completed today, split into ahead, on the day, or cleared as above |
| Overdue, still to do | Open tasks due before today |
| Still to do | Open tasks due today or tomorrow |

At midnight, any open task due today or earlier becomes carried.

### 4.3 Which days get a column

- **Default:** a day gets a column if at least one of the advocate's courts sits that day.
- **Default:** work done on a non-working day (for example Sunday) is shown on the previous working day's column. A task whose due date falls on a non-working day is treated as due on the previous working day.

### 4.4 Never add bars together

Carried tasks repeat across days, so adding bar totals counts one task several times. Every summary number comes from section 5.

## 5. Headline percentage

### 5.1 Last week's score

The headline shows the last completed week (Monday to Sunday). The current week is still in progress. Feedback on it comes from the daily bars.

- **Eligible tasks:** tasks due last week, excluding those left out in section 3.
- **Score:** eligible tasks with an "ahead" verdict ÷ eligible tasks.
- Always show the counts next to the percentage, for example "80% (12 of 15 tasks)".
- Last week's score can change slightly after it is shown, if a task's due date changes (section 7). This is expected.
- **Default:** last week only. Alternative to consider later: the last 4 completed weeks, which gives a steadier number when weeks are small.

### 5.2 Change from the week before

- **Change** = last week's score − the week before's score, shown in points (for example "up 10 points", not "up 14%").
- If either week has no eligible tasks, show no change.

### 5.3 Optional backlog number

Count **task-days**: one for each task carried over at the end of each working day. Label it plainly, for example "12 task-days carried over last week".

## 6. Ready ticks

A working day gets a tick when:

1. it had at least one eligible task due that day, and
2. all of those tasks were completed before that day, and
3. nothing was carried over and nothing expired on that day.

- A tick can appear alongside done ahead, done on the day, or overdue cleared segments.
- It never appears with carried or expired segments.
- A day with no tasks due and no activity is blank: no bar, no tick.

## 7. Due date changes

**Rule: always use the task's current due date.** If a task's due date changes, for any reason (adjournment, hearing moved earlier, any edit), the task is recalculated as if it had always had the new due date. Its old carried marks, expired mark and verdict are removed, and the affected days are rebuilt.

### 7.1 Example: adjournment

A reply is due on the 8th for a hearing on the 10th. It isn't done, so it shows as carried on the 8th and 9th. On the 10th, the hearing is adjourned to the 24th, and the reply is now due on the 22nd.

- The carried marks on the 8th and 9th are removed.
- The verdict recorded on the 8th is removed.
- The task is now an ordinary task due on the 22nd. Its verdict is recorded on the 22nd.

Known trade-off: an advocate saved by an adjournment will look clean. This is accepted to keep the rule simple.

### 7.2 Completed tasks

- A completed task keeps its segment on the day it was completed.
- If its due date later changes, its verdict is recalculated against the new due date.

### 7.3 New due date already reached

If, at the moment of the change, the new due date is today or earlier, treat the task like a late-created task: shown in the bars, left out of the percentage.

### 7.4 Case closed (settled, withdrawn, disposed)

- Unfinished tasks for the closed case are removed completely: past marks and verdicts included.
- Completed tasks keep their segments and verdicts.

### 7.5 Tasks created again

If a task expires and a similar task is created later, they are treated as two separate tasks. The old one keeps its expired mark. The new one is judged on its own due date. No attempt is made to detect duplicates.

### 7.6 Rebuilding

When a task's due date changes, rebuild that advocate's daily snapshots and verdicts from the earlier of the old and new due dates up to today.

## 8. Expired tasks

- An expired task shows as an expired segment, once, on the day it expired (the task's own expiry date).
- From that day, it stops being carried.
- Its verdict was already recorded as "not ahead" when its due date arrived.
- The day it expired gets no tick.

## 9. Other edge cases

| Case | Default rule |
|---|---|
| Task reopened after being completed | It becomes open again from the moment it is reopened. The final completion time is used for segments. A verdict already recorded does not change. |
| Task reassigned to another advocate | Each event (completion, carry, expiry) counts for whoever was assigned at that moment. A verdict counts for whoever was assigned when the due date arrived. |
| Data corrected after a day has passed | Past snapshots are rebuilt when a due date changes (7.6), or by an admin-only rebuild for bug fixes. |
| Advocate with no history yet | Show the empty state (section 10.7). |

## 10. Display

### 10.1 Window

- Show the last 10 working days plus today: about two weeks.

### 10.2 Colours

Light-mode reference values. Use the matching design-system tokens for dark mode.

| Segment | Style | Light-mode colour |
|---|---|---|
| Done ahead | Solid | Blue `#2a78d6` |
| Done on the day | Solid | Gray `#b4b2a9` |
| Overdue cleared | Solid | Coral `#d85a30` |
| Carried to next day | Solid | Light coral `#F5C4B3` |
| Expired | Solid | Dark coral `#712B13` |
| Today: overdue, still to do | Dashed outline, no fill | Coral `#d85a30` |
| Today: still to do | Dashed outline, no fill | Gray `#888780` |

Stack order from the bottom: done ahead, done on the day, overdue cleared, carried, expired, then today's dashed segments on top.

### 10.3 Bars

- Show the total count above each bar. Today shows "X done, Y to do".
- Hover (desktop) or tap (mobile) shows the count for each segment.
- Days are labelled under each column, for example "Mon 9".
- The y-axis maximum is the tallest bar, rounded up to a clean number.
- Outlier rule: if the tallest bar is more than 3 times the second tallest, cap it at 3 times the second tallest, draw a break in the bar, and write the real number on top.
- Today's column label is emphasised. A thin divider separates it from past days.

### 10.4 Ticks

- A small blue check badge sits at the base of the column (above the bar, if there is one).
- Its tooltip reads "All tasks ready before this day".

### 10.5 Headline

- A large percentage, the counts underneath ("12 of 15 tasks done ahead"), and the change ("up 10 points from the week before").
- Labelled "Last week".

### 10.6 Today callout

- "Today: X due tomorrow, Y left from today, Z overdue."
- If any tasks have no due date (section 3): "X tasks with no due date". Hide when zero.
- If everything up to a future date is done: "You're ready through [date]."
- Tapping it opens the pending tasks page.

### 10.7 Footnote and empty state

- Footnote under the chart: "Working days only. Not counted: X in-court tasks, Y tasks created on their due date." Hide any part that is zero.
- Empty state, when there are no tasks in the window: "Your preparation history will appear here once you have tasks due."

### 10.8 Legend

- Shown above the chart. Only list segments that appear in the current window.

## 11. Data to capture

Most task fields already exist on the pending tasks page and are borrowed from there.

### Task

| Field | Used for |
|---|---|
| `task_id`, `matter_id`, `hearing_id` | Linking |
| `task_type` | Identifying in-court tasks (section 3) |
| `due_at` (already exists) | Every state, segment, tick and verdict |
| `expires_at` (already exists) and `expired_at` | Expired segment (section 8) |
| `created_at` | Late-created rule (section 3) |
| `completed_at` and completion history (completed, reopened, with timestamps) | Segments; reopened tasks (section 9) |
| `assignee_id` and assignment history | Reassigned tasks (section 9) |
| Due date change log: old due date, new due date, `changed_at` | Knowing which days to rebuild (7.6) |

### Hearing

| Field | Used for |
|---|---|
| `hearing_id`, `court_id` | Linking and the court calendar |
| Current `hearing_date` | Recalculating due and expiry dates |

### Case

| Field | Used for |
|---|---|
| `case_closed_at` and reason | Section 7.5 |

### Court calendar

| Field | Used for |
|---|---|
| `court_id`, working weekdays, Saturday rules, holidays and vacations per year | Which days get a column (4.3) |

### Nightly jobs

1. **Verdicts:** at midnight, record the ahead verdict for every eligible task whose due date begins that day.
2. **Daily snapshot:** after midnight, store each advocate's segment counts for the day that just ended, plus the tick result.

Past days are read from snapshots. Only today's column is calculated live. When a due date changes, rebuild the affected snapshots and verdicts straight away (7.6).

## 12. Test scenarios

All tasks are normal tasks unless stated. Mon to Sat are working days.

| # | Situation | Expected bars | Expected verdict |
|---|---|---|---|
| 1 | Due Mon, done Sat | Done ahead on Sat; tick on Mon | Ahead |
| 2 | Due Mon, done Mon | Done on the day on Mon; no tick on Mon | Not ahead |
| 3 | Due Mon, done Wed | Carried on Mon and Tue; overdue cleared on Wed | Not ahead |
| 4 | Due Mon, never done, expires Thu | Carried on Mon, Tue, Wed; expired on Thu; nothing after Thu; no tick on Thu | Not ahead |
| 5 | Created Mon, due Mon, done Mon | Done on the day on Mon | None (left out of the percentage) |
| 6 | Due Mon; hearing adjourned on the Thu before, new due date the following Mon | Nothing on the first Mon; judged on the new Mon | Recorded on the new Mon |
| 7 | Due Mon, not done; hearing adjourned on Wed, new due date in two weeks; done Fri | Carried marks on Mon and Tue removed; done ahead on Fri | Ahead (recorded on the new due date) |
| 8 | Tasks due Tue, Wed, Thu, Fri, all done Mon | Tall done ahead bar on Mon; ticks on Tue to Fri | All ahead |
| 9 | Task due Mon done on the Sunday before | Done ahead on Sat (previous working day) | Ahead |
| 10 | Last week: 1 of 2 tasks ahead; week before: 3 of 4 | Headline "50% (1 of 2 tasks)", "down 25 points" | n/a |
| 11 | Due Mon, not done; case closed on Wed | Carried marks on Mon and Tue removed; nothing from Wed | None (verdict removed) |
| 12 | Day with only an expired task | Expired segment; no tick | n/a |
| 13 | Due Mon, expired Tue; a similar task created Wed, due next Mon; done Thu | Old task: carried on Mon, expired on Tue (stays). New task: done ahead on Thu | Old: not ahead. New: ahead |
| 14 | Due date edited on Wed from Mon to next Mon, task not done | Same as scenario 7: Mon and Tue marks removed | Recorded on next Mon |
| 15 | Task with no due date | Not on the chart; counted in the callout | None |

## 13. Defaults already in the spec

The build can proceed with these. Change any of them later if the team decides differently.

1. Work and due dates on non-working days go to the previous working day (4.3).
2. Headline uses last week only, not the last 4 weeks (5.1).
3. In-court tasks are skipped if the system cannot identify them (section 3).
4. Reassigned tasks count for whoever was assigned at each event (section 9).
5. Any due date change recalculates the past, accepting that advocates saved by adjournments will look clean (section 7).
6. Tasks created again are separate tasks; no duplicate detection (7.5).
7. Tasks with no due date stay off the chart and appear as a count in the callout (section 3).

## 14. Questions for the product manager

1. **Re-created tasks:** how often is a task that expired created again (or a very similar one created) for a new date? If it is common, should the old expired mark be removed? That would need a reliable way to link the two tasks.
2. **Tasks with no due date:** should these tasks get a due date (for example, the working day before the case's next hearing), so they can be measured like everything else?
