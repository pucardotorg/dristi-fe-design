# Design system gap: feedback pieces are chosen by type, never by size

Written 30 Oct 2026 for the owner, to pick up when limits refresh. Nothing here is built yet.

## What happened

On the coverage board, "Mobile number verified" (registration, contact step) was moved from
a hand-made small green line onto the shared `StatusLine`. The result was far too heavy under
one field: a card with a rail and a big mark. The owner's call: keep the small green line, with
the design system's 16px `StatusMark` instead of a hand-picked icon (now on the branch). The
owner then asked: in a new design with no "before" to compare against, what stops this from
happening on the first try?

## Diagnosis

1. **The rules pick a piece by what happened, never by how big the moment is.** The feedback
   rules (`.agents/skills/feedback-states/SKILL.md`, DS AGENTS rule 11) are a question list:
   refused input → field error; risky question → confirm; finished act → outcome; quick act →
   toast; "a note inside a page or an open dialog" → `StatusLine`. A one-field confirmation is
   "a note inside a page", so the list hands out the heaviest inline piece. There is no
   question about scope.
2. **A missing named piece.** Errors have a quiet field-level piece (`StatusFieldError`).
   Success has none. Unnamed, the nearest big piece gets used.
3. **No "in context" or "don't" examples.** The docs show each piece alone, at its best. None
   shows a `StatusLine` squeezed under a field as a "don't".
4. **Process (the agent's own part).** Screens were judged on the render for correctness (right
   piece, right tone), not for visual weight against their neighbours.

**Not caused by today's cleanup.** Checked: the DS guidance trim (DS PR #2) removed no line
about field-level or quiet feedback. Before today (pin e0cadea) the DS had no feedback
guidance at all. The gap came in with the new feedback rules (DS PR #1), written today.

## Proposed fix (a small DS PR, owner to approve first)

1. **Add a scope question to the feedback rules**, before the piece is picked:

   | Where the message belongs | Piece |
   |---|---|
   | One field | 16px `StatusMark` + words under the field (success); `StatusFieldError` (refusal) |
   | A section, card or list | `StatusLine` |
   | A whole dialog | `OutcomeHeader` |
   | A whole page | `PageOutcome` |
   | A quick act, page stays put | `notify` toast |

2. **Name the field-level confirmation**, either a small `StatusFieldNote` piece mirroring
   `StatusFieldError` or a documented recipe (16px `StatusMark` + `text-body-compact
   text-success-ink`, `role="status"`). The registration line on `feature/coverage-board` is the
   reference.
3. **Add a "Do / Don't, in context" section** to the feedback docs page. First pair: the
   verified line (16px mark) vs the `StatusLine` under a field.
4. **Add one line to the agent rules:** compare each changed screen's feedback against what's
   around it for weight, and prefer the smallest existing piece that fits.

## Owner's line (30 Oct) and suggested wording

The owner wants one or two lines asking for a visual judgment on how big the moment is.
Suggested, so it is concrete rather than "use judgment":

> **Match the feedback to the size of the moment.** Before picking a piece, ask where the
> message belongs: one field, a section, a dialog or the whole page. Use the lightest piece for
> that scope. Then look at it on the screen next to what's around it: if it's louder than the
> thing it's about, it's the wrong size.

Keep it short, with the scope table above as its reference. More rules make the guidance
easier to skip (the earlier agent-guidance audit found the docs too long).

## How to know it worked: test, don't trust

After the DS change, give a fresh session 4 or 5 small tasks with no "before" to copy from,
for example: show that a PIN code was looked up; confirm a document was attached; tell the
clerk a batch was saved; say an upload failed inside a dialog; a page whose link has expired.
Check that it picks the right weight. Where it doesn't, that's the next rule to sharpen.
The owner's Agree / Keep as today / Different call pass on the board does the same job for
existing screens.

## Where things are

- Board and examples: branch `feature/coverage-board`, `/coverage-board`. See `HANDOFF.md`.
- DS repo: pucardotorg/dristi-design-system, main f94f820 + PRs #4/#5 (current pin e2cce9b).
  Local clone `dristi-ds-feedback` (push via remote `pucar`, never `origin`).
