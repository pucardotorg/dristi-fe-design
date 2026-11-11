# Surfaces, containment and edges

Read when composing or polishing panels, tables, rails, wells, fills or repeated rows. The
owner adopted the warm canvas with lifted panels on 2026-09-11. This is a product
composition convention, subordinate to the pinned DS and any explicitly approved reference.

## The product recipe

- Work canvas: `bg-muted dark:bg-background`. Chrome: `bg-card`. Rails: `bg-sidebar`.
- Panels: the shared `PANEL_CLASS` recipe in `components/filing/form-card.tsx` (hairline
  plus raised shadow), or `Card variant="raised"` on the warm canvas. Reuse the recipe;
  never copy class strings.
- Wells: `bg-surface-sunken` inside panels, for passive content (previews, read-only
  values, control tracks, the table header strip), never for clickable options: a recessed
  grey reads as inert. A well directly on the muted canvas can disappear; keep a panel or
  another boundary between them.
- Tables: `components/chrome/table-plate.ts`, inset 8px in the panel, fills on cells.
- Dark mode stays flat (card = page); the edge still defines the panel.

## One separation device per boundary

Separate with space first, then fill, then a hairline, then a justified shadow. Don't stack
them: a border, a shadow and a fill on one element triple-encode one boundary, which reads
heavy and dated. Chrome seams and row rules use hairlines (`border-hairline`) or nothing;
control edges use the DS input token (≥3:1). Count the devices on each boundary you touch.

## Fills inside rounded containers

A filled band inside a rounded panel (table header strip, hover or selected row, toolbar)
takes exactly one of two forms:

1. **Full-bleed:** touches the panel's sides, clipped to the panel's radius
   (`overflow-hidden` on the panel, or the band's touching corners take the panel radius).
   Its text stays on the panel's content keyline.
2. **Inset:** the same gap on every near side, with a concentric radius. Its text gets its
   own padding, and the content below matches that x.

Anything between, flush with rounded ends or inset on one side, puts two competing edges at
the corner: the owner's "edges intersecting weirdly". Row fills match the header band's
form and extent. A `<tr>` cannot round; fills and radius go on the end cells
(`tableRowClass`).

## Nested radius

Inner radius = outer radius − gap (the gap includes the border). When the gap is at least
the outer radius, clamp to a small radius rather than reusing the outer one. A child flush
with the container's edge shares its radius on the touching corners or is clipped. Check
with snippet C; an established product recipe wins over the formula when they disagree by
one token step.

## Edge-to-edge or inset content

Pick one per container: dividers either all reach the edge or all start at the text
keyline. Scanning data (tables, row lists) usually sits in the inset table plate; prose,
forms and summaries stay inset in the panel padding.

## Repeated content

- Match the same fact and interaction across siblings; different meanings may earn
  different emphasis. Keep consequential warnings even in dense lists.
- One clear primary action per meaningful region. Don't move or hide an action to satisfy a
  colour quota.
- Hover-revealed actions also reveal on focus-within and stay discoverable on touch.
- Repeated rows lead with useful content and their main action. Secondary actions are quieter
  but keep accessible names.
- Align shared horizontal rules and numeric columns; avoid doubled seams and shifted
  underlines. Decorative icons follow the text line's colour and size and have no semantic
  role.

## Shadows and strokes

Shadows come from DS elevation tokens only, one light source, larger for higher layers
(popover, modal) than for panels. No shadow on in-flow content that already has an edge.
Decorative dividers are 1px and light enough to read as a hairline, not a drawn grid.
Hairlines in one region share one token.

If a token value or primitive API prevents the agreed result, report a concrete upstream DS
gap. Do not adjust token values locally or restyle primitive internals. Re-measure any
contrast claim against the current pin and theme before using it in a finding.
