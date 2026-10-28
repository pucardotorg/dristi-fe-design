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
| 2026-10-28 | The decision-bar action follows the court, not the seat. Gujarat and Punjab & Haryana say "Register case"; Kerala says "Forward for registration". A typist in Ahmedabad was offered Forward, which names a Register cases queue that court does not have. | Neer, on the 00338 workbench | Implemented |

## Variant B: in context (`?resub=inline`), 2026-10-28

Built from Anshumanth's feedback for Neer to compare. The default URL still shows the split version above.
- **No per-item Accept.** A returned item the officer leaves alone is accepted. The only
  act is Raise again, from the record's button or the row's flag, and both start from the
  earlier note. Nothing is gated. The bar reads "3 returned items" plus the usual flag count.
- **In context, not isolated.** There's no Changes / Full filing switch. The full filing
  opens on the first returned item. Each returned row opens a record in place: an info
  badge "Sent back 3 Jun 2026", then You asked, Was (struck through; Before for
  documents; left out for Kept as filed) and Advocate (the answer and its date). The row's
  value above it is what's on file now. The record uses the same well and `RecordList`
  as a raised flag.
- **Stepper.** "Returned item 1 of 3" with previous and next arrows takes the switch's
  bar. Stepping selects and scrolls the row, the bundle turns to its page, and it wraps
  around at the ends.
- Files: `field-row.tsx` (`ReturnedRecord`, the flag button raises again),
  `fields-panel.tsx` (`ReturnedStepper`), `case-workbench.tsx` (`resubLayout` prop, no
  gate when inline), the route `page.tsx` (`?resub=inline`), and `use-scrutiny-state.ts`
  (optional initial selection).
- Checked on :3000: opens on 1 of 3, steps and wraps, Raise again is pre-filled, no
  Accept, Register enabled, default URL unchanged, fresh 00319 unaffected, dark mode,
  820px. No page errors. Tests pass 1413/1413, and the gates are clean on these files.
- Tradeoff: with no Accept and no gate, nothing makes sure each item was looked at.
  The stepper makes visiting them easy, but it doesn't record that they were visited.

### Variant B revised: Changes tab kept, 2026-10-28

Neer: "we should have kept the change tab, doesn't make sense to go through the entire
thing again". `?resub=inline` now combines the two:
- It opens on **Changes** again, so the officer doesn't walk the whole file. The
  "Returned item 1 of 3" stepper is removed, because the list does that job.
- **No per-item Accept** (Anshumanth's point 1, not overruled). Cards carry only Raise
  again, and a badge appears only once an item is raised again. Nothing is gated.
- **Full filing shows the returned records in place** (Anshumanth's point 2): You asked,
  Was and Advocate on each returned row.
- **"Show in filing"** on every change card, in both layouts, switches to Full filing
  on that row and turns the bundle to its page.
- Checked on :3000: opens on Changes, no Accept, no "To check", Register enabled, the
  raise survives switching tabs, Show in filing selects the row with its record. The
  default URL still has Accept and the gate. No page errors. Tests pass 1413/1413, and
  the gates are clean on these files.

### Fewer buttons; bundle narrowed on Changes, 2026-10-28

Neer: "too many buttons on these cards", and "Show in filing" and "Show in bundle" are
"the same thing doing the same job with two different texts".
- **One action per card: Raise again** (plus Accept on the default URL). "Show in
  filing", "Show in bundle" and "Compare in bundle" are gone. Picking the card, or its
  title with the keyboard (`aria-current` when selected), turns the bundle to its
  document.
- **No buttons in the Full filing record.** Selecting the row turns the bundle, and the
  row's flag is Raise again, starting from the earlier note.
- **On Changes, the bundle and the index hold only the documents behind the returned
  items** (`returnedDocIds`): 3 of 17 for 00338. The bundle header says "3 of 17
  documents" and the index says "Documents behind the returned items. Full filing shows
  all 17." Full filing restores the whole bundle. I read "sections which are written"
  as these documents; Neer hasn't confirmed that.
- Checked on :3000: Changes bundle and index = Cheque 1, AD card, Identity proof. The
  amount card's buttons are its title plus Raise again. A clicked card is marked
  selected. Full filing shows all 17 documents, and the record has no buttons. No page
  errors. Tests pass 1413/1413, and the gates are clean on these files.

### Returned rows stand out, 2026-10-28 (`?resub=inline`, Full filing)

Anshumanth: "There's a slight highlight here, yes, but I can't see what the actual
correction requested was or what the previous value was." Neer asked for a way to
highlight the change that "grabs the eye immediately".
- **The change is in the value.** A corrected value reads "~~₹6,05,000~~ → **₹6,50,000**"
  with a "Corrected" chip. Kept and re-uploaded rows show the value with a "Kept as
  filed" or "Re-uploaded" chip. A screen reader hears "₹6,05,000 changed to ₹6,50,000,
  Corrected".
- **One colour means "came back": info blue.** Red is a new flag, amber an AI reading,
  navy the selection. The row gets an `info-muted` tint with an inset `info` edge. The
  chips get a solid `border-info` edge, because a tint on a tint lost its pill (DS 6a).
  Measured contrast on the tint: muted labels 5.08:1 light and 7.14:1 dark, chip ink
  4.64:1 light.
- **The record box under the row** is card-white with a hairline. It shows You asked
  (with the sent-back date), Before (re-uploads only, since a corrected value shows its
  before in the value) and Advocate.
- **Signposts:** a "1 returned" chip on each group card. Counts on the section tabs were
  tried and removed: they pushed "4. Affidavit and oath" out of a band with no
  scrollbar, and a dot alone would be colour without words.
- Checked on :3000 in light and dark: amount, name and AD card rows, Cheque 1 group, tab
  band (back to the 34px overflow that `main` already has). No page errors. Tests pass
  1413/1413, and the gates are clean on these files.

### The change highlighted on the cards too, 2026-10-28

Neer: "it needs to be highlighted in the card as well". He was looking at the Changes
tab, and the highlight had only been built for Full filing.
- **Each change card opens with a blue band** (`info-muted`, `border-info` edge) holding
  the change: old → new for a correction, the value for kept or re-uploaded, the answer
  chip and its date. Kept as filed adds "No reason given" (warning ink on the tint,
  4.73:1 light). The "Filed / Now" rows are gone. "Before" stays only for re-uploads.
- The value and chip are one component, `returned-value.tsx`, shared by the card and the
  Full filing row, so the two can't drift apart. This applies on both links (the default
  card keeps its Accept and "To check").
- Checked on :3000: cards on `?resub=inline` (light and dark) and on the default link.
  No page errors. Tests pass 1413/1413, and the gates are clean on these files.

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
