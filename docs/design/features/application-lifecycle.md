# Application lifecycle
Updated: 2026-10-09
Status: implemented (court side rebuilt as Applications; render-checked 1280/1440 light, dark, 375px)

## Current outcome
The prototype runs the application lifecycle from `handovers/application-lifecycle.md`
(v26, PUCAR working folder) end to end, filer to magistrate, on one shared record in the
browser (`apps/dristi-app/src/lib/applications/store.ts`). Change list it implements:
`docs/application-prototype-changes.md` (`ACH-1`–`ACH-30`, PUCAR working folder).

- Rules: `src/lib/applications/lifecycle.ts` (pure, unit-tested in `lifecycle.test.ts`).
- Citizen side: case Applications tab (`components/cases/case-applications.tsx`), raise
  flow (`raise-application-form.tsx`, `add-signature-dialog.tsx`), record dialog.
- Court side: one rail item, **Applications** (`/employee/applications`,
  `components/employee/applications-screen.tsx`), opening a three-column workstation per
  application (`/employee/applications/[id]`, `application-workstation.tsx`), with the order
  previewed and signed in `application-order-dialog.tsx` and date acts in bulk in
  `application-bulk-dialog.tsx`. Queue rules: `lib/employee/application-queue.ts`.
  Design exploration: `docs/design/explorations/applications-v1.html` (untracked).
- Sandbox seat control ("acting as" role + side) on the Applications tab.

## Decisions
| Date | Decision and reason | Source | Status |
|---|---|---|---|
| 2026-10-01 | Build the change list against the lifecycle PRD | Owner ("make prototype changes") | Done |
| 2026-10-01 | Court queue split into two tabs, Onboard applications / Decide on applications | Owner, mid-build | Superseded |
| 2026-10-01 | The two queues are two rail items under Review applications, each its own route (`/employee/onboard-applications`, `/employee/decide-applications`) | Owner | Superseded 2026-10-07 (routes now redirect) |
| 2026-10-01 | Six sample applications (three per queue, one with an objection) seeded once per browser through the real lifecycle steps (`lib/applications/seed.ts`) | Owner ("add data to view") | Done |
| 2026-10-01 | Onboarding is magistrate-only (`ALC-22`), not "any of the three" (`order-generation.md` `APL-02`) | Implementation choice — follows the lifecycle PRD; conflict open | Open |
| 2026-10-01 | Numbers named per the lifecycle PRD: temporary identifier at filing, application number (CMP/…) at onboarding | Implementation choice; `Q-5` still open | Open |
| 2026-10-01 | Orders (dismiss / accept / reject) drafted and signed inside the task dialog, not the hearing composer | Implementation choice — composer is per hearing and has no link to citizen cases | Superseded 2026-10-08 by the order preview window |
| 2026-10-01 | Bail files through the inline form so it enters the lifecycle; the staged bail dialog is no longer opened from the raise flow | Implementation choice | Review |
| 2026-10-01 | Document submissions dropped from the Applications register (View Case `CHG-28`) | Change list | Done |
| 2026-10-07 | Onboard + Decide merge into one rail item, **Applications**, with pills All open · To onboard · To decide · Upcoming · Closed (30 days, then archive) | Owner | Done |
| 2026-10-07 | Workstation over wizard: list column, application, decision panel; next application opens after each act | Owner | Done |
| 2026-10-07 | Onboard · Review later · Dismiss shown up front as one switch (deviates from `ALC-19` "tucked away") | Owner | Done — flag to BRD owner |
| 2026-10-07 | Bulk only where the act is a date (onboard, defer, relist); accept, reject and dismiss one at a time | Owner | Done |
| 2026-10-08 | Accept/reject/dismiss wait for the listed date; no deciding early | Owner | Done |
| 2026-10-08 | Order shown as standard text, previewed, edited and signed in a window; "Open in order screen" for the full module | Owner | Done — link goes to `/employee/hearings` until the composer takes an application subject |
| 2026-10-08 | Preview buttons: Sign order + Save for signing; draft saves itself; no Cancel | Owner + Anshumanth | Done |
| 2026-10-08 | No To sign list: drafted orders belong to Sign orders; under All they keep a band | Owner + Anshumanth | Done — Sign orders does not yet list them (fixture queue) |
| 2026-10-08 | Review later after a deferral warns instead of blocking (relaxes `ALC-05`) | Anshumanth | Done |
| 2026-10-08 | Onboarding is its own step: "Onboard and take up now" onboards at once; the panel then offers the order, and "List for a later date instead" (`listForLater`) | Owner | Done |
| 2026-10-08 | Cause-list copy: listed, take up, order on the application, relist | Owner | Done |
| 2026-10-08 | Today's date beside the title; Upcoming kept but never the default | Owner + Anshumanth | Done |
| 2026-10-10 | Consistency pass (ux-designer spec, ui-designer build): one type register (24 page · 20 dialog · 16 semibold headings · 16 prose · 14 operated/scanned); DS Select for the list switcher; Card/Banner/Field instead of hand-rolled boxes; breadcrumb Review applications › Applications › <application no.>; in-page back buttons removed | Owner | Done |
| 2026-10-10 | Next hearing suggested again: sandbox table of date-relative next hearings for the six sample cases (`nextHearingOf`), pre-filled in "List on", marked in a listing calendar that greys past days and weekends | Owner (via ux-designer recommendation) | Done — sandbox data, not a real hearing source |

## Changes and tradeoffs
- The seeded pack keeps its legacy statuses; the register maps them (Completed + "Allowed…"
  → Accepted, else Pending review / Pending decision). Seeded rows' steps are held for the
  visit only; live rows persist.
- Attachments are kept in memory only; a reloaded draft says so.
- Advance/Postpone are offered when the case has a next hearing on record; the date
  pre-fill uses it only if it is still ahead (every fixture hearing is past, so nothing
  pre-fills today).
- The Objection form (grounds + document) is a placeholder: the PRD leaves its fields
  unspecified.

## Verification and open work
- `npm run test:app` 1074/1074; `npm run verify:ui` all gates pass (lint warnings
  pre-existing only). Checked on `feature/application-lifecycle` worktree, DS pin
  `e0cadea6b9d4`.
- Browser (:3002): raise → save draft → sign (advocate) → pay later → litigant pays →
  Pending review + temporary id → hidden from other side → bench clerk sees only Dismiss →
  magistrate onboards on a date with objections → other side files objection (Submitted,
  linked) → magistrate accepts and signs → Accepted with linked order on the citizen record.
- Not render-checked: dark mode, dismissal path, set-a-date-once, move date, clerk signing
  block (all covered by unit tests).
- Not built: applications on the hearing screen (awaiting owner decision); expiry window;
  party actions (witness, PoA, edit litigant) filing as applications; Certified Copy without
  login; Warrant recall's fate; the three old fixture queues still show Approve/Reject.
