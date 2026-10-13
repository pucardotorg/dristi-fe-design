# Advocate home on phones
Updated: 2026-10-07
Status: implemented; final reference render verification pending

## Current outcome
The advocate home phone composition follows the owner's two iPhone reference screens supplied in this task. Desktop composition and the pinned design system remain in place. Changes are on `feature/advocate-home-redesign`.

## Decisions
- The owner's reference superseded the initial mobile cleanup: centred two-digit statistics, a seven-day strip with paging arrows, a separate calendar button on an inset rule, and two deliberate toolbar rows.
- Phone hearing cards show item, parties, case number, stage and court. A warning symbol identifies pending work. Tapping a card reveals a tray (a soft teal tint on an ongoing matter, beige otherwise) containing the cause-list jump, View case, and a pending-task action when work exists.
- The ongoing group is expanded initially and collapsible, identified by a pulsing live dot instead of the desktop status tag.
- View case uses the shared case content in a phone bottom drawer, matching the pending-task drawer. The desktop side peek remains.
- “Blocking task” is now “Pending task” in the advocate-home copy; underlying task eligibility and counts are unchanged.
- At widths below 360px, week arrows move to the calendar row to preserve 40px day targets. This is an implementation adaptation to the DS touch-target floor.

## Touch interaction patterns
| Pattern | Phone behaviour |
| --- | --- |
| Reveal hearing actions | Tap the card; explicit chevron and expanded state. Keyboard activation works without decorative motion. |
| Ongoing group | Tap the live-count heading to collapse or expand. |
| View case / pending tasks | Bottom drawer with close control and scrolling; desktop rail preference does not force the phone drawer open. |
| Cause list | Full-screen phone dialog, readable matter cards, search/filter/grouping, explicit Join action. |
| Secondary task action | Archive remains visible on touch; task title opens its action. |
| Feedback | Brief measured-height reveal, press states, existing refresh feedback, reduced-motion alternative. |
| Touchscreen tablet | Cause-list status and Join stay visible together without hover. |

## Verification and limitations
- Pinned DS verified: `e0cadea6b9d4`.
- `npm run lint`: passed, including token, typography, primitive sync, spacing and table-row gates; 13 existing warnings outside this change.
- Existing application suite: 693 tests passed (before the final reference composition; task/data algorithms unchanged).
- Independent source review caught and prompted fixes for touch status specificity, 320px calendar target overlap, and mobile changes to the saved desktop rail preference.
- Initial mobile pass was rendered at 375px: full-screen cause list, search/no-results recovery, hearing-to-cause-list jump and pending-task drawer checked. That evidence does not validate the later reference-based card layout.
- Final reference render checks are pending: localhost began refusing connections after the user's follow-up. The owner was asked to start the preview under the repository's server policy.
- `verify:ui` passes UI checks but is blocked by a pre-existing untracked `pick-ui-library` skill metadata error in `check:rails`.
- In-place TypeScript verification is blocked by stale generated `.next/types` references to a removed `/join-case/layout`. Build verification is being attempted in an isolated temporary snapshot; the owner's server/output is untouched.
- Physical-device gestures, screen-reader testing, both themes and 200% text zoom remain unverified.
- Existing hearing-link and download placeholders remain existing product limitations.

## 2026-09-18 — responsive polish
User-requested refinements implemented on the existing branch, preserving earlier uncommitted work:
- Calendar days flex evenly so Sunday fits at 375/390px. Pointer week paging travels directionally with eased motion; keyboard paging and reduced motion skip travel.
- Header rhythm is tighter: greeting-to-week and week-to-divider gaps reduced, with 16px removed below the calendar before statistics.
- Ongoing home cards use a single teal border without the raised shadow. Desktop ongoing matters now have individual cards and gaps; existing desktop actions remain.
- Live action trays are teal with neutral/white buttons; upcoming/concluded trays use the DS dark beige accent-strong fill. Actions wrap for Malayalam.
- Disclosures open and close over 280ms at all widths; action trays have a subtle settling bounce. Keyboard activation and reduced-motion preferences skip it.
- Mobile cause-list group headers share one containing block and overlap instead of pushing each other out. Live cards disclose Join hearing on tap; their item/party/case-number identity matches home while court, hearing type and advocates stay intact.
- Locate-hearing uses a docket/crosshair icon; opening the full cause list retains its original icon.
- Tablet verification found the existing expanded pending-task rail squeezing the board. Below 1280px it now overlays the board and retains its close control; desktop remains in flow.

