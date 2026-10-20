# Sign A-Diary
Updated: 2026-10-20
Status: implemented

## Current outcome

**2026-10-20 — aligned with `dristi-be/PRDs/a-diary.md` v1.5.** The A-Diary is signed
a whole day at a time: **Sign the A-Diary for <date>** sits beside the date picker and
opens one document of that day's entries, built at that moment from the entries as they
stand (`ADY-12`, `ADY-12a`). Only a day that is over can be signed; on today the button's
place says so in words (`ADY-12b`). The entry dialog no longer signs: its one act is
**Save**, and the order beside the editor stays as signed while the entry changes
(`ADY-09`, `ADY-10`). The header and the rail count days waiting, not entries. Signing a
day leaves a "signed" empty state for that day. New file
`apps/dristi-app/src/components/employee/sign-a-diary-day-dialog.tsx`.

**2026-10-20, later — the A-Diary table (`ADY-03`, `ADY-03a`, v1.6).** The date picker
marks unsigned days with a dot (spoken as "unsigned", with a legend), built from
`Popover` + `Calendar` because the DS `DatePicker` cannot mark days. The table has four
columns — Case (name and number), Hearing (date and purpose, blank outside a hearing),
Proceedings, Next hearing (date and purpose) — and the signed day document uses the same
table. Entries now carry `hearing`; seed `ST/665` is an order passed outside a hearing.

Earlier (2026-09-15):
The Sign A-Diary date row is only the **A-Diary dated** picker. The ghost **Show today**
control that sat beside it is gone. Picking a day still shows that day's register;
clearing the picker still means today. The empty state for another day still offers
**Show today's diary**.

Built in `apps/dristi-app/src/components/employee/sign-a-diary-screen.tsx`.

## Decisions

Date | Decision and reason | Source/person | Status
---|---|---|---
2026-10-20 | Sign the whole day as one document, only once the day is over; the PDF is generated at signing. Entry dialog edits only. | owner, `a-diary.md` §5 | implemented
2026-10-20 | Editing an entry changes the A-Diary text, never the order text; entries now carry `orderText` separately, and the order is shown as signed (an entry exists only once its order is triggered, `ADY-05`). | owner, `a-diary.md` `ADY-05`, `ADY-09` | implemented
2026-10-20 | Picker shows unsigned days; A-Diary is a four-column table on screen and in the signed PDF. | owner, `a-diary.md` `ADY-03`, `ADY-03a` | implemented
2026-09-15 | Remove the filter-row **Show today** button. The calendar already names the day; a second control on the same row restated that. Return from an empty other day stays on that empty state. | owner (live UI) | implemented

## Changes and tradeoffs

Rejected keeping the ghost button as a labelled shortcut back to today. The picker is
the only filter, and "no day" is not a view this screen has.

## Verification and open work

`npm run verify:ui` passed on this checkout (DS pin e0cadea6b9d4). Live check on
`http://localhost:3000/employee/sign-a-diary` (this checkout): the filter row is only
**A-Diary dated**; picking 13 Sept shows the empty state with **Show today's diary**;
that control returns to 15 Sept; 14 Sept still lists the two unsigned entries. Checked
desktop light, desktop dark, and ~375px. Independent UI review was not run for this
correction.

2026-10-20: unit tests pass (`sign-a-diary.test.ts`, 67 across the run). `check:tokens`,
`check:ui-sync`, `check:rails` pass; `verify:ui` stops on a typography failure in
`advocate/mobile-hearing-card.tsx`, which is unchanged from `origin/main`. Live check on
`http://localhost:3065` (worktree `a-diary-day-signing`) through the page and DOM: today
shows "can be signed once the day is over" and no button; 19 Oct shows the button;
saving a corrected entry leaves the order text unchanged; the day document carries the
correction; signing empties the day, shows the signed state and returns focus to the
page title. **Screenshots pending** — the Browser pane was hidden, so no visual or
dark-mode check was captured. The rail count is static demo data and does not drop when
a day is signed in the visit. Independent UI review was not run.
