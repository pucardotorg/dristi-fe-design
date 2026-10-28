# Re-scrutiny view for a resubmitted case
Updated: 2026-10-28
Status: implemented (uncommitted on `feature/revamp-scrutiny-resubmission`)

## Current outcome

When an advocate resubmits a filing the scrutiny officer sent back, the officer's case
workbench (`/employee/scrutiny/[filingNo]`) now opens on what came back, not on the whole
filing again.

- **Changes / Full filing switch** in the fields pane (DS `SegmentedControl`, compact),
  shown only on round 2 or later. Opens on Changes.
- **One card per returned item** (`changes-list.tsx`): the officer's note and when it went
  back; the value or file as filed; what is on file now, with the advocate's answer
  (Corrected, Kept as filed with "No reason given", or Re-uploaded); **Accept** or
  **Raise again**. Raise again opens the existing `FlagComposer` pre-filled with the old
  note, so the send-back path is unchanged. An accepted card folds and can be undone.
- **Decision bar** shows "N of M checked". Forward for registration and Register case are
  disabled until every returned item is accepted or raised again, and the reason is
  written beside the buttons.
- **Bundle**: a re-uploaded document shows its previous upload beside the new one, with a
  toggle to hide it. The demo has one file per document, so the previous upload is the
  same page blurred as a stand-in.
- **Index**: a "New" badge on re-uploaded documents. **Full filing**: returned rows get a
  "Sent back 3 Jun 2026 · corrected 9 Jun 2026" hint line.
- **History**: the derived history now names the items it sent back, which were missing on 00338.
- Fixtures in `apps/dristi-app/src/lib/employee/scrutiny/returns.ts`: 00338 (three items,
  one of each answer) and 00341 (the affidavit, round 3).

Review page with the before state and proposal: https://claude.ai/artifact/77o38Tz8LwQxg43FjbRKTn

## Decisions

| Date | Decision and reason | Source | Status |
|---|---|---|---|
| 2026-10-28 | Build inside the existing workbench, not a new screen. The advocate locks every unflagged field during a correction round (`correction-screen.tsx`, D3), so the returned items are the whole of what changed. | Claude's proposal; Neer asked to build it | Implemented |
| 2026-10-28 | Use the advocate side's vocabulary for answers (`Resolution.how`: edited/kept/replaced). | Implementation choice | Implemented |
| 2026-10-28 | Raise again reuses the ordinary flag, so the review dialog, send-back and the advocate's screen need nothing new. | Implementation choice | Implemented |
| 2026-10-28 | Gate forwarding/registering until every returned item is answered. | Claude's recommendation; Neer has not answered | Built by default, open |
| 2026-10-28 | Open on Changes, not Full filing. | Claude's recommendation; Neer has not answered | Built by default, open |
| 2026-10-28 | "Kept as filed" shows "No reason given". It is not called "contested", because the advocate is never asked for a reason. | Claude's recommendation; Neer has not answered | Built by default, open |

## Changes and tradeoffs

- Files: `components/employee/scrutiny/{changes-list.tsx (new), sheet.ts (new), case-workbench.tsx, fields-panel.tsx, field-row.tsx, bundle-view.tsx, index-rail.tsx}`
  and `lib/employee/scrutiny/{returns.ts (new), types.ts, case.ts, derive.ts, use-scrutiny-state.ts, use-scrutiny-state.test.ts}`.
- The card recipe `SHEET` moved to `sheet.ts`, shared by the field groups and change
  cards. Register cases and Take cognizance keep their own copies; they weren't touched.
- Considered and rejected: a page-wide Banner for the round summary, since one sentence
  at the top of the Changes list does the job with less chrome; and a dot in the index,
  since a word reads without colour.

## Verification and open work

Checked on 2026-10-28, against the dev server on localhost:3000 serving this branch, Gujarat skin, scrutiny-officer seat:
- `tsc` clean for app source. eslint clean on the scrutiny folders. `check:tokens`,
  `check:ui-sync` and `check:table-rows` pass. `check:typography` and `check:spacing` fail
  only on files this change doesn't touch (`mobile-hearing-card.tsx`, `poa-join-fields.tsx`).
- `npm test` passes 1413/1413, including 7 new re-scrutiny tests.
- Rendered and probed in headless Chromium:
  - 00338: at rest, Accept, Raise again (composer pre-filled), raised state, Compare in bundle, Full filing (3 hint rows).
  - 00341 (hero).
  - 820px two-view layout.
  - Dark mode.
  - 00319 (fresh, unchanged: no switch, no tally).
  - No page errors.
- Not checked: screen readers, 200% zoom, touch hardware. The review was Claude's own
  pass, not an independent one.

Open:
1. Neer to confirm the three default decisions above.
2. New items raised in round 2 aren't marked "New this round" yet. This was recommended
   because of the Kerala practice note about drip-fed defects.
3. An optional reason for "Kept as filed" belongs on the advocate's correction screen,
   which is a separate change.
4. Queue stage text still reads "Awaiting re-scrutiny", not "Re-scrutiny · round 2".
5. ~~Section tabs scrolled sideways behind the switch.~~ Fixed 2026-10-28 (Neer): the
   switch is its own `h-14` bar, level with the bundle and index bars, and the section
   tabs sit in a second bar below it, in Full filing only. The tabs still overflow by
   34px at the default pane width ("4. Affidavit and oath" clipped). That is on `main`
   too, for every filing, so it wasn't introduced here.
   Same day (Neer): removed the stray scrollbar on the tab bar. The tab underline hung
   1px below the bar, which made it vertically scrollable (measured 1px in every court,
   on `main` too). Now the bar has `overflow-y-hidden`, the underline is drawn at
   `bottom-0`, and the sideways track is hidden with `[scrollbar-width:none]`, following
   `chrome/pill-plate.ts`. The DS `no-scrollbar` class is not defined in the app's CSS.
