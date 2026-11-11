# Finesse tells

The small defects that make UI look unconsidered, with how to detect each. Items marked
**(owner)** are ones the owner has flagged on this product; expect them to be checked first.
"Zoom" means the browser tool's zoom action at 2–4×. Snippet letters refer to `audit.md`.

## Alignment

1. **(owner)** Control off its column header: a checkbox centred while its header label is
   left-aligned, or a DS cell that drops its right padding around a checkbox, shifting a
   centred control 8px. Detect: snippet A on the column. Fix: one rule per column.
2. **(owner)** Icon "floating" against its header: a borderless button's icon sits 12–13px in
   from the label because the button pads it. Detect: icon ink-left vs header text-left.
3. Header label and cell text on different lines (different padding classes on `th`/`td`).
4. Panel heading not on the first column label's line (panel padding vs table inset).
5. Rows with and without a leading icon start their text at different x.
6. Text inside a hover or selected fill shifts relative to text outside it.
7. Icon sits high or low against its label (line box centred, not cap height). Snippet E.
8. Numbers left-aligned or proportional in a compared column.
9. Too many left edges in one container: more than three keylines, or values 2–8px apart.
10. Asymmetric glyphs (play, chevron) geometrically centred and looking off. Nudge ≤3px.

## Spacing and containment

11. **(owner)** Fill band edge intersecting the container: a header strip with rounded ends
    running flush into a rounded panel's straight inner edge, or inset on one side only.
    Detect: snippet B, zoom on the corner.
12. **(owner)** Padding with no thought: content closer to the container edge than to its
    siblings; padding stacked so text sits 40px in under a title at 24px.
13. Proximity inverted or ambiguous: an eyebrow as far from its title as from the block
    above; a heading equidistant between sections; a label nearer the previous field.
14. Unequal gaps between equal siblings; off-ladder values (5, 7, 10, 13, 18). Snippet F.
15. Nested radius not concentric: the inner radius equal to or larger than the outer.
    Snippet C.
16. Collapsed or doubled spacing at a seam between components from different files.

## Edges and surfaces

17. **(owner)** Strokes too dark: dividers reading as a drawn grid rather than a hairline.
18. Box inside box inside box: more than canvas → panel → well; cards on cards.
19. Border + shadow + fill on one element; double borders where two edged things meet.
20. Hairlines of different darkness or hue in one region (warm canvas, cool grey lines).
21. Focus rings, badges or shadows clipped by `overflow:hidden`; things poking past their
    container. Snippet G.
22. Sticky header with no separator once content scrolls under it.
23. Square row fill under a rounded header strip (fill on the `tr`, not the cells).

## Typography and hierarchy

24. **(owner)** Heading levels barely differ: a 14px eyebrow stacked over a 16px title with
    only colour between them, so neither leads. Fix: let the name lead and put the role on
    the same line, muted; or make the step clear.
25. **(owner)** Weak hierarchy overall: everything at one weight, or bold everywhere.
26. Two styles for one role; near-duplicate sizes (14 and 15). Snippet D.
27. Inverted levels: a subsection as large or bold as its section.
28. Label as loud as its value, or bold labels with regular values.
29. Visual headings that are not semantic headings, or the reverse.
30. A widow in a heading, one word alone on a button's second line, a unit split from its
    number, truncation with no tooltip.
31. 12px doing label work in data UI (the product floor is 14).

## Controls and icons

32. **(owner)** Mixed treatments breaking a column: an outlined button, a ghost link and a
    two-line link in one column, so the column edge disappears.
33. Adjacent controls of different heights; 36px controls beside 40px ones.
34. Icon sizes or strokes mixed in one region; icons darker than their text.
35. Icon tiles where they don't earn it (every row, minor panels), or **(owner)** the
    reverse: a primary entry surface stripped of its anchor so it reads as a sub-action.
36. Hit area under 40×40px; a checkbox whose label is not part of its target.
37. Two primary actions in one region.

## Content and redundancy

38. **(owner)** A sub-line that adds nothing ("Provided at case intake", "PDF document"
    under a PDF). Test: a distinct fact, absent elsewhere in the row? Else delete.
39. **(owner)** A count or status floating with no anchor ("1 of 2 required added" beside a
    title) when the rows and footer already say it. Attach it to what it counts, or delete.
40. **(owner)** Too many notice styles: a tinted box, a left-bar callout and a coloured line
    on one screen. One notice per region, from `components/feedback`.
41. **(owner)** Generic or AI-sounding copy: a description that explains the widget ("Each
    tab is a stage") instead of telling the user what to do; filler verbs; "please".
42. A label repeated in every cell; a subtitle restating its title; helper text restating
    its control.
43. One meaning encoded three times (icon + pill + text), or one colour carrying two meanings.

## Colour

48. **(owner)** Clickable options filled with a sunken grey, so they read disabled and are
    the dullest thing in the panel.
49. **(owner)** Two hues for two things of the same kind (brand tile here, info tile there)
    with no difference in meaning.
50. **(owner)** Warm grey card holding a cool tinted tile: two temperatures and two fills in
    one small object.
51. **(owner)** The unavailable option brighter than the available one (a white tile on
    the "coming soon" card).
52. More than one accent hue in a region, or a semantic tone used as decoration.

## States

44. Layout shift between states: bold-on-select widening a tab, a spinner replacing a
    label, a row growing when a file lands.
45. Empty, one-item, long-content or error state never rendered.
46. Hover or focus no more visible than rest; no focus-visible ring.
47. A filled and an empty slot with different footprints, so the list jumps.

## "Chunky and outdated" in measurable terms

Box depth > 2 · dividers darker than a hairline · vertical cell borders or zebra stripes ·
single-line rows over 56px · app buttons over 40px · more than 5 type sizes or 3 weights on
one screen · more than one notice per region · more than 3 badge tones in one table ·
status dots without text · more than one button variant among equal-rank actions · icon
tiles on every row · every panel carrying a description line. The opposite failure is
"undesigned": a primary surface flattened to text and a hairline, with no anchor or weight.
