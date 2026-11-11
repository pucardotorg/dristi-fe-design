# Component micro-craft

What refined looks like per component, and how to check it. Refined means fewer, quieter,
aligned: one surface boundary per region, hairline dividers, 3–5 type sizes and 2 weights,
one control height per row, colour carrying one meaning, copy that names the act. Product
recipes and owner rulings (SKILL.md) win where these differ.

## Tables

- **Alignment.** Text left; quantitative numbers right, header included, with
  `tabular-nums`; qualitative numbers (dates, case numbers) may stay left. No centred text
  columns. A control column follows one rule: left on its label's line (preferred here,
  because DS cells drop right padding around checkboxes) or centred under a centred header.
  Check: snippet A, deltas within 1px.
- **Header strip.** One or two words, sentence case, muted, semibold 14 (`TABLE_HEAD`), the
  same height as the rows. It is a key, never the loudest thing on the page. The actions
  column needs no visible label (keep it for screen readers).
- **Inset in a panel.** The table sits 8px inside its panel (`table-plate`: panel `p-2`) so
  the rounded strip is a well. The panel's heading starts on the first label's line
  (8px inset + 16px cell padding = 24px). Never stack panel padding on cell padding.
- **Rows.** Height from one ladder per table. Light horizontal hairlines or none. No zebra,
  no vertical rules. Hover and selected fills go on cells, rounded at the ends
  (`tableRowClass`). Cell content centres for up to about three lines; taller rows top-align.
- **Row actions.** Last column, one treatment for every row (same variant, size and right
  edge). Three or more become a menu. Destructive actions go in the menu, not as a loose
  bin icon beside the primary.
- **Empty, loading, error.** Skeleton rows at the real row height. Empty states name the
  object ("No batches yet"), give one line on what to do and one action. A filtered empty
  state offers clearing the filter.

## File, document and attachment rows

- **Composition.** Type glyph → name (truncated, full name on hover or focus) → quiet meta
  (size) → state → one replace or remove control at the right edge. A status belongs to its
  row's DOM, never floating below the list.
- **Filled vs empty slot.** The same footprint (height, left edge). The filled file takes
  the place of the add action. One visual difference between the states, not a restyle.
  Upload and filed-file controls share one height.
- **Column alignment.** A bordered Upload button aligns by its border; a borderless filed
  file aligns by its icon ink. Both sit on the column label's line.
- **Drop and keyboard.** Drop targets show an active edge. Space/Enter opens the picker and
  focus returns afterwards.

## Forms

- Label above the field, a one-sentence hint between label and field, the error after the
  hint. Sentence case, no trailing colon. Placeholders are never labels.
- The label-to-field gap is clearly tighter than the field-to-next-label gap (about 1:3).
- One required/optional convention product-wide (here: the DS `RequiredMark`). Never both
  marks and a legend.
- Errors name the failure and the fix ("Cheque number must be 6 digits"). No "invalid",
  "please", "This field is required". Focus the first error on submit.
- Field width signals expected length (PIN code, cheque number, dates).
- A checkbox or radio sits left of its label, centred on the label's first line, with the
  label inside its target. Group with a fieldset and legend.

## Buttons

- One primary per region. Secondary (outline) is the everyday alternative; ghost is for
  dense, repeated actions (rows, toolbars). Never mix ghost and outline among equal-rank
  actions in one group or column.
- Every control in one row or footer shares a height on the DS ladder (32/36/40/44).
- Icons only where their meaning is established, one size per button size. The DS reduces
  the padding on the icon side (`has-data-[icon=inline-start]:pl-3`); account for it when
  aligning.
- Labels: sentence case, verb first, name the object ("Create a new batch", "Sign 8
  cases"). A label that commits states what it commits. Loading keeps the label.
- A split button (main act + menu of variants) is a `ButtonGroup` of the act and an icon
  trigger with an accessible name.

## Panels and cards

- A card marks a real group acted on as a unit. If a region is already bounded, use space
  or a heading. Depth stops at canvas → panel (→ well).
- Header: title, optional meta, actions on the title row at the right. A description stays
  only if deleting it would lose a fact or an instruction. A header that repeats the page
  title is noise; drop it.
- Primary entry panels (File a case's New filing and Bulk filing) open with a 48px icon
  tile (`rounded-xl`, the brand-muted pair for every entry, one hue) above a
  `text-title-s` title, each in its own raised panel (the panel is what separates the
  entries), then their options as an inset grouped list: one recessed tray
  (`OPTION_TRAY`, the passive container) holding white rows (the things to pick), no
  outlines, brand on the icon and on hover. Earlier tries, each rejected: hairline rows (not
  clear), grey cards (disabled), outlined cards (dated), white cards on a white panel (cards
  in cards). Older text said options were
  lifted white cards with a brand-tinted icon (`EntryHead` / `EntryOption` in
  `filing/dashboard`). Minor panels and repeated rows get no tile.
- An eyebrow earns its place only as context the title cannot carry. Otherwise put the role
  after the name on one line, muted (see `typography.md`).
- Title, body and actions share the panel's content-left keyline.

## Status, badges, notices

- Badges: one or two words, sentence case, next to what they describe, never a dot without
  text. Most rows neutral; colour only where attention is needed; one meaning per hue.
- Notices: at most one per region, from `components/feedback` (`StatusLine`, `Banner`,
  `Alert`). A success notice only when success is not visible in the UI. Link text names
  the destination.

## Copy

- Front-load, cut filler: "Continue a draft, or check where each filing stands", not "All
  your filings, finished and in progress. Each tab is a stage."
- Sentence case everywhere; numerals for counts; "…" and curly quotes.
- AI-slop tells: a sub-line restating its heading, welcome openers, filler verbs (empower,
  leverage, unlock, seamless), vague calls to action (Get started, Learn more, Submit),
  "No data available", "Something went wrong", hints paraphrasing labels, status naming no
  object. Check: regex the rendered text for
  `please|oops|sorry|invalid|seamless|effortless|leverage|unlock|empower|click here|learn more|something went wrong|no data`.
