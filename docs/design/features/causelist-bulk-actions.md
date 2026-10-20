# Bulk actions on the cause list
Updated: 2026-10-20
Status: implemented (checked on the render; not independently reviewed)

## Current outcome

A **Bulk** button on Today's hearings switches the cause list into bulk mode: a checkbox
on every row and a select-all box in the header. A bar at the foot of the page counts
the selection and holds the act. **Exit bulk** leaves the mode and clears the selection.
`components/employee/cause-list-bulk.tsx`, `hearings-screen.tsx`, `hearings-table.tsx`.

- **Filters** — the existing Filters button and right-hand sheet, not a second set of
  controls. It now holds **Advocate**, **Case stage** and **Purpose**, each a
  multi-select dropdown (the DS `Combobox` with chips, as the join dialog's PoA picker
  uses it; type to narrow), plus the hearing date. Each picked value is its own removable
  chip on the row. Available with or without bulk mode. Added to `CourtFilters` as
  `multi` fields (`components/employee/court-filters.tsx`).
- **Reader** — only when the court setting *Next hearing entered by* is **Reader**
  (Pending orders flow). **Bulk actions** opens one pop-up with three parts, applied
  together by one press:
  - **Hearing**: Leave as it is · End hearing · Pass over. Hearings the choice cannot
    take (already ended; or, for Pass over, already ended or passed over) are named in
    the pop-up; the date and purpose still apply to them.
  - **Next hearing date** (the row's load calendar, with "Not listed again") and **Next
    hearing purpose** — each opens on *Leave as it is*.
  - The case stage is not set here or anywhere on the cause list; it is a filter only.
  The pop-up is the pause before an outcome; there is no second confirmation.
- **Steno** — Pending orders flow, typist seat. **Add text to orders** opens one text
  box; the text is added at the end of each selected hearing's order (screen E's draft,
  `editor:<id>`), and each order then shows in Pending orders as Drafting. Orders already
  sent for signing or signed are left out and named. Nothing is sent for signing.
- **Select all** takes every hearing in the filtered list, across pages. A tick hidden
  by a later filter is not acted on.
- Magistrate, scrutiny officer, Classic flow, or the setting on Steno: no Bulk button.
- **Demo data** — Court settings → More settings → *Demo data*: **Orders in every
  state** (default) or **Empty day**. Orders in every state opens twelve of today's
  hearings as heard, with three orders in each Pending orders stage: Drafting (items 8,
  9, 12), Awaiting signature (1, 4, 6), Order data to fill (5, 7, 11), Triggered (2, 3,
  10). Empty day has nothing heard and no order. Switching reloads this browser's
  hearings and orders from the choice; Reset sandbox data reloads the chosen one.
  Applications are not touched by the switch. `lib/employee/sample-sitting.ts`,
  `lib/employee/demo-seed.ts`, `loadDemoSeed` in `lib/employee/sandbox-reset.ts`.

## Pending orders and court settings (same day)

- **Status column** — Signature and Order data are one column, two pills side by side
  ("Awaiting signature" / "Signed", "Data to fill" / "Data complete" / "Data
  triggered"). `components/employee/pending-orders-screen.tsx`.
- **Order column** — on the Order data to fill tab, the order's first ten words after
  any opening attendance sentences ("Complainant present. Accused absent."), which are
  skipped (`orderTextPreview`, `lib/employee/order-bulk-items.ts`).
- **Steno bulk** — the steno ticks signed orders with order data to fill and presses
  **Add order items**: a modal with a multi-select of the catalogue's items (everything
  the order data panel offers outside a hearing). Each is added to every selected
  order's order data the way the panel adds it. Under the field, **Likely at these
  hearings** offers the panel's own suggestions for the selected hearings' purposes; a
  click adds one. An item an order already has, or that
  the catalogue forbids beside its other items, is left out of that order and named in
  the result line. Items with details of their own are added unfilled; the order's own
  completion check asks for them. Hearing orders only.
  `components/employee/pending-orders-bulk.tsx`, `lib/employee/order-bulk-items.ts`.
- **Court settings** — the rail's settings menu is now a pop-up. **Working as** and
  **Court** are full-size at the top; everything else is a small select under
  **More settings**, open by default, with Reset sandbox data last. A new setting is one entry in the
  `more` list in `employee-nav.tsx`. Internal demo control; kept plain on purpose.

