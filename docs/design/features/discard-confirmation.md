# Discard confirmation for popups with unsaved work
Updated: 2026-10-21
Status: implemented (uncommitted, on `feature-cancellation-modal` from `origin/main` d497ab5)

## Current outcome

A popup that holds an entry (anything typed, chosen or uploaded) asks
"Do you want to discard your progress?" before it closes by mistake: a click outside,
Escape, the corner X, Cancel or the phone's Back. **Keep editing** returns to the work;
**Discard** closes the popup without saving. A popup with nothing entered closes as it
did before.

- Shared piece: [discard-guard.tsx](../../../apps/dristi-app/src/components/chrome/discard-guard.tsx):
  `useDiscardGuard(dirty, onDiscard)` and `<DiscardQuestion guard locale? />`.
- The question is a stage of the same window, not a second modal. The window stays where
  it is, dimmed and inert, and the question docks along its bottom edge.
- While the question is up, any further close (a second Escape, the X, the dimmed window,
  a second Back) means "keep editing". Only **Discard** discards.
- English and Malayalam copy. The Malayalam needs review by a native speaker.
- Inventory and before-screenshots:
  [review artifact](https://claude.ai/artifact/SHBUDhcjV7MeH5NgxGQGJc).

## Decisions

| Date | Decision and reason | Source | Status |
|---|---|---|---|
| 2026-10-21 | Ask before closing a popup with unsaved work. | Anshumanth (Slack), Neer | Confirmed |
| 2026-10-21 | Cover every accidental close, not only a click outside. Several popups ignored the click but lost the work on Escape or the X. | Neer | Confirmed |
| 2026-10-21 | Wording: "Do you want to discard your progress?" | Neer | Confirmed |
| 2026-10-21 | Both sides: court and advocate/litigant. The advocate/litigant files are in a teammate's area, so coordinate in the PR. | Neer | Confirmed |
| 2026-10-21 | Any entry triggers it, including OTPs, a single date and popups that kept their entry. | Neer | Confirmed |
| 2026-10-21 | In-window question rather than a stacked AlertDialog. It follows the overlay convention (`ui-craft` motion; owner, 2026-10-13, on the join dialogs). | Implementation choice | Built |
| 2026-10-21 | Flow and staged windows keep ignoring a click outside. Nothing is lost there, and that's what keeps portalled lists clickable. | Implementation choice | Built |
| 2026-10-21 | Signing: digits of an OTP or an attached signed copy count as an entry. Choosing the method alone does not. | Implementation choice | Built, open to change |
| 2026-10-21 | The existing discard dialogs now use the shared question. Raise application keeps its save-as-draft question, because saving is the main answer there (owner, 2026-09-24). | Implementation choice | Built |

## Changes and tradeoffs

- **Court:** send back to scrutiny; Shortcuts; bulk actions and Add text on hearings; Add
  order items; Onboard/Defer/Relist applications; the quick order (Discard also clears the
  words the panel had kept); order items; registration reject; A-Diary entry; Mark as
  evidence; Sign orders, process, forms and bail bonds; record returns; bulk reschedule;
  the scrutiny decision.
- **Advocate/litigant, new:** Bail bond, Share access (the invite field gained an optional
  `onQueryChange`), Respond to a removal request, Add an address, Upload a signed copy,
  party signature, complaint e-sign and sign-link OTP, task OTP and task batch OTP,
  Your details, vakalatnama OTP, bulk filing OTP and bulk Sign tab, Download case file,
  document comments.
- **Advocate/litigant, moved onto the shared question:** Add advocate, Add PoA holder, Add
  witnesses, Edit litigant, PoA-holder remove/replace, Remove advocate, Submit documents,
  Bail application. The two join dialogs keep their own in-window question, which takes the
  window's header and footer. They now use the shared wording and a destructive Discard,
  ask from the first step once a number is typed, and treat a second close as "keep editing".
- **Left out (nothing to lose):** viewers, filter panels, date pickers, confirmations,
  Court settings (applies at once), Change process & address (edits the draft live), the
  A-Diary day sheet, and the registry sandbox's Return with defects.

## Verification and open work

- Probed in the running app on this checkout: 24 popups ask on Escape, and 3 more were
  checked by hand (Share access with a person added, Join a case, Add order items). Plain
  popups also ask on a click outside. Keep editing returns focus with the text intact, Tab stays in the
  question, Discard closes and clears, a footer `DialogClose` Cancel asks, phone Back asks
  and a second Back keeps editing. Rendered at 1440px and 375px in light and dark with no
  horizontal overflow.
- Typecheck clean, eslint clean on the changed files, tokens pass, and `test:app`
  1355/1355. Pre-existing failures on `main`, not from this change: `check:typography`
  (`mobile-hearing-card.tsx`) and `check:spacing` (eight values in files not in the baseline).
- Not exercised on the render: record returns (couldn't select in the demo), litigant join
  from a summons (behind sign-in), bail application (accused side only), task OTP, sign-link.
  These were reviewed from source only.
- Review was a separate self-review pass, not independent. No `ui-reviewer` was tagged.
- Open: Malayalam review; whether a stray click on an *empty* flow window should close it;
  teammate sign-off on the citizen-area files.
