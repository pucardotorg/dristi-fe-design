# Next hearing from the cause list, and cause-list columns
Updated: 2026-10-20
Status: implemented (checked on the render; not independently reviewed)

## Current outcome

The next hearing's date and purpose can be set on the cause list instead of in the
order. Whether it is entered there or in the order is a court setting. The cause list's
columns can be shown, hidden and reordered per seat, as the advocate Cases list allows.

- **Setting** — Court settings → *Next hearing entered by*: **Reader, on the cause list**
  (default) or **Steno, in the order**. Pending orders flow only; Classic (screens A–D)
  always takes it in the order. `lib/employee/next-hearing-entry.ts`,
  `components/employee/use-next-hearing-entry.ts`.
- **Reader enters it** — the reader (bench clerk) gets a **Next hearing** column on every
  row, whatever its status: a date field over a purpose field
  (`components/employee/next-hearing-fields.tsx`). The date opens a large calendar with
  the number of hearings already listed under each day, and the chosen day broken down
  by purpose beside it (`lib/employee/listing-load.ts`). "Not listed again" is in the
  same pop-up. The same two fields sit at the top of the case overview for that seat.
  Order screen E shows the values read-only, with "Set on the cause list."
  (`components/employee/cause-posting.tsx`, `order-composer.tsx` `NextHearingSection`).
- **Steno enters it** — no Next hearing column for any seat; order screen E's fields are
  editable as before.
- **End hearing** only ends the hearing. The posting is its own act.
- **Columns** — Edit columns beside the sort control: a tick per column, Show all,
  Reset to default; headings drag to reorder (Alt + ←/→ from the keyboard). Saved per
  seat in this browser. `lib/employee/cause-list-columns.ts`,
  `components/employee/use-cause-list-columns.ts`,
  `components/employee/cause-list-columns-menu.tsx`, `hearings-table.tsx`.
  - Full set: S. no., Case name (both locked on), Case number, Advocates, Purpose,
    Stage (new), Status, Orders, Action, Next hearing.
  - Reader default (setting on Reader): S. no. · Case name · Case number · Advocates ·
    Purpose · Action · Next hearing.
  - Magistrate default: the board as it was. Steno default: the board as it was, no
    Action (the seat has no session controls).
  - Next hearing is offered only to the reader, and only when the setting is Reader.
- The posting is kept with the sitting's marks (`lib/employee/hearing-session.ts`,
  `postings`) and laid over the order's draft on screen E
  (`withCausePosting` in `lib/employee/order-draft.ts`; `order-door-screen.tsx`,
  `pending-order-screen.tsx`, `application-order-triggers.tsx`).

## Decisions

| Date | Decision and reason | Source | Status |
|---|---|---|---|
| 2026-10-15 | Next hearing date and purpose are set on the cause list by the reader; the order's fields stay but are disabled. | Owner | Superseded in part by the setting below |
| 2026-10-15 | The date picker is a large calendar showing hearings already listed per day, with a by-purpose breakdown for a chosen day. Counts are indicative, not accurate. | Owner | Implemented |
| 2026-10-15 | Counts come from the dashboard's demo court (`court-docket.ts`) plus postings set today, so the calendar and the dashboard do not disagree. | Implementation choice | Implemented |
| 2026-10-20 | Classic and screens A–D are removed, so the setting applies everywhere; the "Pending orders flow only" limit no longer exists. | Owner | Implemented |
| 2026-10-15 | Applies to the latest order screen (E, Pending orders flow) only. | Owner | Superseded 2026-10-20 |
| 2026-10-15 | First built as a window on End hearing; replaced by editable fields on the cause list and in the case overview, with End hearing just ending. | Owner | Implemented |
| 2026-10-15 | Fields on every hearing, started or not; one combined column; table narrower. | Owner | Implemented |
| 2026-10-15 | Magistrate and steno do not get the column; for the reader, Status and Orders go and Action moves before Next hearing. | Owner | Implemented as seat defaults |
| 2026-10-15 | Columns configurable like the advocate Cases list; the owner's layout is the default; the full set of known columns is offered. Stage added as a new column. | Owner (Stage: implementation choice) | Implemented |
| 2026-10-15 | Court setting for who enters the next hearing: Reader (column on the cause list, order read-only) or Steno (no column, order editable). Default Reader. | Owner (default: implementation choice) | Implemented |
| 2026-10-15 | Only the next hearing is locked in the steno's order, in a subtle read-only grey that keeps the value legible. | Owner | Implemented |

## Changes and tradeoffs

- **Read-only, not disabled, in the order.** A disabled control inside the order's paper
  made the DS input group around the paper dim itself to 50% (`has-disabled:opacity-50`),
  so the whole order looked locked. Read-only inputs use the DS read-only dress
  (`bg-muted`, `text-foreground`) and do not trigger it.
- **Width.** The reader's default board fits a 1512px laptop with the rail open
  (1127px panel, measured). The drag grips sit in the heading's left padding so they cost
  no width. Narrower than about 1470px the board still scrolls sideways.
- **Calendar stays open on a pick**, so the chosen day's breakdown can be read; Done or
  Esc closes it.
- **Clicks inside the fields** are kept from reaching the row, which otherwise opens the
  case overview (portalled pop-ups still bubble through React).

## Verification and open work

Checked on the render at `http://localhost:3027` (worktree `causelist-next-hearing`,
DS pin `e0cadea6b9d4`), 1512px, light theme:

- Reader: default columns; date calendar with counts and breakdown; purpose select;
  posting reaches the case overview and order E; End hearing ends with nothing between;
  Edit columns show/hide, keyboard reorder, Reset; no sideways scroll at 1512px.
- Magistrate and steno: original boards; no next-hearing fields in the overview.
- Setting on Steno: no Next hearing column offered; order E editable.
- Steno's order E with setting on Reader: order editable, next hearing read-only and
  legible.
- `npm test`: 1,201 pass. Typecheck and lint clean on changed files. `check:tokens`,
  `check:ui-sync`, `check:table-rows` pass. `check:typography` and `check:spacing` fail
  on files identical to `main` (`advocate/mobile-hearing-card.tsx`,
  `advocate/advocate-shell-home.tsx`, `advocate/companion-rail.tsx`,
  `join/poa-join-fields.tsx`).

Not checked or not done:

- Dark theme; phone layout (phone rows keep the old card layout and have no column
  chooser — owner asked for no phone checks).
- Review was the coordinator's own, not an independent `ui-reviewer`.
- The order screen's own *Next case* still ends a hearing without a posting; the reader
  sets it on the cause list afterwards.
- Who may set the posting is a view rule, not a permission; a real build decides that.
