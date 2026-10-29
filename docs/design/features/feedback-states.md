# Feedback states (success, failure, warning)
Updated: 29 Oct 2026
Status: decided (design) · rollout not started · design-system PR not opened

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
