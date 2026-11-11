# Render audit: the passes and the measurements

Contents: the ink principle · Pass 0 scope and baseline · Pass 1 squint · Pass 2 hierarchy
and redundancy · Pass 3 alignment · Pass 4 spacing and containment · Pass 5 typography ·
Pass 6 surfaces and edges · Pass 7 controls and icons · Pass 8 states and viewports ·
diffing the render · measurement snippets A–G · writing up.

Read before any polish, craft pass, review, or "make it feel designed" request, and before
reporting a UI build as done. Each pass looks at one layer; do all the looking first, then
fix in layer order. Measurements use the browser tool's `javascript_tool` on the running
page; the zoom action is the designer's loupe.

## The principle under every check: measure ink, not boxes

A designer sees ink, the visible glyphs, strokes and edges. An agent measuring element
boxes misses most defects, because:

- text has half-leading above and below the glyphs;
- an SVG icon sits inside a 24px canvas with empty margin (Lucide: ≥1px safe zone, 2px
  stroke), so the drawn shape starts right of and below its box;
- a ghost or link button pads its label, so its box edge is invisible;
- the DS adds context-dependent padding (a `Button` with a leading icon gets `pl-3`, a
  `TableCell` holding a checkbox loses its right padding).

Compare the ink: text ranges for text, the icon box (or `getBBox()` for exact glyph bounds)
for icons, the box itself only when the element has a visible edge (border or fill).

**Tolerance.** ≤1px is aligned. 2px or more is a defect. A needed correction of 8px or more
means the structure is wrong (stacked padding, a wrapper, the wrong component), not that it
needs a nudge.

## Pass 0: scope and baseline (before touching anything)

1. Write the request in one line and classify it (see SKILL.md, "Scope before you touch"):
   polish, adjust or redesign. Default to polish.
2. Confirm the page is served from your checkout, with realistic data: long names, empty
   fields, one row and many rows.
3. Capture the baseline: screenshots at the owner's viewport (often 1728 or 1440) and at
   375, plus the JSON from the snippets below. This is the "before" you diff against.

## Pass 1: squint and first impression (whole screen)

- Look at the full screenshot. Note where the eye lands first, second, third, and compare
  with what the user's job needs first.
- Squint: `document.documentElement.style.filter='blur(4px)'`, screenshot, then reset. One
  primary focus? Groups still read as groups? Any divider, fill or badge louder than content?
- Grayscale (`filter: grayscale(1)`): if status or hierarchy disappears, it relied on colour.

## Pass 2: hierarchy and redundancy (read every string)

- List the heading levels and what each labels. Flag two styles for one level, a level that
  barely differs from its neighbour, a heading that repeats its parent, a section headed
  while its siblings are not.
- Read every string in order and test each secondary line: is it a distinct fact the user
  needs, not already said by a header, icon, chip, column or context? If not, it goes.
  Typical offenders: a sub-line restating provenance ("Provided at case intake"), a subtitle
  restating the title, "Status:" before a status, helper text describing the control.

## Pass 3: alignment axes

- Every container has a few vertical keylines: its content-left edge (edge + padding), its
  content-right edge, and column lines. Collect the ink-left of every text start and leading
  icon; cluster with 1px tolerance. Expect ≤3 keylines per container; any value 2–8px from
  a cluster is the defect.
- Tables: each header label's ink sits on the same line as its cells' ink (snippet A).
  Controls (checkbox, icon, button) obey one rule per column, left-aligned to the label or
  centred under it, never mixed. Numbers right-aligned, header included, `tabular-nums`.
- A panel's heading starts on the same line as the first column label below it.
- Rows: icon, label and trailing meta share one optical centre (snippet E).

## Pass 4: spacing and containment

- Proximity: the gap inside a group (eyebrow→title, label→value, heading→body) is at most
  half the gap to the next unrelated thing. A heading equidistant between two blocks
  belongs to neither.
- Container padding ≥ the gaps between its children. Padding steps down when nesting
  (24 → 16 → 12), never up. Card padding plus table cell padding must not stack and push text
  off the card's keyline.
- Fills inside rounded containers (table header band, hover or selected row, toolbar strip)
  are either **full-bleed and clipped** to the container radius, or **inset evenly** on the
  near sides with a concentric radius. A band that runs flush to the inner edge with its own
  rounded ends, or is inset on one side only, makes two competing edges at the corner: the
  "edges intersecting" defect (snippet B). In this product, tables sit inset 8px in their
  panel (`table-plate`: panel `p-2`, header cells round their ends).
