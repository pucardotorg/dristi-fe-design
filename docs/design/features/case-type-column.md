# Case type column
Updated: 2026-11-04
Status: implemented (branch `feature-case-type-column-build`, not merged)

## Current outcome

Case type is an optional column, off by default, in three tables. People add it from
the table's Edit columns menu. It reads **S138/NIA**.

| Table | Side | What changed |
|---|---|---|
| All Cases (`/cases`) | Advocate | Option added to the existing Edit columns menu; sits after Case name |
| Today's hearings (`/employee/hearings`) | Court | Option added to the existing Edit columns menu; sits after Case number, hidden for every seat |
| Pending orders (`/employee/pending-orders`) | Court | Gains the court Edit columns menu (icon at the right end of the tabs row). Case type is its only option; the other columns are listed ticked and locked |

The File a case flow already had a Case type column (filings queue). It now reads the
same short form.

Files: `lib/filing/options.ts` (label), `lib/cases/table-columns.ts`,
`components/cases/case-field.tsx`, `lib/employee/cause-list-columns.ts`,
`components/employee/hearings-table.tsx`, `components/employee/columns-menu.tsx`
(shared menu), `components/employee/use-pending-order-columns.ts`,
`components/employee/pending-orders-screen.tsx`.

## Decisions

| Date | Decision and reason | Source | Status |
|---|---|---|---|
| 2026-11-04 | Case type belongs on the advocate Home and All Cases, already in File a case; not on pending tasks, raising an application or joining a case, which are already about one case | Stakeholder call notes | Partly built: Home open |
| 2026-11-04 | Court tables (Today's hearing, Pending order) offer it as an optional column through Edit columns; whether courts are specialised (NI Act only) is still to be checked | Stakeholder call notes | Built |
| 2026-11-04 | Short form, not the full Act name: **S138/NIA** | Neer | Built |
| 2026-11-04 | Not visible by default; an option people add if they want it | Neer | Built |
| 2026-11-04 | Don't add new controls the brief doesn't ask for. An Edit columns menu proposed for the advocate Home's cause list popup was rejected | Neer | Applied |
| 2026-11-04 | Pending orders gets the Edit columns icon, because the brief names that table as offering case type through Edit columns | Neer | Built |
| 2026-11-04 | Pending orders' menu reuses the Today's hearings menu (moved into a shared component), Case type its only option, so nothing else about the table changes | Implementation choice | Built |
| 2026-11-04 | S25 of PSA becomes S25/PSA, so the filings queue column doesn't mix two styles | Implementation choice | Built; owner to confirm |
| 2026-11-04 | A column added after someone saved a column choice takes its default slot, not the end, so a saved default stays the default | Implementation choice | Built |

## Changes and tradeoffs

- Two pilot courts in `lib/court/profiles.ts` (Panchkula; Kerala) are special NI Act
  courts, which supports off-by-default on the court side.
- Case records don't carry a case type yet; every case is §138, so every row reads
  S138/NIA. When a second type reaches court records, the cells should read the
  record's own type.
- Advocate Home has no table (hearing cards and a side rail). A case-type tag on the
  cards would be always on, which contradicts off-by-default, so nothing was built there.

## Verification and open work

Checked on the running app (localhost:3000, this checkout), headless, 2026-11-04:
Pending orders and Today's hearings start without the column; the menu ticks it on;
cells read S138/NIA; focus returns to the Edit columns icon; the choice survives a
reload. Pending orders also checked at 375px and in dark mode. All Cases renders the
column after Case name. Tests: 1063 pass (`lib/employee`, `lib/cases`, `lib/filing`).
DS gates touching these files pass. The review was the coordinator's own, not
independent.

Open:
- **Advocate Home**: where case type goes, given there's no table — back to the stakeholders.
- Whether courts handling several case types should default the column on.
- Confirm S25/PSA for the PSS Act.
