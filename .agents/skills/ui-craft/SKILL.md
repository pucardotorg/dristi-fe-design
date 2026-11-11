---
name: ui-craft
description: "Dristi's UI craft standard: how a world-class product designer sees, measures and polishes UI on the render. Load it for every UI build, polish or craft pass, design-mode report, review, or 'make it feel designed / polished / not chunky' request, even a one-line visual fix. Covers scoping (polish vs redesign), a measured render audit (alignment axes, padding and inset relationships, nested radius, hierarchy, icons, surfaces, states), component micro-craft (tables, file rows, forms, buttons, panels, notices, copy) and the finesse tells the owner catches."
---

# UI craft

The owner judges UI the way a senior product designer does: at 200% zoom, on the render,
by relationships. Whether an edge meets an edge, whether a label owns its column, whether a
heading's levels differ enough, whether a line earns its place. "No one gave a thought about
the padding" is the failure this skill exists to prevent. So is its opposite: asked to
polish, rebuilding a component and making it "chunky and outdated".

Two habits carry the whole skill:

1. **See ink, measure relationships.** Judge what is visible (glyphs, strokes, edges), not
   element boxes, and judge pairs (header ↔ cell, padding ↔ gap, outer ↔ inner radius,
   eyebrow ↔ title) rather than single values. Measure on the running page; never declare
   alignment from source.
2. **Change the least that removes the defect.** Most finesse wins subtract: a border, a
   line, a weight, a wrapper, padding. Keep the skeleton the owner already knows.

Use with `pull-ui-from-ds` (implementation) and `review-ui-ds` (review). The pinned DS
governs tokens and primitives; this skill operates inside it and never authorizes a second
DS, a locally edited primitive or invented behaviour.

## Scope before you touch

Classify every request first and say which class you are working in:

- **Polish** (the default for "polish", "craft pass", "clean up", "lacks care", "fix the
  details", design-mode comments): change values inside the existing structure: spacing,
  alignment, weight, colour token, radius, a removed line, copy. Same elements, same order,
  same layout model.
- **Adjust**: move, merge or remove elements within the same layout, only where a named
  finding requires it, each one named in the report.
- **Redesign**: a new layout model (table → rows, new panels, new hierarchy). Only on an
  explicit request ("redesign", "rethink from first principles"). Even then, keep the
  product's existing patterns (the shared table plate, pill filters, the one-modal flow).

If polish findings point to a structural problem, report it as "Recommendation: needs your
call". Do not build it. "Lacks design polish" is not permission to rebuild (2026-11-11: a
documents table rebuilt into rows came back as "worse than before", reverted the same turn).

## Workflow

1. Load the DS baseline the policy requires (`pucar-design-system.md`), then this skill.
2. Pass 0: scope and baseline. Screenshot at the owner's viewport and 375, and run the
   measurement snippets. Without a baseline you cannot prove an improvement.
3. Run the audit passes in order, looking only, before fixing: squint → hierarchy and
   redundancy → alignment axes → spacing and containment → type → surfaces and edges →
   controls and icons → states and viewports. Procedure and snippets: [audit](references/audit.md).
4. Fix in the same layer order, at the source, once. Hierarchy and redundancy first (they
   remove elements), then alignment, spacing, type, surfaces, states.
5. Re-measure with the same snippets and viewports; diff against the baseline. Zoom on every
   corner and seam you touched.
6. Report verified / found but not fixed / would not change, with numbers (format in
   `audit.md`).

## The core rules (every UI change)