- Nested radius: inner = outer − gap (snippet C). When the gap ≥ the outer radius, clamp to a
  small radius rather than reusing the outer one.
- Every padding and gap is on the DS spacing ladder (snippet F).

## Pass 5: typography

- Group computed text styles (snippet D). One style per role: page title, section title,
  card title, label, value, body, meta. Flag near-duplicates (14 vs 15, 500 vs 600 for one
  role) and inverted levels.
- Adjacent levels differ in one or two of size, weight and colour, not zero and rarely
  three. A title over an eyebrow needs a clear step (see `typography.md`).
- Widows in headings, one word alone on a button's second line, truncation without a
  tooltip, units split from numbers.

## Pass 5b: colour

Run the colour census and the grayscale test from `color.md`. Name the role of every fill;
check one accent per region, actionable items bright, unavailable quietest, neutrals warm.

## Pass 6: surfaces and edges (zoom 200–400%)

- Zoom on every corner, seam and intersection: card corners, header band meeting the
  container, first row under the header, sticky headers, focus rings near edges, scrollbars
  in rounded containers.
- One separation device per boundary (space, fill, hairline or shadow). Flag border + shadow
  + fill on one element, double borders at seams, hairlines of different darkness.
- Clipping: focus rings, badges or shadows cut by `overflow:hidden`; elements poking past
  their container (snippet G).

## Pass 7: controls and icons (zoom 200%)

- Adjacent controls share a height. One icon size and stroke per region; icon colour equals
  its text colour or one step muted, never darker.
- Visible edges in one column line up: a bordered button's border, a borderless item's icon
  ink, and the column label share a line.
- Targets ≥40×40px (DS floor); a checkbox and its label are one target.

## Pass 8: states, then viewports

- Hover, focus-visible, active, selected, disabled, loading, empty, error, one item, many
  items, long labels. No layout shift between states (bold-on-select, spinner replacing a
  label, a row growing).
- Viewports: the owner's width, 1280, 375 (or the DS phone width), 200% zoom. No page-level
  sideways scroll, no stray inner scrollbars, no truncated key facts. Both themes for
  colour or surface changes.

## After fixing: diff the render

Re-run the same snippets at the same viewports and data. Every flagged number moves to the
target; nothing unflagged changes. Compare before/after screenshots at 100% and at zoom.
Three questions: is it quieter (fewer edges, weights, colours)? Is the primary focus as clear
or clearer under the squint? Would the owner recognise it as the same component? If not, you
redesigned it.

## Measurement snippets

All read-only except E, which adds and removes a zero-size probe. Replace the selectors.

**Ink rectangle** (shared helper: visible text plus replaced or graphic elements):

```js
function inkRect(el) {
  const rects = [];
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = w.currentNode; n; n = w.nextNode()) {
    if (n.nodeType === 3 && n.textContent.trim()) {
      if (n.parentElement.getBoundingClientRect().width <= 1) continue; // sr-only: clipped, invisible
      const r = document.createRange(); r.selectNodeContents(n); rects.push(...r.getClientRects());
    } else if (n.nodeType === 1 && n.matches('svg,img,input,video,canvas,[role=checkbox]')) {
      const cs = getComputedStyle(n);
      if (cs.visibility !== 'hidden' && cs.display !== 'none') rects.push(n.getBoundingClientRect());
    }
  }
  const v = rects.filter(r => r.width && r.height);
  if (!v.length) return null;
  return { left: Math.min(...v.map(r => r.left)), right: Math.max(...v.map(r => r.right)),
           top: Math.min(...v.map(r => r.top)), bottom: Math.max(...v.map(r => r.bottom)) };
}
```

For a bordered or filled control, compare its box; for a borderless one, its ink:

```js
const edged = el => { const s = getComputedStyle(el), bg = s.backgroundColor;
  return (parseFloat(s.borderLeftWidth) > 0 && !/rgba\(0, 0, 0, 0\)/.test(s.borderLeftColor)) ||
         (!/rgba\(0, 0, 0, 0\)/.test(bg) && bg !== getComputedStyle(el.parentElement).backgroundColor); };
const visible = el => { const c = el.querySelector('button,a,input:not([type=checkbox])');
  return c && edged(c) ? c.getBoundingClientRect() : inkRect(el); };
```

