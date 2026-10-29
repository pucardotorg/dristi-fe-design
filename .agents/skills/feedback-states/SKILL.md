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
   **Never a toast for missing input.** On press, the field turns red, the line opens and
   drops in under it, and focus moves to the field. A repeat press shakes the field once
   and replays the line.
2. **Is it a question before a risky act?** Use an `AlertDialog` with `ConfirmMark`:
   - `danger` plus the act's icon for removals and discards. The confirm button is
     `variant="destructive"` (soft red), **never** `destructive-solid`.
   - Neutral plus the act's icon for normal acts that cannot be taken back (sign, pay,
     file). **Not a warning**, because signing is the job. The button stays primary.
   - Put "This cannot be undone / reversed." in `IrreversibleNote`, as its own line.
3. **Did an act that reaches the court, moves money or adds a signature just finish (or
   fail)?** Use `OutcomeHeader`, the takeover, at the top of the same dialog. Facts go
   below it in `OutcomeSummary`. Label any amount with `OutcomeAmount` ("Amount paid").
   - All went through: `tone="success"`.
   - Nothing went through: `tone="error"`, with no shake (the system failed, not the
     person).
   - Sent but not decided (an application awaiting an order): `tone="info"`.
   - Some went through: the header says only what fully happened; `OutcomeTally` shows
     the split, one marked line per outcome.
4. **Is it a quick act where the page stays put** (access given, reminder sent,
   archived)? Use `notify.success`, `notify.error`, `notify.warning` or
   `notify.neutral`. Never call `toast()` from sonner directly.
5. **Is it a note inside a page or an open dialog?** Use `StatusLine` in the matching
   tone.
6. **Is the whole page the outcome, or a dead end?** Use `PageOutcome`. Success and error
   get a soft glow; a dead end (not found, link expired) is `neutral` with the act's icon,
   and stays flat.
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
- **One animated mark per screen.** Pass `still` to every mark, line or field error
  after the first, and to states that are already true when the screen opens. Marks that
  belong together play in order (`delay`).
- **Shake means "your input was refused".** Use it only on rejected input: a wrong OTP,
  the first invalid field (`reject` on a mark, `StatusFieldControl` on a field). Never
  use it on a system failure.
- **Toasts last 2.75s** and leave on any click on the page; their timer pauses on hover.
  **Error toasts stay until closed** and ignore page clicks. Success, warning and neutral
  toasts are for quick acts only; anything that needs action is a dialog or inline.
- **Never colour alone.** Every mark has a distinct glyph: check, cross, "!", hourglass,
  or the act's icon. A tally's failed share also carries stripes.
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