**Alignment.** Each container has a few keylines: content-left, content-right, column lines.
Every text start, leading icon and visible control edge sits on one within 1px; 2px is a
defect; a needed 8px correction means the structure is wrong. In a column, the header
label, every cell's ink and every control obey one rule (left to the label, or centred under
it, never mixed). A panel's heading starts on its first column label's line. A borderless
item aligns by its ink (a ghost button's icon), a bordered one by its border.

**Spacing and containment.** Inside-group gaps are at most half the outside gaps. Container
padding ≥ child gaps and steps down when nesting. Padding never stacks off the keyline.
Fills inside a rounded container are full-bleed and clipped, or inset evenly with a
concentric radius (inner = outer − gap). Never flush with rounded ends, never inset on one
side. Every value on the DS spacing ladder.

**Hierarchy.** Adjacent levels differ in one or two of size, weight and colour: not zero
(they collapse) and rarely three (loud). About three type sizes per component, at most two
text levels per row. A secondary line stays only if it is a distinct fact not already shown
by a header, icon, chip or context: delete sub-lines that restate provenance, headings or
controls. Facts are attributes, guidance is copy.

**Surfaces.** One separation device per boundary: space, fill, hairline or shadow. Not
stacked. Two levels: canvas, then lifted panel, with sunken wells inside panels. Decorative
strokes are hairlines; control edges meet 3:1. No cards on cards, no accent bars.

**Colour.** Every hue means something you can name; elements of the same kind share one.
One accent (the brand) per view; semantic tones only for status or attention. Actionable
things are bright and forward (white, defined edge, tint on hover); recessed grey fills are
for passive wells. A grey option reads disabled. Unavailable is always the quietest.
Neutrals stay in the canvas's warm family; no tinted tile on a tinted card. Run the colour
census and the grayscale test (`color.md`). 2026-11-11: a layout the owner liked "looks
ugly" because grey option cards, two meaningless blues and a bright "coming soon" tile
fought it.

**Prominence matches importance.** Quiet is not the goal; the right weight is. A primary
destination (an entry point like File a case, a step's main choice) gets a visual anchor
before its heading (a 48px icon tile), a section-level title and options with presence.
Secondary and repeated content stays quiet: no icon tiles on every row or minor panel.
Removing anchors from a primary surface makes it read as a sub-action (2026-11-11: "it
should look more prominent… a visual anchor before you read the heading").

**Controls and icons.** One height per row of controls. One icon size and stroke per
region; icon colour equals its text or one step muted. Targets ≥40×40px. One primary
(teal) action per region.

**Copy.** Sentence case, verb + object, directive and specific. No filler, no "please",
no sub-line that restates its heading, no status that names no object.

**Accessibility and states.** DS floor: WCAG 2.1 AA, visible focus, labels, 200% zoom,
Indic scripts. Walk hover, focus, selected, disabled, loading, empty, error, long labels.
No layout shift between states. Desktop, ~375px and both themes when colour or surfaces
change.

## Product conventions (owner rulings that outrank generic advice)

- Canvas `bg-muted dark:bg-background`, lifted white panels (`PANEL_CLASS`), sunken wells.
- Tables compose from `chrome/table-plate.ts`, inset 8px in their panel, header strip with
  rounded ends on the cells. Never a private table treatment.
- Filters are the shared pill row (`chrome/pill-plate.ts`), not segmented controls.
- No 12px in data UI: labels 14 muted, values 14 foreground, card titles 16 semibold.
- Flows progress inside one modal; confirmations are the plain alert (question, one line,
  Back / act). Feedback uses `components/feedback`.
- Court-side screens are minimal: no panel headers, pills, hint rows or subtitles by default.
- Status: one meaning per colour; a case's status uses the shared status words, not ad-hoc
  pills.
- Bulk filing changes reach shared filing sections only through `FieldPolicy` opt-ins.

## Read only what the task needs

- Any polish, craft pass, review, or design-mode report: [audit](references/audit.md) and
  [tells](references/tells.md).
- Tables, file or document rows, forms, buttons, panels, notices, copy:
  [components](references/components.md).
- Any fill, tint, icon colour or badge tone, and every polish pass:
  [colour](references/color.md).
- Panels, wells, fills, radius, borders, shadows: [surfaces](references/surfaces.md).
- Heading levels, eyebrows, label/value, density: [typography](references/typography.md),
  alongside the DS typography page.
- Dialogs, staged flows, animation: [motion](references/motion.md).
- Success, failure, notices, toasts, confirms, field errors: the `feedback-states` skill.
- Historical measurements only when explicitly investigating them:
  [research](references/research.md).

Reuse references already read in the task while unchanged. A required fix needs a measured
defect or a demonstrated rule; taste alone is a P3 suggestion for the owner. Record an
upstream DS issue only when it blocks the work, with the observed value and consequence.