**A. Column header vs cell content**

```js
((tableSel = 'table', headSel = 'thead th', rowSel = 'tbody tr', cellSel = 'td') => {
  const t = document.querySelector(tableSel);
  const heads = [...t.querySelectorAll(headSel)], rows = [...t.querySelectorAll(rowSel)].slice(0, 8);
  return heads.map((th, i) => {
    const h = inkRect(th); if (!h) return { col: i, note: 'empty header' };
    const edge = /right|end/.test(getComputedStyle(th).textAlign) ? 'right' : 'left';
    const deltas = rows.map(r => { const c = r.querySelectorAll(cellSel)[i]; const k = c && visible(c);
      return k ? +(k[edge] - h[edge]).toFixed(1) : null; }).filter(d => d !== null);
    const spread = deltas.length ? Math.max(...deltas) - Math.min(...deltas) : 0;
    return { col: i, label: th.innerText.trim().slice(0, 20), edge, deltas, spread: +spread.toFixed(1),
             flag: deltas.some(d => Math.abs(d) > 1) || spread > 1 };
  });
})();
```

A delta means header and content sit on different lines; a spread means the cells disagree
(one row has a leading icon, another a padded button). For a centred control column,
compare centres instead.

**B. Fill band inside a rounded container**

```js
((panelSel, bandSel) => {
  const p = document.querySelector(panelSel), b = p.querySelector(bandSel);
  const pr = p.getBoundingClientRect(), br = b.getBoundingClientRect(), ps = getComputedStyle(p);
  const bw = parseFloat(ps.borderLeftWidth);
  return { panelRadius: ps.borderTopLeftRadius,
    inset: { left: +(br.left - pr.left - bw).toFixed(1), right: +(pr.right - br.right - bw).toFixed(1) },
    bandRadius: getComputedStyle(b.querySelector('th,td') || b).borderTopLeftRadius,
    clipped: ps.overflow !== 'visible' };
  // Pass: inset 0 on both sides and clipped (full-bleed), or equal non-zero insets with a
  // concentric radius (inset). Fail: 0 inset with rounded band ends, unequal insets.
})('section > div', 'thead tr');
```

**C. Nested radius**

```js
(sel => {
  const out = []; let el = document.querySelector(sel);
  while (el && el.parentElement) {
    const par = el.parentElement, a = getComputedStyle(el), b = getComputedStyle(par);
    const ri = parseFloat(a.borderTopLeftRadius), ro = parseFloat(b.borderTopLeftRadius);
    if (ro > 0 && ri > 0) {
      const gap = el.getBoundingClientRect().left - par.getBoundingClientRect().left - parseFloat(b.borderLeftWidth);
      const expected = Math.max(2, ro - gap);
      out.push({ inner: ri, outer: ro, gap: +gap.toFixed(1), expected: +expected.toFixed(1),
        flag: ri > ro || (gap <= 24 && Math.abs(ri - expected) > 2) });
    }
    el = par;
  }
  return out;
})('.innermost-rounded-thing');
```

DS radius tokens may round the formula to the nearest step; flag, then decide whether it is
the nearest token or a real defect. An established product recipe (`table-plate`) wins over
the formula.

**D. Text styles per level**

```js
(() => {
  const key = el => { const s = getComputedStyle(el); return `${s.fontSize}/${s.lineHeight} ${s.fontWeight} ${s.color}`; };
  const levels = {};
  document.querySelectorAll('main h1,main h2,main h3,main h4,main [role=heading]').forEach(h => {
    const lv = h.getAttribute('aria-level') || h.tagName; (levels[lv] ??= {})[key(h)] = (levels[lv]?.[key(h)] || 0) + 1;
  });
  const fake = [...document.querySelectorAll('main *')].filter(el => {
    if (el.closest('h1,h2,h3,h4,[role=heading],button,a,th,label')) return false;
    if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return false;
    const s = getComputedStyle(el); return +s.fontWeight >= 600 && el.innerText.length < 60;
  }).map(el => `${el.innerText.trim().slice(0, 30)} :: ${key(el)}`);
  return { levels, fakeHeadings: fake.slice(0, 20) };
})();
```

**E. Icon centre vs text**