Verification on the working tree:
- Pinned DS e0cadea6b9d4 confirmed; lint and token/typography/sync/spacing/table-row gates pass (13 existing warnings).
- 693 application tests pass. Application TypeScript with current dev-generated route types passes using a temporary config; default project tsc still encounters stale production-generated /join-case layout types. Generated build output was not deleted.
- verify:ui remains blocked only at check:rails by the pre-existing untracked pick-ui-library skill metadata.
- Browser checks: 375/390px calendar and trays, week forward/back, selected-hearing cause-list jump, mobile Join disclosure, group-header overlap (both headers measured at y=161, newer header on top), 1440px cards and concluded pointer/keyboard toggles, 820px tablet rail open/close, Malayalam expanded actions without page overflow.
- Independent source review completed; keyboard modality gap repaired. No merge, commit, or deployment performed.
- Physical-device, dark-theme, enlarged-text, and screen-reader verification remain pending. Motion timing was source-checked and exercised, not frame-by-frame recorded.


## 2026-10-07 — desktop composition and design-system refinement

Implemented in the existing `dristi-home-team` checkout on `feature/advocate-home-team-and-clarity`, preserving Claude's earlier uncommitted redesign.

Owner decisions: the wireframe guides composition, not literal font sizes, colours or corner values. The pinned design system governs all styling; reuse its components and use custom composition only where needed. No people/avatar circles are to be added. Keep the plain office-access profile button, the verified Vakalatnama profile button and their access popover.

| Before | After | Why |
| --- | --- | --- |
| Header and timeline used different column offsets; the centre stretched across all available space | Shared header/timeline alignment and a bounded, fluid desktop column | Keep hierarchy and reading distances stable when either side panel changes |
| Small section title and uppercase month | DS page-title role, sentence-case month, existing DS display date | Strengthen the hierarchy without imitating the wireframe's arbitrary typography |
| Narrow timeline labels and compressed matter titles | Roomier label lane; courts and actions move below metadata when the centre is narrow | Preserve names and identifiers with expanded panels |
| Locally composed panel, icon buttons and status pills | DS Card with the shared panel recipe, DS Buttons and Badges | Preserve system metrics, focus, radius, surfaces and interactions |
| Small tab-to-panel curve | Token-sized curve and dark-canvas pairing | Make the active tab join its panel cleanly |

Phone card composition, week strip, hearing actions, tablet rail/overlay breakpoints, filtering/access logic and date-roll implementation are retained. The date remains the DS 48/56 display role; no 80px override, new styling token, primitive fork, dependency or DS-pin change was introduced.

Verification against DS pin `e0cadea6b9d4` and this working diff:
- `npm run verify:ui` passed (pin, lint, token, typography, component sync, spacing, table-row and rails gates). Lint reports 16 pre-existing warnings outside this pass.
- `npx tsc --noEmit --incremental false -p apps/dristi-app/tsconfig.json` passed.
- Existing `src/lib/advocate/home.test.ts` suite passed: 54 tests, including viewer access and per-sitting filters. Run from `apps/dristi-app` so its TypeScript path aliases resolve.
- Browser: `http://localhost:3500/advocate` serves this checkout. Phone at 375px retained its composition; the hearing tray and Vakalatnama popover open. Viewports 820×1180, 1180×820, 1024×1366 and 1366×1024 showed no page overflow; desktop reviewed at 1440px and 1870px. Three-slot preview rendered and ArrowRight moved selection to the next sitting. Returning from the third sitting to the single-slot route now falls back to an available slot instead of leaving the panel blank. Both access popovers were exercised: Vakalatnama lists the holders; office access adds only “You” below the divider. Malayalam at 1366px wraps without page overflow.
- Separate coordinator source/render review completed; this was not an independent agent review. No avatar circles were added. No commit, merge or deployment performed.
- Dark-theme rendering, physical-device gestures, 200% text zoom and screen-reader checks remain unverified. The preview exposes no application theme switch; dark styling uses the existing paired tokens.

## 2026-10-07 — panel, tab and date-transition corrections

Owner requested refinements to the latest design: eliminate the title's temporary wrapping when opening pending tasks, shaking slot transitions, sharp tab joins, uneven inactive-tab hover spacing, and the stalled date-content slide. This pass preserves the owner's intervening design edits, including date styling, profile-access controls and phone/tablet patterns.

