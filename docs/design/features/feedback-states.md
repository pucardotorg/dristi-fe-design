# Feedback states (success, failure, warning)
Updated: 29 Oct 2026
Status: shared pieces implemented and verified · flows not yet moved · design-system PR not opened

## Current outcome

Feedback came in that success confirmations are too subtle: people could not tell
whether an action went through. Every success, failure and warning state on `main`
(90bbc31) was audited and redesigned as one system. Nothing in the product has
changed yet.

- **The board** is the visual spec: `/success-board` on branch
  [`feature/states-board`](https://github.com/pucardotorg/dristi-fe-design/tree/feature/states-board)
  (no PR). Its Success and Failure & warning sections pair each state on main today
  (left) with the agreed design (right). Its source:
  `apps/dristi-app/src/app/success-board/`.
- **Scale:** 71 success moments in 11 patterns, and 63 failure and warning moments in
  12 patterns, across advocate and clerk, litigant, magistrate and court staff. There
  is no shared feedback component today. The board lists each flow with its file.

## The system, in one paragraph

One mark (a solid disc with a glyph), in six tones (success, error, warning, info,
neutral, danger) and three weights. A **takeover** header is for acts that reach the
court, move money or add a signature. A **toast** is for quick acts where the page
stays put. An **inline line** is for notes inside a page or an open dialog. A
**landing highlight** marks the row a closed dialog acted on. Motion is budgeted by
size and context. The rules and reasons are listed below.

## Decisions

| Date | Decision and reason | Source | Status |
|---|---|---|---|
| 29 Oct | Today and proposed are shown side by side for every state, each with its own motion replay. | Owner | done |
| 29 Oct | Keep today's copy word for word, and never add a button that was not there. | Owner | rule |
| 29 Oct | Toasts are white with a 22px solid mark and a 14px semibold title. The rail is straight, full height and flush left, so the corner radius clips it rather than bending it. | Owner | rule |
| 29 Oct | Toasts last **2.75s** (today 4s), and any click on the page dismisses them. Error toasts stay until closed. 2.5s was considered too fast for full-sentence toasts. | Lead designer, owner | rule |
| 29 Oct | Outcome labels on summary cards use success green, not teal. Teal is the action colour and reads as clickable. | Owner, Claude | rule |
| 29 Oct | Warning is used only where today is already a warning. Gates, questions and dead ends use a **neutral** grey-ring mark carrying the act's own icon. | Owner | rule |
| 29 Oct | Removal buttons stay **soft red** (today's destructive variant), never solid red. | Owner | rule |
| 29 Oct | Irreversible but normal acts (sign, pay, file) are not warnings. "Cannot be undone / reversed" gets its own line with a lock. | Owner | rule |
| 29 Oct | Cross motion: spring (both strokes, 140ms apart). Warning icon: a slim exclamation (filled bar plus dot), not a triangle. Warning motion: a small sway with a soft pulse, never a bell-like swing. Picked from a lane of options on the board. | Owner | rule |
| 29 Oct | Motion is budgeted by size. Heroes (44px and up) play the full mark, about 600ms. Toasts, inline lines and tallies pop the disc and then scale the glyph in, the same beat as the gate toast's lock. Badges and field errors move only when they change in view. | Owner, Claude review | rule |
| 29 Oct | Shake only when the person's own input was refused (wrong OTP, the first invalid field), never on system failures. A shake reads as "you did it wrong". | Claude review, owner | rule |
| 29 Oct | Within one real screen, one mark animates; marks that belong together play in order. Separate examples on the board each play. | Owner | rule |
| 29 Oct | Missing input points at the field. The red ring grows in, then the error line opens its room and the cross and words drop in together from under the field. A repeat press shakes the field once and replays the line. Instant text and a plain fade were both tried and rejected. | Owner | rule |
| 29 Oct | A disc inside a pill is concentric: equal inset at the top, bottom and end. The badge has a 1px border, so a 16px disc in a 24px badge needs 3px of padding. | Owner | rule |
| 29 Oct | Colour-blind cues: glyphs must read at 16–20px without colour. The failed share of a tally bar carries fine stripes. | Owner | rule |
| 29 Oct | Full-page states get a very subtle radial glow in their tone. Neutral dead ends stay flat. | Owner | rule |
| 29 Oct | Dark mode: the toast lifts to the raised surface with a full border. Otherwise it disappears into the page. | Claude, dark pass | rule |
| 29 Oct | **Order of work: flows first, design system later.** The new pieces are built once in the app, composed only from existing design-system parts and tokens, and rolled into every flow. The same pieces go to the design system as a PR for discussion. On approval they move there, and the screens look identical. | Lead designer, owner | decided |

## Branches (all of them, so none is forgotten)

| # | Repo | Branch | Job | When |
|---|---|---|---|---|
| 1 | dristi-fe-design | `feature/states-board` | The before-and-after board, kept as the reference. Never merged into the product. | exists |
| 2 | dristi-fe-design | `feature/feedback-states-rollout` | The pieces, the skill, and every flow moved onto them, in five batches (commits, not branches). One PR into `main`. | exists |
| 3 | dristi-design-system | `feature/feedback-states` | The design-system PR for discussion: foundations, components, docs, rules, deprecations (plan step 2). | **to make** after the rollout PR, when the owner says start |
| 4 | dristi-fe-design | a `ds:bump` branch from `origin/main` | Moves the app's DS pin to the approved version, on its own as repo rules require; then the flows switch to the DS copies (plan step 3). | **to make** only after #3 is approved and merged |

## The plan

### 1. Rollout branch (app repo)

- One folder of app-owned feedback pieces, composed from DS primitives and tokens
  only. No DS primitive is copied or edited.
  - The pieces: the mark, the takeover header, the toast settings (2.75s, click-away,
    errors persist, dark surface, in the existing `AppToaster`), the inline line,
    the field error with its entrance, the tally card, the confirm-dialog mark plus
    lock line, the badge mark, and the landing highlight.
  - Motion tokens live in one app-owned CSS file, like `chrome.css` today.
- **Agent skill** `.agents/skills/feedback-states/`: a decision tree (what happened,
  then which weight, then which tone, then which piece), every rule above with its
  reason, the copy rules and a checklist. Wire it in through `npm run sync:rails`.
- Roll into every flow listed on the board, in batches:
  1. filing
  2. cases and join
  3. tasks
  4. access and bulk
  5. court side
- For each batch, check: phone 375, iPad mini portrait and landscape, iPad Pro
  portrait and landscape, light and dark, reduced motion. Compare against the board,
  then recheck.
- The seven missing states (payment declined, wrong OTP, expired OTP, batch partly
  signed, DSC not found, page not found, page failed to load) need PM sign-off on
  their draft copy first.

### 2. Design-system PR (pucardotorg/dristi-design-system)

- Foundations: **Motion** (tokens, budget, reduced motion) and **Status & feedback**
  (tones and when to use each, colour-blind rules, concentric pills, dark surfaces).
- The same pieces as components, each with a docs page and live demos taken from the
  board.
- AGENTS.md non-negotiables, plus the skill.
- **Retire, marked deprecated with "use instead" notes and a check script:**
  - the tinted-disc done header
  - the thin success and failure strip
  - the solid green slab and panel
  - success and failure use of Banner, Alert and SectionNotice for confirmations
  - the receipt disc
  - the old toast colours

  Removal happens only after the rollout has moved every flow off them.

### 3. When the design-system PR is approved

1. Merge the DS PR.
2. Run `npm run ds:bump` on its own branch and PR.
3. Sync the new components into the app.
4. Point the flows at the DS components instead of the app folder. This is mechanical,
   and the screens must not change: verify against the board.
5. Delete the app folder. The app skill becomes a pointer to the DS rules.
6. Remove the deprecated pieces from the DS once nothing uses them.

**If the discussion changes something:** change it in the app folder; every flow
follows. **If it is discarded:** the app folder stays as the product's own pieces. The
DS was never touched, so there is nothing to undo.

## Progress

**29 Oct · shared pieces (branch `feature/feedback-states-rollout`).**
- **Built:** `components/feedback` (mark, outcome header, summary, tally, page outcome,
  status line, field error with refusal, confirm mark, `notify` toasts), the motion in
  `app/feedback.css`, and click-away plus the 380px measure in `AppToaster`. Every piece
  is shown live at `/feedback-kit`. Agents get the `feedback-states` skill (linked from
  `ui-craft`).
- **Snapped to the DS:**
  - Marks use the Tailwind sizes 14, 16, 20, 24, 40, 56, 60, 72 and 96px. The board's 22
    and 26px became 24px; the badge mark is 14px, concentric with pill padding.
  - Rails are 4px.
  - The neutral ring uses `input`, not an alpha mix.
  - The takeover band's bottom edge is `hairline`, where the board used a tinted raw ramp
    step. That is a small visible difference, and it is DS-correct.
- **Independent review** (separate reviewer, code only): 18 findings, all fixed. Among
  them:
  - a press on a toast's own Undo being swallowed
  - the header crashing inside an `AlertDialog`
  - an error toast that could be dismissed by a reused id
  - a neutral mark falling back to the hourglass
  - a double toast entrance
  - 36px touch targets
  - nested live regions
  - delays not reaching hero glyphs
  - bulk tallies taking about 5s
  - a field remount losing typed text
- **Verified in the browser:**
  - Viewports: 375, 768×1024, 1024×768, 1024×1366 and 1366×1024. Every size gives a
    centred 380px toast 56px up (64px and full width on a phone), centred dialogs or a
    phone bottom sheet, and no sideways scroll.
  - Dark mode.
  - Reduced motion: all 135 animated elements appear settled.
  - Toast life, click-away, errors persisting and presses inside a toast.
  - Field refusal: focus, the growing ring, the repeat shake, and typed text kept.
  - Concentric badges (5px each side), and screen-reader wiring of titles and errors.
- **Test note:** the preview pane was hidden, so animation frames were paused. Toast
  removal was tested with frames stood in by a timer.

**29 Oct · batch 1, filing (commits 9206b0f, 5c4b453).**
- **Moved onto the shared pieces:** filing notices, both confirm dialogs (with the lock
  note), bail application and bail bond outcomes, bond edit confirm, signing outcomes
  (`SettledCard`), e-filing payment success, batch sign and pay success, documents
  warning toast, dead signing link, new-filing and dashboard errors. Copy unchanged.
- **Verified in the browser:** desktop for every one of those; phone sheet, iPad mini and
  dark for batch pay and e-filing payment success; the bail paid then filed sequence
  (through a temporary trigger, since the dialog has no button on main; removed after).
- **Fixed while checking:** e-filing payment success buttons collapsed to 22px on a phone
  (`flex-1` in a column), a bug from main.
- **Independent review** (separate reviewer, code only): 7 findings, all fixed:
  - the bail filed outcome reused the paid one, so it neither played nor took focus
  - the case line was lost on the bail paid stage
  - settled signing cards and on-arrival notices animated on every reopen
  - the signing headline was no longer announced
  - a batch where everything was already done showed red; now a new neutral takeover
  - the bond edit confirm had turned red; back to its primary button
- **Not driven in the browser:** the signing link wizard (needs a signed-in party), the
  oath camera and cheque notices, and the batch "nothing to do" case (shown on
  `/feedback-kit` instead).
- **Left for later batches:** "N required documents still needed" stays a toast as today,
  though the rules say missing input belongs on the field (needs an owner call). The bulk
  pay and sign tabs have the same `flex-1` phone bug (batch 4).

## Verification and open work

- Verified on the board: desktop light, every pair. Dark mode: one fix (the toast),
  all else holds. Phone and iPad: only the bail success and the toast, in the device
  lane. The full matrix runs on the real flows during rollout.
- **To confirm with the lead designer:** the repo's DS gate forbids local
  workarounds. The interim app folder composes DS parts and does not alter them, which
  is the same pattern as `AppToaster`. It still needs an explicit OK, together with the
  DS requests filed in `docs/design/ds-requests.md` (#23–26).
- Error toasts: a page click does not dismiss them. Confirm this with the lead
  designer.
- Draft copy for the missing states needs PM sign-off.
