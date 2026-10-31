# Card raised · handoff (Oct 30, 2026)

Branch `feature/card-raised`, PR pucardotorg/dristi-fe-design#182 into `main`. Open, not merged.

## Done
- 81 `Card`s in 50 files use `variant="raised"`. Their hand lift classes are gone: `PANEL_CLASS`, the `SHEET` constants, or a literal `border-hairline shadow-raised`.
- `PANEL_CLASS` stays for lifted panels that are not a `Card`.
- No visible change:
  - Measured shadow and edge are identical on every rendered card.
  - A production pixel sweep (119 routes × phone, iPad portrait, iPad landscape, desktop × light, dark) has 36 differing pairs. All of them also appear in a main-vs-main control run, or come from the server port printed on `/provakil/settings/integrations/saras`.
  - 81 dialog shots are identical.
- `tsc` passes. `npm run lint` matches main: the 3 Provakil eslint errors and 11 spacing/typography findings were already there.

## Left (owner's call, not in this PR)
- Raised cards that sit on white. The DS rule says `outline`, but switching is a visible change: `/ds-audit` (15), `/employee/configurations`, and the "This task is not here" card on `/tasks/[id]`.
- About 45 lifted panels that are plain `section`/`div`/`li` elements, not `Card`s.
- The record-returns dialog (Sign process) was not reached by script. It got the same one-line change.

## Verification setup
- Baseline worktree `dristi-card-raised-base` (detached origin/main 0ab02ff, node_modules symlinked).
- Production builds only. The servers ran on 4911 (main) and 4912 (branch), headless Chrome on 9411–9414. All are stopped now.
- Demo bulk data was copied into each checkout's `apps/dristi-app/.data`.
- Run `npx next typegen` before `tsc` in a fresh worktree.

## Next step
Wait for the owner's review of #182. Merge only on their go.
