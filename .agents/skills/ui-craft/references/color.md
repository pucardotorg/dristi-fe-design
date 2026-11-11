# Colour

Read before choosing any fill, tint, icon colour or badge tone, and in every polish pass.
Colour is where "it works but looks ugly" usually comes from: the layout is right and the
fills fight it. Tokens come from the pinned DS; this is how to choose among them.

## Colour carries meaning, nothing else

- Before using a hue, name what it means on this screen. If two elements of the same kind
  (two panel tiles, two option cards) get different hues, there must be a real difference
  in meaning between them. Otherwise use one. (2026-11-11: brand blue on New filing and
  info blue on Bulk filing meant nothing, and "info" implied a notice.)
- One accent per view: the brand. Semantic tones (success, warning, destructive, info) mark
  status, attention or feedback only, never decoration or category.
- The most saturated thing on screen should be the thing that most needs the user (a
  warning count, the primary action). If a decorative tile out-shouts the warning, swap.

## Fill direction encodes affordance

- Actionable things sit bright and forward: white (`bg-card`) with a defined edge
  (`border-border`, the DS outline card on a white panel), tint on hover or selection.
- Recessed fills (`bg-surface-sunken`, `bg-muted`) are for passive content: wells,
  previews, read-only values, control tracks, the table header strip. A grey card reads as
  disabled or inert. Never make the clickable options the dullest objects in a panel.
- Unavailable or "coming soon" is the quietest item: muted tile, never brighter than the
  available ones. Check: the disabled option's tile and text have lower contrast than the
  enabled one's.

## Temperature and tile-in-tile

- Neutrals follow the canvas. This product's canvas and greys are warm; keep fills, strokes
  and shadows in that family. A cool tint is allowed only as the accent itself.
- Don't put a tinted tile on a tinted card (cool brand tile on warm grey card): two fills,
  two temperatures, muddy edges. Put tints on white.
- Don't stack fill + tint + hairline + inner tile in one small object. One fill change per
  layer.

## Budgets

- Per region: at most one accent hue, one semantic tone (only if something needs
  attention) and the warm neutral ladder. Count them with the census below.
- Badges: neutral by default; a semantic tone only when the badge is status that needs
  action.

## Checks

**Colour census** (distinct fills, strokes and inks in a region):

```js
(sel => { const bg = new Set(), bd = new Set(), ink = new Set();
  document.querySelectorAll(sel).forEach(root => [root, ...root.querySelectorAll('*')].forEach(e => {
    if (!e.getClientRects().length) return; const s = getComputedStyle(e);
    if (!/rgba\(0, 0, 0, 0\)/.test(s.backgroundColor)) bg.add(s.backgroundColor);
    if (parseFloat(s.borderTopWidth) > 0) bd.add(s.borderTopColor);
    if ([...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) || e.tagName === 'svg') ink.add(s.color);
  }));
  return { fills: [...bg], strokes: [...bd], inks: [...ink] };
})('main [data-slot=card]');
```

Read the list: each colour should map to one role (canvas, panel, accent, attention,
muted). A fill you cannot name the role of is the defect. Compare warm and cool: neutral
RGB values with R ≥ G ≥ B are warm; B > R is cool.

**Grayscale test** (`document.documentElement.style.filter='grayscale(1)'`): the actionable
items still stand out by value and edge; status still reads by icon or word. Then reset.

**Squint test:** the eye lands on the primary action or the attention item first, not on a
decorative tile.
