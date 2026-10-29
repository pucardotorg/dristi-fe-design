---
name: feedback-states
description: "Use whenever a Dristi screen says something worked, failed, partly failed, needs a look, or is not news: success and error dialogs, toasts, inline notices, field errors, confirms before risky acts, status badges, dead ends and error pages. Picks the right piece from components/feedback and applies its motion, tone, copy and accessibility rules."
---

# Feedback states

Every outcome in Dristi uses the feedback module (apps/dristi-app/src/components/feedback,
imported as `@/components/feedback`). Never hand-build a success disc, a green strip, a red banner, a
coloured toast or a confirm layout. The pieces carry the motion, sizes, tones and
accessibility already; screens supply only the words and facts.

Visual spec and history: `/success-board` on branch `feature/states-board`, and
the owner record feedback-states.md under docs/design/features (read only to maintain it).

## 1. Pick the piece

Ask, in order:

1. **Did the person's own input get refused** (empty or invalid field, wrong code)?
   Use `StatusFieldError` with `useRefusal` and `StatusFieldControl`, on the field.
   **Never a toast for missing input.** You set `data-invalid` on the DS `Field` and
   `aria-invalid` on the control (the DS ties the error to it). Then, on each refusal,
   `StatusFieldControl` moves focus into the field and its red ring grows in, and the
   error line opens and drops in under it. A **repeat** press shakes the field once and
   replays the line. Call `reset` once the input is valid.
2. **Is it a question before a risky act?** Use an `AlertDialog` with `ConfirmMark`:
   - `danger` plus the act's icon for removals and discards. The confirm button is
     `variant="destructive"` (soft red), **never** `destructive-solid`.
   - Neutral plus the act's icon for normal acts that cannot be taken back (sign, pay,
     file). **Not a warning**, because signing is the job. The button stays primary.
   - Put "This cannot be undone / reversed." in `IrreversibleNote`, as its own line.