| Before | After | Why |
| --- | --- | --- |
| Action labels interpolated their width beside the title; the heading was vertically centred in a changing block | Labels fold immediately below container 5xl; actions get their own row below container 3xl; the heading has a fixed top alignment | Opening the panel no longer repeatedly squeezes or shifts the heading |
| Tab selection changed margins and height through the primitive's general transition | Stable 40px hit areas and permanently reserved joins; the composition disables layout transitions | Selecting a sitting changes paint without moving neighbouring labels |
| SVG control points determined the tab corners; inactive hover spacing followed selected-tab margins | Container-radius token on the tab and concave joins; hover fill uses an even spacing-1 inset in the stable hit area | Softer curves that follow DS radius and balanced hover geometry |
| Board content waited for a 140ms exit, then jumped to the opposite side for a 260ms entrance | Selected-day data commits immediately with one 300ms slide/fade using the shared stage-motion timing and spacing-8 distance | Remove the waiting phase and visible side-to-side swap; rapid changes continue from the displayed position |

Keyboard date changes and reduced-motion preference bypass board travel. The date odometer is retained. No new primitive, radius, colour, spacing token, dependency, or DS-pin change was introduced.

Verification against the working diff in `dristi-home-team`, branch `feature/advocate-home-team-and-clarity`, HEAD `c443561`, DS pin `e0cadea6b9d4`:
- `npm run verify:ui` passed, with 16 existing lint warnings outside this pass. TypeScript and the existing 54-test advocate hearing suite passed. `git diff --check` passed.
- Matching preview: `http://localhost:3500/advocate`. At 1440×1100, opening/closing pending tasks leaves the English title at y=149, height=40 and font-size=32px. All three tab rectangles are identical before/after selection (including x, y, width and height); ArrowRight selects the next sitting.
- Rapid forward/forward/back date clicks end on the latest date and its matching hearings. Keyboard date selection showed no board transform. The hover fill was inspected with the first slot active and the second hovered; its inset is balanced beside the active join and divider.
- Responsive checks at 375×812, 820×1180, 1180×820, 1024×1366, 1366×1024 and 1870×1200 showed no horizontal page overflow. Phone cards and calendar pattern are retained; Malayalam at 1440px wraps without overflow. No hearing-avatar circles appear.
- Coordinator source/render review completed; it was not an independent agent review. Dark-theme and reduced-motion renders, physical-device motion, enlarged text and screen-reader verification remain pending. Motion was exercised and source-reviewed, not frame-time profiled. No commit, merge or deployment performed.

Concurrent-edit note: during final capture another editor replaced the token-based tab joins with a narrower SVG slant, changed their reserved spacing/hover composition, and updated hearing-row styling. The tab rectangle and hover evidence above belongs to the initial refinement implementation; it does not validate that replacement. In the replacement, selecting the first tab adds a left border and shifts subsequent tabs by 1px (second tab x=436.7734375 to 437.7734375 at 1440px). Header/date fixes remain present. Final tab-shape acceptance is pending the owner's choice between the two versions.

## 2026-10-07 — nearby-date preview and selection

Owner approved preview on hover and selection on click, across the whole desktop date square. Seven nearby dates remain anchored to the committed day while the pointer pans; preview changes only the small date bubble and bar lengths. Clicking the square or revealed strip commits through the existing date-roll and hearing-carousel callbacks. Leaving cancels the preview. Today uses teal, past previews use the beige accent surface, and future previews use foreground. Cross-month previews include an abbreviated month and the bubble stays inside the control width.

The bars reveal from beneath the square in mirrored pairs, outside to centre, with 160ms transform/opacity transitions and 40ms pair staggering from the shared control-motion recipe. Retraction reverses that order. CSS transitions retarget when interrupted. The weekday moves down by spacing-12; reserved header space keeps the hearing board stationary. The existing calendar button remains beside the revealed strip. Keyboard arrows/Home/End preview, Enter/Space select, and Escape cancels, with instant control changes and a localized live announcement. Reduced-motion CSS removes control travel/stagger. Coarse pointers open the existing full calendar; the phone week strip and tablet breakpoints remain intact.

Composition uses pinned DS Button and Badge primitives and existing colour, radius, spacing and typography roles. No primitive fork, dependency, styling token, avatar circle or DS-pin change was added. The owner's existing header typography exceptions, carousel/odometer timing, tabs, filters and access-profile controls are retained. A hover-suppression edge case after full-calendar selection was fixed: only closing while the pointer is still inside suppresses immediate reopening.