## Decisions

| Date | Decision and reason | Source | Status |
|---|---|---|---|
| 2026-10-15 | Reader gets a Bulk button when the reader enters the next hearing: checkboxes, filters by advocate, case stage and purpose, select one or all, then mark completed or passed over, or set stage, date and purpose. | Owner | Implemented, stage setting later removed |
| 2026-10-20 | The Classic flow is removed, so the steno's Bulk button no longer depends on the order flow: the typist seat always has it. | Owner | Implemented |
| 2026-10-15 | Steno can select several hearings and type one text that goes to all their orders. | Owner | Implemented |
| 2026-10-15 | Stage was first settable in bulk; the case stage cannot be changed by the user, so it was removed. Stage is a filter only. | Owner | Implemented |
| 2026-10-15 | The steno's text is **added** after whatever each order already says, never replaces it. | Implementation choice | Implemented — confirm |
| 2026-10-15 | First built as inline dropdowns shown in bulk mode; replaced by the existing Filters sheet. | Owner | Superseded |
| 2026-10-15 | Every filter is multi-select. First built as tick-box groups (the Cases sheet's `CheckGroup`); replaced by multi-select dropdowns. | Owner | Implemented |
| 2026-10-15 | First built as a menu of three separate acts; replaced by one pop-up so ending the hearing and setting date and purpose happen together. | Owner | Implemented |
| 2026-10-15 | Advocate and Stage filters stay in the sheet outside bulk mode too. | Implementation choice | Implemented — confirm |
| 2026-10-15 | No separate confirmation after the pop-up. | Implementation choice | Implemented |
| 2026-10-15 | Pending orders: Signature and Order data in one column; order text column on Order data to fill; steno bulk-adds order items from a multi-select modal. | Owner | Implemented |
| 2026-10-15 | Court settings as a pop-up: Working as and Court prominent, the rest small and folded. | Owner | Implemented |
| 2026-10-15 | Sample data: three orders awaiting signature and three with order data to fill. Their hearings open as completed. | Owner (hearings completed: implementation choice) | Superseded by the setting below |
| 2026-10-15 | Demo data setting: orders in every state, or a fully empty day. Three orders per stage, Drafting and Triggered added. Switching does not touch applications. | Owner (counts and applications: implementation choice) | Implemented |

## Verification and open work

Checked on the render at `http://localhost:3030` (worktree `causelist-bulk-actions`,
DS pin `e0cadea6b9d4`), 1512px, light theme:

- Reader: Filters sheet with two advocates ticked (chips on the row); Bulk on; select
  all (11); one pop-up with End hearing + date + purpose — 9 ended, 2 already-ended named
  and skipped, date and purpose on all 11. After the later changes: two advocates picked
  in the multi-select dropdown; the pop-up shows Hearing, date and purpose only.
- Steno: Bulk on; 2 selected; text added; both orders listed in Pending orders as
  Drafting; text present in screen E reached from the cause list.
- Pending orders (steno): Status pills together; Order column; selected all three
  orders to fill; added Issue of warrants to all three; it shows in the order's items.
- Court settings pop-up: opened, More settings expanded, seat switched to Typist from it.
- Demo data: Empty day → every Pending orders tab 0; Orders in every state → 3 · 3 · 3 · 3.
- `npm test`: 1,216 pass (15 new, in `lib/employee/cause-list-bulk.test.ts` and `order-bulk-items.test.ts`). Typecheck
  and lint clean on changed files. `check:ds-fresh`, `check:tokens`, `check:ui-sync`,
  `check:rails`, `check:table-rows` pass. `check:typography` and `check:spacing` fail on
  files identical to `main`.

Not checked or not done:

- Dark theme; phone layout (the phone list has the checkboxes, unchecked on the render).
- Magistrate seat's absence of the button — by code, not on the render.
- **Existing editor behaviour, not new:** screen E's text field reads its value only when
  it mounts, so an order opened by a full page load (typed URL, reload) shows an empty
  text box even though its text is saved. Reached from the cause list or Pending orders
  it shows. Affects any saved order, not only bulk-added text.
- Who may make these marks is a view rule, not a permission.
