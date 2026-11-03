---
name: ui-craft
description: "Apply Dristi's compact craft checklist to UI builds and reviews: hierarchy, surfaces, typography, motion, and render quality. Load detailed references only for the subject being changed."
---

# UI craft

Use with `pull-ui-from-ds` for implementation and `review-ui-ds` for review. The pinned
DS governs tokens and primitives. These product conventions and judgment checks operate
within it; they do not authorize a second DS or invented behavior.

## Core checklist — every UI change

- Preserve the agreed reference's structure, action scope, and interaction. Explain the
  smallest necessary deviation for an actual DS/accessibility conflict to the coordinator.
- Make canvas, chrome, panels, and wells distinguishable. Current product default:
  `bg-muted dark:bg-background` canvas, lifted panels, sunken wells inside panels.
- Use named DS text roles and foreground/fill pairs. Prefer clear hierarchy through
  weight and color before increasing size. DS typography requirements outrank a two-weight
  preference. Use `tabular-nums` for compared numbers, dates, counts, and currency.
- Keep emphasis meaningful. Do not hide required actions or warnings to meet an arbitrary
  count. Facts trace to actual fields or current requirements; guidance remains helpful copy.
- Check affected sibling patterns, labels, keyboard/focus and touch access. Hover-only
  affordances need keyboard and touch equivalents. Remove unnecessary decoration if present;
  a clean screen requires no forced cosmetic change.
- Judge affected UI at desktop and about 375px, both themes, with relevant states and long
  labels. Follow `.agents/policies/verification.md`; unavailable render evidence stays pending.

## Read only what the task needs

- Panels, tables, rails, or repeated rows: [surfaces](references/surfaces.md).
- Text hierarchy and density: [typography](references/typography.md), alongside DS typography.
- Dialogs, staged flows, or animation: [motion](references/motion.md).
- Success, failure, warning, notices, toasts, confirms, field errors, dead ends: the
  `feedback-states` skill. Use `components/feedback`, never a hand-built status UI.
- Explicit investigation of historical measurements/rationale:
  [research](references/research.md). Re-measure against the current DS; this is not a gate.

Reuse unchanged references already read in the task. Record an upstream issue only when
it affects the work, with the observed value and consequence. Do not repeat a static
backlog of old DS complaints in every build report. Visual judgment can produce a
suggestion; required fixes need a demonstrated rule or acceptance failure.