```js
(rowSel => [...document.querySelectorAll(rowSel)].slice(0, 10).map(row => {
  const icon = row.querySelector('svg'); if (!icon) return null;
  const textEl = [...row.querySelectorAll('*')].find(e => !e.contains(icon) && !icon.contains(e) &&
    [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()));
  if (!textEl) return null;
  const probe = document.createElement('span');
  probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
  textEl.appendChild(probe); const baseline = probe.getBoundingClientRect().bottom; probe.remove();
  const ctx = document.createElement('canvas').getContext('2d'); ctx.font = getComputedStyle(textEl).font;
  const cap = ctx.measureText('H').actualBoundingBoxAscent;
  const ir = icon.getBoundingClientRect();
  return { text: textEl.innerText.trim().slice(0, 20), offset: +((ir.top + ir.height / 2) - (baseline - cap / 2)).toFixed(1) };
}).filter(Boolean))('li');
```

Positive means the icon sits low. More than 1px is visible at 14px. The same offset on every
row is one line-height or alignment cause: fix it once at the source.

**F. Spacing census**

```js
((rootSel, step = 4) => {
  const vals = {};
  document.querySelectorAll(`${rootSel}, ${rootSel} *`).forEach(el => {
    const s = getComputedStyle(el);
    ['paddingTop','paddingRight','paddingBottom','paddingLeft','rowGap','columnGap'].forEach(p => {
      const v = parseFloat(s[p]); if (v > 0) (vals[v] ??= []).push(p); });
  });
  return Object.entries(vals).map(([v, w]) => ({ v: +v, n: w.length, offScale: +v % step !== 0 })).sort((a, b) => a.v - b.v);
})('main');
```

**G. Overflow, clipping, poking out**

```js
(rootSel => {
  const issues = [];
  document.querySelectorAll(`${rootSel} *`).forEach(el => {
    const s = getComputedStyle(el), r = el.getBoundingClientRect(), p = el.parentElement;
    if (el.scrollWidth > el.clientWidth + 1 && s.textOverflow === 'ellipsis' && !el.title) issues.push(['truncated-no-title', el]);
    if (p && r.width) { const pr = p.getBoundingClientRect(); if (r.right > pr.right + 0.5 || r.left < pr.left - 0.5) issues.push(['pokes-out', el]); }
  });
  if (document.documentElement.scrollWidth > innerWidth) issues.push(['PAGE h-scroll', document.documentElement]);
  return issues.slice(0, 30).map(([k, el]) => `${k}: ${el.tagName}.${String(el.className).slice(0, 40)}`);
})('main');
```

## Writing up

Lead with a one-sentence verdict. Then findings grouped by screen region in reading order,
each one line plus evidence:

```
[P1] Documents panel: "File" label at x=951, filed-file icon ink at 964.
  Cause: ghost Button with a leading icon gets pl-3 from the DS.
  Fix (polish): px-0 and has-data-[icon=inline-start]:pl-0 on that button. No DOM change.
```

Grades: **P0** breaks the task or misleads (wrong fact, clipped control, no focus, page
scroll). **P1** visibly unconsidered at normal distance (broken hierarchy, misaligned
column, intersecting edges, double borders, layout shift). **P2** visible on inspection
(1–2px offset, off-ladder gap, non-concentric radius, redundant line). **P3** taste, the
owner's call. Use measured numbers and token names, never "a bit off". Name the broken
relationship (header ↔ cell, padding ↔ gap, outer ↔ inner radius).

Report three lists: implemented and verified (before → after numbers), found but not fixed
(grade and why: out of scope, needs the owner), and would not change (looks odd but is
deliberate or product-wide). A structural problem found during polish goes under
"Recommendation: needs your call". It is not built.

## Sources behind this skill (2026-11-11 research)

Vercel Web Interface Guidelines; Rauno Freiberg, interfaces.rauno.me; Linear, "Quality
Wednesdays" and the 2024/2026 redesign notes; Anthony Hobday, "Visual design rules you can
safely follow"; Jakub Krehel on concentric radius and optical alignment; Nikita Tonsky,
"Centering things"; Chrome `text-box` trim; Refactoring UI; Carbon data table and 2x grid;
Material data tables; GOV.UK table, forms and writing guidance; Primer DataTable, Button and
Banner; Atlassian button, lozenge, section message; Polaris cards and badges; Pencil &
Paper on enterprise tables; Matt Ström on tables and on critique vs review; NN/g on visual
hierarchy, proximity and required fields; Butterick's Practical Typography; Josh Comeau on
shadows; Lucide icon guide; WCAG 1.4.11.