3. **Did an act that reaches the court, moves money or adds a signature just finish (or
   fail)?** Use `OutcomeHeader`, the takeover, at the top of the same dialog. Set where its
   title comes from:
   - in a plain `Dialog` whose header the outcome replaces: `titleFrom="dialog"`;
   - in an `AlertDialog` that turns into its result: `titleFrom="alert-dialog"`;
   - in `StagedOverlay`: pass the overlay `outcome` on the settled stage, so its header
     steps aside, and render `OutcomeHeader titleFrom="dialog"` with the stage's title.
     The title always sits under the mark, never in a header above it (owner, Oct 29).
     The overlay's badge moves to the facts well's `aside`. In the filing flows,
     `SettledCard` does all of this;
   - when it replaces a stage in an already-open dialog: `focusTitle`.
    Facts go
   below it in `OutcomeSummary`. Label any amount with `OutcomeAmount` ("Amount paid").
   - All went through: `tone="success"`.
   - Nothing went through: `tone="error"`, with no shake (the system failed, not the
     person).
   - Sent but not decided (an application awaiting an order): `tone="info"`.
   - Nothing to do, nothing wrong (every item was already done): `tone="neutral"`, with the
     act's `icon` if it has one.
   - Saved and waiting on the person (sign later, pay later): `tone="neutral"` with a clock
     (or the act's icon), never a warning. Waiting on someone else: `tone="info"`. Any
     amber stays on the status badge.
   - A status line inside the same screen as a toast that already says it: `still`, so it
     is neither announced nor animated twice.
   - Two outcome stages in one dialog (paid, then filed): give each `OutcomeHeader` its own
     `key`, or React reuses it and the second one neither plays nor takes focus.
   - A record reopened on its outcome: `still` (on `SettledCard` too).
   - A dead end or outcome page with nothing else on it: centre it on the page, both ways.
   - A secondary act under an outcome's facts (open a link, download): centred on a phone,
     left-aligned with the facts from tablet up.
   - The lock line (`note`) follows the text above it: centred on a phone, left from tablet.
   - Every outcome stage closes on the warm footer band: `border-t border-hairline
     bg-surface-sunken`, buttons on it, never loose in the white body.
   - Some went through: `tone="neutral"` with a checklist icon (neither the big tick nor the "!", owner Oct 29); the header says only what fully happened; `OutcomeTally` shows
     the split, one marked line per outcome.
4. **Is it a quick act where the page stays put** (access given, reminder sent,
   archived)? Use `notify.success`, `notify.error`, `notify.warning` or
   `notify.neutral`. Never call `toast()` from sonner directly. **Never `notify.error`
   while a dialog is open:** the dialog blocks the page, so the toast could not be closed.
   Inside a dialog, a failure is a `StatusLine` or an `OutcomeHeader`.
5. **Is it a note inside a page or an open dialog?** Use `StatusLine` in the matching
   tone.
6. **Is the whole page the outcome, or a dead end?** Use `PageOutcome`. Success and error
   get a soft glow; a dead end (not found, link expired) is `neutral` with the act's icon,
   and stays flat. A page whose only content is the outcome (account ready) takes
   `scale="hero"`.
7. **Is it a standing state on a row** (Signed, Overdue, Errored)? Use a `Badge` with
   `className={BADGE_WITH_MARK}` and `<StatusMark size={14} … />` (or a plain badge).
8. **Did a dialog close back onto a list?** Add `LANDING` to the row it changed, once.

## 2. Pick the tone, carefully

| Tone | Means | Never for |
|---|---|---|
| success | it happened | a draft saved, an archive (use neutral) |
| error | it did not happen, or was refused | a missed lookup or a typo-level miss (neutral) |
| warning | it happened with a catch, or needs a look | a gate, a question, a dead end, an irreversible act |
| info | sent, not decided yet | general tips |
| neutral | not news: gates, drafts, dead ends, "no match" | anything that went wrong |
| danger | the question before a removal (confirms only) | outcomes |

Use warning **only where the product already treats the thing as a warning** (late
notice, offline, limitation passed, partial send). When unsure between warning and
neutral, choose neutral.

## 3. Rules the pieces enforce, and why (do not override)

- **Motion is budgeted by size.** Marks 44px and up play the full sequence (about
  600ms). Smaller marks pop their disc and scale their glyph in after it, one beat. Text
  never scales or slides sideways: a moving line is harder to read.
- **One animated mark per screen.** Pass `still` to every mark, line, field error or
  outcome piece after the first, and to anything already true when the screen opens (a
  dialog reopened onto a settled act). Marks that belong together play in order
  (`delay` moves a whole mark, glyph included).
- **Shake means "your input was refused".** Only on a repeat refusal of a field
  (`StatusFieldControl` does it) or a refused code (`reject` on a hero mark). Never on a
  system failure.
- **Toasts last 2.75s** and leave on any press on the page outside the toasts; their
  timer pauses while the pointer is over them. **Error toasts stay until closed** and
  ignore page presses. Success, warning and neutral
  toasts are for quick acts only; anything that needs action is a dialog or inline.
- **Never colour alone.** Every mark has a distinct glyph: check, cross, "!", hourglass,
  or the act's icon (a neutral mark without one shows an info icon; pass the real one). A
  tally's failed share also carries stripes.
- **Live regions are built in.** Toasts announce through sonner's region; an animated
  `StatusLine` is a status (or alert, for errors); a `still` one is not. Don't wrap these
  pieces in another `role="status"`.
- **Rails are straight**, full height and flush left, clipped by the corner radius.
  They never bend with it.
- **A mark in a pill is concentric**, with equal inset at the top, bottom and end
  (`BADGE_WITH_MARK` with a 14px mark).
- **Labels that state the outcome** (Every signature is in, Joined as …) use success
  green, never teal: teal is the action colour and reads as clickable.
- **Dark mode:** the pieces lift themselves (the toast to `surface-raised`). Never put a
  feedback surface on `popover` alone in dark.
- **Reduced motion:** everything appears in its final state; timers still run.

## 4. Copy

- Keep the product's existing words when moving a screen onto these pieces. Change only
  where a word was missing (an unlabelled amount gets "Amount paid").
- **Never add a button or action that was not there.**
- Sentence case. No em dashes in new copy: use a period or a middot.
- A failure says what did not happen and what to do: "Nothing was paid; try again."
- New copy for states that did not exist before needs PM sign-off; mark it as draft in the
  PR.

## 5. Retired: do not use for outcomes

These are replaced by the pieces above. Leave them only where a flow has not been moved
yet:

- the tinted 56px disc header (`size-14 rounded-full bg-success-muted`)
- the thin success or failure strip on a card (`SettledCard`-style band)
- solid green slabs, panels and bands (`bg-success p-6`)
- `Banner`, `Alert` or `SectionNotice` with `variant="success"` or `"destructive"` as a
  confirmation
- `toast.success` / `toast.error` / `toast()` from sonner
- the receipt's solid 48px disc above an unlabelled amount

## 6. Before you report

- Check the state in the browser at about 375px, 768 and 1024 (both orientations), and
  1366 or desktop, in light and dark.
- Check that focus lands where it should: a dialog's primary button, or the refused field.
- Check that each changed screen has at most one moving mark, the tone fits the table
  above, and the copy is unchanged unless a gap was filled.
- `/feedback-kit` shows every piece live, for comparison.
