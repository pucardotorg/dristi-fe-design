# Take cognizance — PRD alignment and View case
Updated: 2026-10-13
Status: implemented

## Current outcome

The Take cognizance case screen now matches the Cognizance Cheat Sheet PRD (v6) on
fields 1–12 and the files, and carries the PRD's View case button (§6). View case opens
the court's case view: the advocate's case screen, from the same code, read as the court.

- Screen: `apps/dristi-app/src/components/employee/cognizance-case-screen.tsx`
- Fields, chain, documents: `apps/dristi-app/src/lib/employee/cognizance.ts`
- Shared case view: `apps/dristi-app/src/components/cases/case-detail.tsx`, routed at
  `/cases/[caseId]` (advocate) and `/employee/cases/[caseId]` (court)
- Reader switch: `apps/dristi-app/src/lib/cases/case-reader.ts`,
  `apps/dristi-app/src/components/cases/case-reader.tsx`

## Decisions

| Date | Decision and reason | Source | Status |
|---|---|---|---|
| 2026-10-13 | Fix PRD mismatches 1–6: filing date on both tabs; drop date of receipt of information (PRD v3); notice check from the return memo date with the v4 sentence; label "Reason for return of cheque"; PRD tooltip on date of return of demand notice; cheque facts and files repeat per cheque | Owner | Implemented |
| 2026-10-13 | Leave the extra jurisdiction check and the case summary strip (not in the PRD) as they are for now | Owner | Open |
| 2026-10-13 | View case leaves the cognizance screen exactly as it is and opens the case in a new tab | Owner | Implemented |
| 2026-10-13 | The court's case view is the advocate's, minus Share access, with Generate order in place of Make filings — same code, conditional on who the user is, never duplicated | Owner | Implemented |
| 2026-10-13 | Several cheques are captioned "Cheque n of N"; one-cheque files keep the unnamed chunks (owner, 2026-09-15) | Implementation choice | Implemented |
| 2026-10-13 | The court view drops the advocate's back arrow; the court top bar's trail is the way back, and a new tab has nothing to go back to | Implementation choice | Implemented |

## Changes and tradeoffs

- `CognizanceCase.cheques[]` replaces the single `returnReason` / `presentedAfterDays`. The
  first cheque's memo is the earliest, and the notice check counts from it. CMP/2038/2025
  (NACT/2038/2025 in Punjab & Haryana) carries two cheques as the sample.
- Case links are still built as `/cases/…`; `CaseLink` and `useCaseRouter` move them under
  `/employee` for the court. Threading a base path through every href helper was rejected
  as a wider change for the same result.
- A cognizance complaint is not an advocate case record, so the court route builds one
  from the queue row (`cognizanceCaseRecord`).
- Generate order opens the cognizance order door, the only order screen outside a hearing
  on `main`. Elsewhere the button is stated as not connected yet.

## Verification and open work

- Verified on a dev server for this branch (port 3013): two-cheque rendering, five
  documents, tooltip, v4 notice sentence, court case view (trail, no Share, Generate
  order, tabs staying under `/employee`), advocate view unchanged, no console errors.
  Desktop only.
- Types, lint, `check:tokens`, `check:typography`, `check:ui-sync`, `check:rails` pass;
  `npm test` 1154/1154.
- Open: the court view shows advocate-side sample content (e.g. a "Raise bail bond"
  pending task on a complaint awaiting cognizance). Whether the court view hides
  advocate-only panels is undecided.
- Open: id `c-2009` exists in both the cognizance queue and the advocate fixtures; the
  court route resolves the cognizance complaint, but some tab content may come from the
  other case.
- Open: in Punjab & Haryana the complainant "Benny Mathew" is not localised.
- Not independently reviewed; the coordinator reviewed its own work.