Verification in `dristi-home-team`, `feature/advocate-home-team-and-clarity`, DS `e0cadea6b9d4`:
- `npm run verify:ui` passed all gates, with 16 existing unrelated lint warnings. Project TypeScript and `git diff --check` passed.
- 59 advocate tests passed: three nearby-date tests cover full-square mapping, leap day, month/year boundaries; 56 existing hearing/access/filter tests remain passing.
- Matching localhost `http://localhost:3500/advocate`: hover previews 09 while the committed date and hearings stay on 07; clicking the revealed strip selects Friday 09 through the existing roll/swipe. Hover-out keeps 07 and computed pair delays reverse. Past 05 renders beige. Keyboard preview/commit/cancel and calendar-to-scrubber return were exercised. Previewing 03 Nov from 31 Oct and leftmost 28 Oct keeps the bubble within the square. Fresh reload renders the finished interaction.
- Phone 375×812 retains its week strip; 820×1180, 1180×820, 1024×1366 and 1366×1024 have no horizontal page overflow. English and Malayalam desktop previews were rendered at 1440×1100. Hover shifts weekday text 48px while board position remains fixed.
- Separate coordinator source/render self-review completed, including React subscription cleanup, discrete pointer-index updates, stable callback dependencies, native button semantics and localized instructions. This was not an independent agent review. No commit, merge or deployment performed.
- Physical-device motion, screen-reader use, dark-theme rendering, enlarged text and reduced-motion rendering remain unverified; coarse-pointer and reduced-motion fallbacks were source-reviewed. Motion was exercised and its computed stagger checked, not frame-time profiled. Earlier transient HMR filter errors are historical; current source imports the filter constant and a fresh page load renders successfully.

## 2026-10-07 — calendar density and pending-task affordance

Owner approved moving the full-calendar button beside the right date arrow, fading the weekday away during scrub instead of pushing it down, adding closer date bars, and making the date bubble fade quickly without vertical travel. The picker now spans eleven days (five before/after the committed day), retaining whole-square preview and click selection. Bubble/weekday opacity uses the shared 125ms fade; bars retain outer-pair-first emergence and reverse retraction, at 140ms with 30ms pair staggering (290ms total). The calendar uses an existing 40px DS button target and stays clear of the outermost preview. Its separator has enough token spacing for the additional control.

The unnecessary weekday-travel reservation was removed, and desktop header bottom padding reduced from spacing-8 to spacing-6. The time-slot tabs and hearing board move up 40px; scrub appearance does not move them. The phone header is unchanged.

Owner also requested a small pending-task panel peek on hovering its closed side tab. A clipped spacing-4 panel edge and matching tab translation provide that cue without reserving page width, mounting a second task list, or changing the saved rail state. The original hit area stays stable and clickable after the visual tab moves. Hover motion is gated to fine pointers; keyboard focus shows the same cue instantly, and reduced motion removes the transition. Click/Enter/Space retain full-panel opening. Collapsed task controls are inert/hidden to accessibility, and closing a focused panel returns focus to its persistent tab.

Verification in the existing `dristi-home-team` working diff, branch `feature/advocate-home-team-and-clarity`, DS pin `e0cadea6b9d4`:
- `npm run verify:ui` passed all gates. A new expression-style lint warning was repaired, and targeted companion-rail lint subsequently passed; the 16 earlier unrelated warnings remain. Project TypeScript and `git diff --check` passed after the final TSX repairs.
- Updated date boundary/mapping tests and the existing hearing suite pass: 59 tests. Eleven-day month/year and leap-day expectations cover the wider range.
- Matching server on port 3500 confirmed by process cwd. At 1440×1100, tabs start at y=266 instead of y=306; preview bubble is opacity-only, 125ms, no delay/vertical transform. Weekday reaches opacity 0 without translation. The last bar previews 12 from committed 07; pointer click selects Monday 12 and the relocated full calendar can restore Wednesday 07. Keyboard Home previews 02, and Escape cancels.
- Closed rail hover shows a 16px edge and shifts its tab 16px while main width stays 1184px and page width stays 1440px. Clicking the original extreme hover edge opens the full panel. Keyboard focus produces the same peek with 0ms duration and Enter opens the panel. Phone 375×812, tablet 820×1180, 1180×820, 1024×1366 and 1366×1024 show no horizontal page overflow; the peek is absent from sheet layouts. Malayalam rendered at 1440px without page overflow.
- Separate coordinator source/render review completed; not an independent agent review. Existing date-roll/hearing-carousel timing, access controls, tab styling and phone/tablet patterns are preserved. No new styling token, primitive fork, dependency, avatar, commit, merge or deployment.
- Dark-theme/reduced-motion renders, physical touch/motion, enlarged text and screen-reader use remain unverified. Their existing semantic token pairing and motion/pointer guards were source-reviewed; timings were exercised and inspected, not frame-time profiled.
