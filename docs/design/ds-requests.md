# Design-system requests

Open requests against
[pucardotorg/dristi-design-system](https://github.com/pucardotorg/dristi-design-system),
raised while designing Dristi screens.

**This file is a queue, not a licence.** Nothing here may be worked around locally: an
invented token, a hand-written primitive, or a per-screen override is a defect under the
DS gate (`.cursor/rules/pucar-design-system.mdc`), whatever the deadline. A request that
blocks a feature blocks the feature.

Each entry says what is missing, why the product hit it, and what would close it.

| # | Request | Raised by | Status |
|---|---|---|---|
| 1 | Token family for user-assigned categorical marks | [cases.md](proposals/cases.md) | open — **blocking** |
| 2 | `Badge` cannot hold a long localized label | [cases.md](proposals/cases.md) | open |
| 3 | Five shipped components have no registry guidance | [cases.md](proposals/cases.md) | open |
| 4 | No sanctioned sticky table header or row-density guidance | [cases.md](proposals/cases.md) | open |
| 5 | Panel fill equals page fill in both themes; raised shadow invisible in dark | [e-filing.md](proposals/e-filing.md) | open — **owner auditing** |
| 6 | No provenance / source-document panel | [e-filing.md](proposals/e-filing.md) | open — **owner auditing** |
| 7 | No rich-text editor | [e-filing.md](proposals/e-filing.md) | open — **owner auditing** |
| 8 | `DocumentSlot` cannot own a real upload row | [e-filing.md](proposals/e-filing.md) | open — **owner auditing** |
| 9 | `Alert` is always `role="alert"` — no quiet standing notice | [e-filing.md](proposals/e-filing.md) | open — **owner auditing** |
| 10 | `Sidebar`: no top offset, 32px nav, hover/selected share a token, hardcoded English chrome | [e-filing.md](proposals/e-filing.md) | open — **owner auditing** |
| 11 | No selected-on-track pair: `accent-strong` is 1.08:1 on `track` | [e-filing.md](proposals/e-filing.md) | open — **owner auditing** |
| 12 | `Banner` centres its icon on multi-line text | Join a Case polish (Oct 6) | open |
| 13 | `ACCESSIBILITY.md` §12 does not say whether an icon-marked search box in a filter row needs a visible label | Sign process (Oct 6) | open |
| 19 | Autofill rule squares every autofilled input (`border-radius: inherit`) | Pre-demo UI fixes (Oct 9) | open, patched in `chrome.css` |
| 20 | `InputGroup` control overlaps the group's 1px border | Pre-demo UI fixes (Oct 9) | open, patched in `chrome.css` |
| 21 | `ChartContainer` hides the keyboard focus ring on the chart surface | [court-dashboard-and-registers.md](features/court-dashboard-and-registers.md) | open |
| 23 | No motion foundation: no duration, easing or delay tokens, no motion budget | [feedback-states.md](features/feedback-states.md) | open |
| 24 | No status mark or feedback components (takeover header, inline status line, tally) | [feedback-states.md](features/feedback-states.md) | open |
| 25 | `Badge` has no leading-mark slot; a round mark is not concentric with the pill end | [feedback-states.md](features/feedback-states.md) | open |
| 26 | Toaster defaults: 4s, no click-away, `popover` toast vanishes on the dark page | [feedback-states.md](features/feedback-states.md) | open |

---

## 1. No token family for user-assigned categorical marks — blocking

A confirmed product requirement, not a speculative one: users create their own case tags
and choose a colour from provided defaults ([cases.md](proposals/cases.md)).

Tags are **categorical, not status**. Status is closed at exactly three treatments per
family (`AGENTS.md` rule 6), and `chart-1…5` is documented as "series identity only —
never status" and scoped to data visualisation. So there is no sanctioned home for a
user-chosen mark.

**Request:** a **`tag-1…5`** family aliasing the chart ramp — contrast-checked ≥3:1 as
non-text marks, defined in both `:root` and `.dark`, documented as "never status, never a
row fill, always paired with a name."

System-level rather than a one-off: any future case type or workspace feature will need
user labels.

**Until it exists, tags cannot ship.** A local hex, or a colour picker that emits one, is
a defect under rules 1 (never hardcode a colour), 4 (must exist in light and dark), and 9
(every pair computed, never asserted).

## 2. `Badge` cannot hold a long localized label

`badge.tsx` is `h-6` with `whitespace-nowrap`. One core deploys per state with local
languages over identical national law, and court languages make three-word §138 stage
names much longer — "Bail & recording of plea", "Proclamation & attachment" — with taller
glyphs (`foundations/typography`, `ACCESSIBILITY.md` §13). A non-wrapping fixed-height
chip overflows its cell, and truncating a critical label with no alternative is itself a
defect (a11y §10).

**Request:** either a wrapping / multi-line badge variant, or explicit guidance that long
localized status values render as text. Without one of the two, every screen invents its
own override — [cases.md](proposals/cases.md) D3 avoided that by rendering stage
as plain text.

## 3. Five shipped components have no registry guidance

`item`, `description-list`, `toggle-group`, `input-group`, and `marker` exist in
`src/components/ui/` but have no `componentRegistry` entry, so they carry no `whenToUse`,
usage notes, or do/don't — while [cases.md](proposals/cases.md) depends on all
five.

Per `AGENTS.md`'s own standard, "a component with no reviewed guidance is a component the
system has not actually decided on."

**Request:** registry entries for at least these five.

## 4. No sanctioned sticky table header or row-density guidance

`RESPONSIVE.md` calls a sticky header "optional in product layouts", which means every
product hand-rolls it. A 55-row docket wants one, and if users turn out to be professional
repeat users, it wants a density answer too.

**Request:** a documented `Table` behaviour for sticky headers, with a row-density note,
rather than five screens inventing five versions.

---

↑ Design guidance: [design-system.md](design-system.md) · Briefs:
[proposals/](proposals/)


---

## 5. Panel fill equals page fill in both themes; the raised shadow is invisible in dark

Measured on the running e-filing app (2026-08-17), computed values, both themes:

| pair | light | dark |
|---|---|---|
| `--card` vs `--background` | `#fcfcfd` vs `#fcfcfd` — **1.00:1** | `#111113` vs `#111113` — **1.00:1** |
| `--sidebar` vs `--background` | 1.03:1 | 1.07:1 |
| `--surface-sunken` vs `--card` | 1.07:1 | 1.13:1 |

A panel therefore never differs from the page by *fill*; it exists only through
`shadow-raised` plus a hairline. In light that works — the shadow carries it. **In dark
the shadow is `rgba(0,0,0,.3)`/`rgba(0,0,0,.4)` on `#111113`: invisible.** Nothing
separates panel from page but a 10 %-alpha hairline, so the page renders as one flat
sheet — and because `surface-sunken` (`#1d1e21`) is *lighter* than `card` (`#111113`),
a well reads as the most raised surface and the layering model inverts.

The light half of this is analysed at length in [ds-diagnosis.md](../design/ds-diagnosis.md);
the dark-mode consequence is new.

**Request (one of):**
- give `--card` its own value a step off `--background` in both themes (the ladder already
  has `neutral-2` at 1.03/1.07 and `surface-sunken` at 1.07/1.13), **or**
- define a dark-mode `shadow-raised` that reads on a near-black ground — a light-toned
  top edge (`inset 0 1px 0 rgb(255 255 255 / .04)`) plus a deeper ambient shadow, which is
  how most dark UIs express elevation, **or**
- both, and add a `Card variant="raised"` so the product stops expressing panels as a
  per-use `className` (this repeats request-adjacent note in `ui-craft` §6).

Until then every Dristi screen carries `PANEL_CLASS = "border-hairline shadow-raised"` by
hand and dark mode has no layering.

## 6. No provenance / source-document panel

The e-filing flow reads uploaded documents and pre-fills the form, so every machine-read
value needs an answer to "where did this come from?". Dristi ships `source-panel.tsx`:
a right-docked panel that **pushes** the form (not an overlay) above `xl` and degrades to
a `Sheet` below, showing the uploaded page with the extracted region highlighted and an
editable "value used in this field" box that clears the machine-read marker.

Nothing in the DS covers it, and it is not §138-specific — any intake that machine-reads a
document needs it.

**Request:** a `SourcePanel` (or `Provenance`) primitive owning the docked/sheet
behaviour, the highlight geometry (percentage box over an image), and the corrective
value field. Note the current local implementation masks the page with
`shadow-[0_0_0_9999px_var(--color-scrim)]` — it passes the token gate but is a hack a real
primitive should absorb.

## 7. No rich-text editor

Party-in-person affidavits and the prayer/relief blocks are formatted long-form text.
Dristi ships `rich-text-editor.tsx` on `document.execCommand`, which is deprecated.

**Request:** an editor primitive with `Textarea`-parity chrome (`border-input`, focus
ring), a toolbar of toggle controls at ≥40 px, DS type roles inside the content area, a
real placeholder (the local one is an absolutely-positioned `<span>`), and proper
`role="textbox"` semantics — wrapping a maintained editor core rather than `execCommand`.

## 8. `DocumentSlot` cannot own a real upload row

`DocumentSlot` models the states (empty · empty-optional · processing · filled ·
filled-poor) but not the row: it has no slot for a description, no row actions
(preview / re-upload / delete), no progress element, and no drop-target behaviour. Every
consumer therefore composes around it — Dristi renders the description as a separate
paragraph below the row and overlays an absolutely-positioned action cluster, which is
brittle and reads as two objects rather than one.

**Request:** `description`, `actions` and `progress` slots, plus a documented
drag-and-drop state (`data-dragging`) so the row can be a drop target without a fork.

## 9. `Alert` is always `role="alert"` — no quiet standing notice

`{DS}/src/components/ui/alert.tsx` hardcodes `role="alert"`. Dristi renders ~15 pieces of
standing guidance through it, so screen-reader users are interrupted assertively on mount
for text that is not an alert; one case nests a `role="alert"` inside a `role="status"`
container, which overrides an intentionally polite region.

**Request:** make the live semantics a prop — no role for standing guidance (the common
case), `status`/polite for async results, `alert` reserved for errors that interrupt.


## 10. `Sidebar` — four things a product shell cannot express

Raised while adopting the DS sidebar for the e-filing rail (which was previously a private
fork). Adoption was the right call — collapse persistence, ⌘B, roving focus, the mobile
sheet and `SidebarInset` all came for free — but four things had to be worked around or
accepted, and every product with an app bar will hit the same ones.

1. **No top-offset hook.** `sidebar-container` hardcodes `fixed inset-y-0 … h-svh` and
   `SidebarProvider` hardcodes `min-h-svh`. A shell with a global header must override both
   with inline styles (class overrides of `inset-y-0`/`h-svh` are cascade-order dependent).
   **Request:** a `--sidebar-top` variable alongside `--sidebar-width` / `--sidebar-width-icon`.

2. **Navigation rows are 32px, and 32×32 when collapsed — under the DS's own 40×40 floor**
   (`ACCESSIBILITY.md` §8). `size="lg"` is 48px, which is too tall for a 12-item rail. The
   collapsed size is forced with `!`, so it cannot be raised without a specificity fight.
   Dristi meets the floor by expanding the hit area (`after:-inset-1`) and widening the menu
   gap to `gap-2` so neighbouring targets meet without overlapping — the remedy
   `ACCESSIBILITY.md` prescribes, but every consumer will have to rediscover it.
   **Request:** a `default` size that meets the floor, or a documented `md` between 32 and 48.

3. **Hover and selected share one token.** `SidebarMenuButton` uses `hover:bg-sidebar-accent`
   *and* `data-active:bg-sidebar-accent`, so the current step is indistinguishable from a
   hovered one. `AGENTS.md` rule 10 reserves `accent-strong` for "pressed, engaged and
   selected", but there is no `sidebar-accent-strong` token, so no DS-legal local fix exists.
   Dristi falls back to a teal icon plus `data-active:font-medium`.
   **Request:** a `sidebar-accent-strong` token, bound to `data-active`.

4. **Hardcoded, untranslatable English chrome.** The mobile sheet's accessible name is
   `<SheetTitle>Sidebar</SheetTitle>` with description "Displays the mobile sidebar", and
   `SidebarTrigger`'s sr-only text is "Toggle Sidebar" — Title Case, against the sentence-case
   Law, and none of it is overridable through props. On a court product that must ship in
   Malayalam and Hindi (`ACCESSIBILITY.md` §13), the navigation dialog announces itself in
   English as "Sidebar" — which is also implementation jargon, not what the user sees.
   **Request:** props for the sheet title/description and the trigger's label.


## 11. No selected-on-track pair — `accent-strong` is invisible on `track`

`AGENTS.md` rule 10 names `accent-strong` as "the pressed, engaged and selected fill", and
`Toggle` uses it for `data-[state=on]`. That is correct on a page or card ground. It is not
usable on a **track**, which is where a segmented control lives:

| pair | measured |
|---|---|
| `accent-strong` `#e0e1e6` on `track` `#d9d9e0` | **1.08:1** |
| `accent` `#e8e8ec` on `track` (hover) | 1.15:1 |
| `background` `#fcfcfd` on `track` | 1.37:1 |

At 1.08:1 the selected segment is indistinguishable from the groove — the control reads as
one grey slab (owner, 2026-08-18: "the tokens of the toggle button have got fucked up").

The system already answers this elsewhere and disagrees with itself: **`Tabs` puts
`bg-track` on its list and styles the active trigger `data-active:bg-background` plus a
shadow** (`tabs.tsx:68`), i.e. a raised light chip, not `accent-strong`. Dristi's segmented
control now follows `Tabs` for that reason.

**Request:** either a named selected-on-track pair (`track-selected` / `track-selected-foreground`,
or simply blessing `background` + `shadow-raised` as the documented recipe), or a `Segmented`
primitive that owns it — so consumers do not have to discover the conflict by measuring.
A hover pair for the same ground is needed too: `accent` at 1.15:1 has the same problem.

---

## 12. `Select` opens over its own field by default

`SelectContent` defaults to `position="item-aligned"` (`select.tsx:63`), which pins the
open list so the selected row sits on top of the trigger. On a menu bar that is the
familiar macOS behaviour. In a form card it is not: the list covers the field's own label
and the field below it, and every screenshot of it reads as a rendering bug rather than an
open menu (owner, 2026-08-19: "the drop downs were glitching in a few places").

Dristi now passes `position="popper" align="start" sideOffset={4}` plus
`w-(--radix-select-trigger-width)` at its single wrapper (`inputs.tsx`, `OptionSelect`),
so a form menu opens under its control at the control's width.

**Request:** make `popper` the default for `SelectContent`, or ship the form recipe as a
documented variant. Every consumer putting a Select in a form will otherwise hit this and
fix it privately, and the fix is four props they have to know to write.

---

## 13. `Combobox` has no free-text mode

`Combobox` selects from `items`; there is no sanctioned way to keep a typed value that no
item matches. Several Dristi fields need exactly that — a police station or a bar
registration number is searched against a directory that is *usefully* incomplete, and
refusing an address because our copy of the station list is missing one is worse than
taking the person's word for it.

Dristi drives `inputValue` + `onInputValueChange` back into its own state to get this
(`inputs.tsx`, `ComboField`). It works, but it means the component is controlled two ways
at once and the semantics of "what is the value" live in the consumer.

**Request:** a `freeSolo` (or `allowCustomValue`) prop on `Combobox` that makes the typed
string the value when nothing matches, and lets `ComboboxEmpty` say so. Related: the DS
guidance for `Combobox` should name this case, since a searchable field over a registry is
the most common reason to reach for it in a government form.

---

## 14. No audio primitive — every feedback channel will compose its own

`src/components/ui/` has 68 components and none of them plays media: no `audio`, no
`media`, no `player`. The scrutiny return needs one, because a registry officer's remark
arrives as a voice note as often as it arrives as text
(`docs/product/domain/practice-notes.md`, `ke-scrutiny-officer-2026-07`), and any judge-,
party- or officer-feedback channel in a court product will want spoken context.

Dristi composes one at `components/scrutiny/voice-note.tsx`: `Attachment` as the row, a
`Button size="icon"` transport, `Slider` as the scrub track, `font-mono tabular-nums`
times, and a `Collapsible` transcript. It is deliberately not generalised.

The reason this should be decided once rather than per screen is the accessibility
contract around it, which is easy to get wrong and invisible when you do: WCAG 2.1 AA
**1.2.1** requires a text alternative for prerecorded audio-only content, so a voice note
may never be the sole carrier of a message and the component needs somewhere to put a
transcript; the transport must be keyboard-operable and ≥ 40×40; and progress cannot be
carried by colour alone.

**Request:** `Audio` / `AudioNote` — transport button, `Slider` track, `tabular-nums`
elapsed/duration, optional transcript disclosure, and the `idle | loading | error` states
`Attachment` already models. Until it lands, a second team will build a second audio row.

---

## 15. "Annotation over a document" is a pattern with two callers and no home

Dristi hand-rolls a highlight over an uploaded page twice now, with the same geometry and
two different authors of the box: the OCR read region (`filing/source-panel.tsx`,
`regionFromBox()`) and the scrutiny officer's mark (`scrutiny/annotation.tsx`, which
reuses that function rather than growing a second one).

The shape is stable — a pixel box plus the page dimensions it was measured in, mapped to
percentages so it survives any render width — and the decisions around it are not obvious:
the box is `aria-hidden` and the meaning lives in adjacent text, the image needs a real
alt naming *why* it is marked, and the enlarge control has to be a button rather than a
hover affordance.

**Request:** document the pattern (and ideally ship the mapping helper) before a third
caller appears. It does not need to be a component; it needs to be a decision.

---

## Stacked (multi-segment) progress bar

Raised: 2026-08-30, from the e-filing "File a case" screen (`BatchProgress` in
`components/filing/dashboard/bulk-import-card.tsx`).

`Progress` is single-valued. A batch of filings is not: its cases sit across registered /
in scrutiny / defect / not filed at once, and the useful picture is the proportions in one
bar. Composed here from a flex row of token-filled spans, with the bar `aria-hidden` and a
legend carrying every count as text, so colour never carries the meaning alone.

**Request:** a `Progress` variant (or a `SegmentedProgress`) that takes ordered segments
with a value and a semantic token each, and owns the accessible summary. Three things are
easy to get wrong per-composition and worth deciding once: rounding when segments do not
sum to the total, the minimum visible width of a non-zero segment, and whether the
remainder renders as `track` or as an explicit segment.

---

## Circular progress — a ring for "how much of this is done"

Raised: 2026-09-09, from the File a case queue's Drafts tab
(`components/filing/dashboard/completion-ring.tsx`).

`Progress` is a linear bar. A table cell wants the same fact at 20px beside a number —
"62% complete" with a ring that reads at a glance, the way a mail client shows setup
progress — and a 1px-tall bar in a cell is invisible. Composed locally as a two-circle
SVG drawn only in tokens (`stroke-track` for the groove, `stroke-primary` for the fill),
`aria-hidden` because the number beside it is the value. It is a screen-level file, not a
primitive, and it is the one custom drawing in this round.

**Request:** a `Progress` variant (`shape="ring"` / `size`) or a `ProgressRing` primitive
that owns the geometry, the stroke tokens, the reduced-motion rule for the fill
transition, and the accessible summary — so the app's ring and any future one come from
one place. Delete `completion-ring.tsx` when it lands.

---

## `Card` clips its children, so a panel cannot hold sticky content

Raised: 2026-08-30, from the e-filing "File a case" work queue
(`components/filing/dashboard/filings-queue.tsx`).

The `Card` master carries `overflow-hidden`. A clipping ancestor makes `position: sticky`
inert for every descendant, so a panel cannot keep its own header, tab strip or table
head pinned while its content scrolls — a normal pattern for any long list inside a card.
Worked around here with `overflow-visible` on the one Card, which gives up the corner
clip the master was buying.

**Request:** either drop `overflow-hidden` from the master (rounding already clips
backgrounds; it is mainly there for images bleeding to the edge) or add a variant that
opts out, so composition does not have to fight the primitive to pin a header.

---

## 16. `BreadcrumbLink` ships no focus indicator

`src/components/ui/breadcrumb.tsx` gives its link `transition-colors
hover:text-foreground` and nothing for focus — no `focus-visible:` rule of any kind. It is
the only interactive primitive in the system without one.

Nothing was stripped, so no gate catches it, and it is invisible with a mouse. What a
keyboard user gets is whatever the browser draws by default, recoloured by the blanket
`* { … outline-ring/50 }` in the app's `globals.css`: a colour, with no `outline-style`
and no `outline-width` behind it. At 50% over `card` that colour is roughly **2.1:1**,
under the 3:1 that `ACCESSIBILITY.md` §6 and WCAG 2.1 **1.4.11** ask of a focus
indicator — and the width and style are the browser's opinion rather than the system's,
so it differs per engine.

Every other control settles both: `Badge` uses `focus-visible:border-ring
focus-visible:ring-3 focus-visible:ring-focus-ring`, `TabsTrigger` adds
`focus-visible:outline-1 focus-visible:outline-ring` for the same reason a crumb needs
it — there is no border of its own to tint.

Dristi hits this in the court's top bar, where the trail is the only route back to the
area's origin, on fifteen screens (`components/employee/employee-top-bar.tsx`,
`CRUMB_LINK`). The composition there is the two DS recipes above put together, applied
through `className` rather than into the primitive — a synced file loses local edits at
the next `sync:ui` and fails `check:ui-sync` in the meantime.

**Request:** put the focus recipe on `BreadcrumbLink` itself —
`focus-visible:ring-3 focus-visible:ring-focus-ring focus-visible:outline-1
focus-visible:outline-ring`, with a corner for the ring to follow. It is one line in one
primitive, and it is currently owed by every caller that renders a crumb. Worth checking
the same question of the other text-only links in the registry while the file is open.

---

## 17. `Sidebar`'s mobile branch drops `className` and `style` — and its own width

`Sidebar` renders three ways. Two of them apply what the caller passed; the mobile one
applies neither, and it fails by three routes that have to be fixed together.

**`className` is dropped by the signature, not by a spread.** It is destructured at
`sidebar.tsx:155` and the `isMobile` branch (`181–205`) never mentions it again. Nothing
forwards it and nothing warns.

**`style` is spread onto a component that renders no DOM.** `{...props}` — which is where
`style` ends up — goes to `<Sheet>` at `sidebar.tsx:183`. `Sheet` is
`SheetPrimitive.Root` (`sheet.tsx:10`), which is Radix `Dialog.Root`: a context provider
with no host element. It forwards nothing. React says nothing either, because an unknown
prop on a *component* is a legal prop; the warning it would give on a host element never
fires. The desktop branch puts both on `sidebar-container` (`231–239`) and works, so the
two paths disagree silently.

**There is no second chance, because `SheetContent` is handed literals.** `className` at
`sidebar.tsx:189` and `style` at `190–194` are written inline, so even a caller who found
another way in would be overwritten.

**And the width it does set never applies.** `SheetContent` writes its own width as
`data-[side=left]:w-3/4` with a `sm:max-w-sm` cap. The mobile branch's
`w-(--sidebar-width)` carries no modifier, so tailwind-merge keeps both — different
modifier, different key — and the cascade then settles it the other way: `.class[attr]`
is (0,2,0) against a bare `.class` at (0,1,0). Measured in Dristi's served stylesheet.
So `SIDEBAR_WIDTH_MOBILE` is declared, is correct, and does nothing: the DS's off-canvas
rail is 75% of the viewport capped at 24rem, which on a 320px phone is 240px. This one is
independent of the two above — fixing the forwarding alone will not surface it.

**What it costs a consumer.** Dristi paints its rails on a plate — a set of custom
properties for the ground, seam, ink, hover and ring, held constant under the app's dark
mode. The plate is exactly `className` plus `style`, so below `md` the whole thing lands
on nothing: the charcoal rail comes back in the app's default light ink, seams and all.
That is not a themeable rail failing to theme; it is a rail that looks broken on a phone.

So `components/chrome/app-chrome.tsx` never lets the DS choose the mobile branch. It
renders `collapsible="none"` at every width, hand-builds the desktop fold that mode does
not provide (`group` + `data-collapsible` on the container, a width the variant
overrides), and owns a private `ChromeRailSheet` for phones — including a second copy of
the 18rem the DS already named, applied with the side modifier so it survives the same
cascade the DS loses.

That composition is legal — a public mode used to its documented contract, no DS source
copied — but **the workaround has no exit.** Fix this upstream and every Dristi gate stays
green, the screens keep working, and nothing tells the next author that
`ChromeRailSheet` has become a private fork that no longer receives sheet improvements
and no longer needs to exist. This file's own preamble says nothing may be worked around
locally; that rule is currently owed on this entry, which is why it is filed rather than
left as a comment in the frame. Request 10 raises four `Sidebar` problems and none of them
is this one.

**Request:** in the `isMobile` branch —

- move `{...props}` off `Sheet` and onto `SheetContent`, where a host element receives it;
- merge rather than replace: `className={cn("bg-sidebar p-0 text-sidebar-foreground
  [&>button]:hidden", className)}` and `style={{ "--sidebar-width": SIDEBAR_WIDTH_MOBILE,
  ...style }}`;
- give the width a modifier that can win — `data-[side=left]:w-(--sidebar-width)` and its
  right-hand twin — or stop `SheetContent` scoping width by side at all, which would fix
  it for every sheet in the system rather than for this caller.

The pay-off is larger than the diff. With it, both Dristi areas drop to a plain
`collapsible="icon"` `Sidebar` and most of `ChromeRail`'s fold machinery — the hand-set
`data-collapsible`, the width override, the private sheet — is deleted rather than
maintained. Worth checking the same question of any other primitive that branches on
`isMobile` and re-enters through a portal: the failure is invisible in React, in the class
list, and in every gate.

---

## 18. `Button` gives `aria-disabled` no treatment at all

`buttonVariants` hangs its unavailable look off the DOM property — `disabled:pointer-events-none
disabled:opacity-50` (`button.tsx`). Nothing keys off `[aria-disabled]`.

That leaves no way to render the state the product actually has. A control that is
*present but not yet connected* has to stay focusable and hoverable, because the only
thing explaining why it is inert is a `Tooltip` — and `ACCESSIBILITY.md` §7 forbids
putting the sole explanation behind hover, so keyboard users must reach it too. Real
`disabled` removes the button from the tab order and, with `pointer-events-none`, kills
the hover that opens the tooltip. So `aria-disabled` is the correct attribute, and the DS
dresses it as a fully live button: full-strength `bg-primary`, a working
`hover:bg-primary-hover`, and the `active:not-aria-[haspopup]:translate-y-px` press. It
lights up, goes down under the finger, and does nothing.

Two court-side screens are on it today, both deliberately unwired pending a court-side
case file: **View case** (`employee/hearing-overview-screen.tsx`) and **Join VC**
(`employee/hearings-screen.tsx`). It got worse when View case moved into a pinned action
band, where the surrounding pattern means *the act on this page lives here* — a
full-strength primary that depresses and does nothing is a promise the control cannot
keep.

Dristi patches it at one call site with three utilities —
`aria-disabled:opacity-50 aria-disabled:hover:bg-primary aria-disabled:active:translate-y-0`
— which is a per-screen override of a state the system should own, and it has to be
rewritten per variant, since the hover fill to cancel differs for every one of the ten.

**Request:** put an `aria-disabled` treatment in the `buttonVariants` base and per-variant
hover, mirroring the `:disabled` look (`opacity-50`) and cancelling the hover fill and the
press translate. Explicitly **not** `pointer-events-none` on this branch — the tooltip is
the entire reason the control is `aria-disabled` rather than `disabled`, so the pointer
must keep reaching it. A documented name for the state would help as much as the CSS: the
distinction between "you may not" (`disabled`) and "this is not connected yet"
(`aria-disabled` + explanation) is a real one, and right now every consumer meets it by
discovering that nothing happened.

---

## Input has no compact size (`size="sm"`)

**Observed (pin e0cadea6):** `SelectTrigger` and `Button` both offer `size="sm"` at 36px
(`h-9`), but `Input` and `InputGroup` are fixed at `h-10`. A register toolbar that sets
compact filters beside a search field cannot match their heights from the primitives.

**Consequence:** the View Case registers (Applications, Documents) set `h-9` on the search
`Input` once, in `components/cases/register-controls.tsx`, returning to `h-10` below `sm:`
for the 40px touch floor. That is a local height on a synced primitive.

**Request:** add `size?: "sm" | "default"` to `Input` (and `InputGroup`) mirroring
`SelectTrigger`, so a compact toolbar composes from the primitives alone.

---

## 12. `Banner` centres its icon on multi-line text

`Banner` lays its icon and text out with `items-center`, so on any note that wraps the
icon floats beside the middle of the paragraph instead of its first line. The owner
flagged it on the Join a Case dialogs (Oct 6): "the icon should be top aligned with the
copy". It affects every multi-line banner in the product, not one screen.

**Interim:** the join dialogs pass `className="items-start"` through the Banner's own
`className` prop (no change to its internals). Measured: icon centre within 1.5px of the
first line's centre at the banner's 14px / `leading-snug` text.

**Request:** make the root `items-start` and nudge the icon onto the first line's centre
(as `Alert` does with `translate-y-0.5`), so a single-line banner is unchanged and a
wrapped one reads from its first line. Once shipped, drop the interim class.

## 13. Visible label on an icon-marked search box

§12 says every field has "a visible label (or equivalent permanent text)" and "never
placeholder-only". It doesn't say whether a search box carrying the DS magnifier icon,
with its label kept for screen readers, meets that. WCAG 2.1 AA doesn't require a visible
label there: the accessible name (SC 4.1.2) plus a persistent visual cue satisfies SC 3.3.2.

The product already relies on that reading in two places: the advocate pending-tasks search
(aria-label only) and, from Oct 6, the court sign process filter row (`CourtFilters`
`labelHidden`, label `sr-only`). The owner chose it because a label over the box pushed the
whole pill row down around it.

**Request:** state the rule in §12. Either (a) an icon-marked search box, or a select whose
value names its subject ("All process types"), may keep its label for screen readers only,
or (b) it may not. Under (b), both screens need a visible label again.


## 19. The autofill rule squares every autofilled input

`globals.css` neutralises the browser's autofill tint with an opaque inset shadow and
`border-radius: inherit`. That rule is unlayered, so it beats the field's `rounded-lg`
utility, and an autofilled field takes its parent's radius, usually 0. Measured on a
plain `Input`: 10px, then 0px once autofilled. Every autofilled field in the product
turned square (owner, Oct 9: Full name in registration). The paint also uses
`--background`, while a dark-mode field is `input/30` over the page, so an autofilled
field reads darker than its neighbours.

Closes when the rule drops `border-radius: inherit` and paints the field's own fill.
Until then `apps/dristi-app/src/app/chrome.css` sets `border-radius: revert-layer` and a
dark-mode paint. The owner asked for this to be noted and kept for now.

## 20. `InputGroup`'s control overlaps the group's border

`InputGroupInput` keeps `Input`'s `h-10` inside an `InputGroup` that is also `h-10` with
a 1px border, so the control covers the border by 1px top and bottom. That is invisible
until something paints the control. Autofill did, and the group lost its top, bottom and
corners wherever the control ran: mobile number beside +91, password beside its eye and
confirm password beside its tick.

Closes when the group control is inset inside the group's border (`h-full`, or the group
clips its content). Until then `chrome.css` clips an autofilled group with
`overflow: hidden` and paints the control in the group's fill.

## 21. `ChartContainer` hides the keyboard focus ring on the chart surface

`chart.tsx` sets `[&_.recharts-surface]:outline-hidden` (and the same on
`.recharts-layer` and `.recharts-sector`). Recharts makes the chart surface focusable and
moves its tooltip with the arrow keys, so a keyboard user can tab into a chart and get no
visible focus indicator: only the tooltip moving shows where focus is. That fails the
DS's own visible-focus requirement in `ACCESSIBILITY.md`.

Raised by the court dashboard's "Judgements each month" and "Time between hearings" bar
charts (`/employee`, 2026-10-11). The primitive is synced unedited, so the app cannot add
the ring without overriding a synced primitive.

Closes when the container keeps `outline-hidden` for pointer focus but shows the DS focus
ring on `:focus-visible` for the chart surface.

## 22. `DateRangePicker` cannot limit the days a person may pick

`date-picker.tsx` passes nothing through to `Calendar` but `mode`, `selected`,
`onSelect` and `numberOfMonths`, so a screen cannot disable days outside the range its
data covers. The court dashboard's custom period (`/employee`, 2026-10-19) offers every
future day and every day before the court's first record. The screen clamps a chosen
range to the records afterwards, so the numbers stay right, but the calendar still
invites a pick that will be quietly changed.

Closes when `DateRangePicker` (and `DatePicker`) accept a `disabled` matcher, or a
`startMonth`/`endMonth` pair, and pass it to `Calendar`.

## 23. No motion foundation

The DS has foundations for colour, type, spacing, radius and elevation, but none for
motion: no duration, easing or delay tokens, and no rule for how much a thing may move
at a given size. Every flow invents its own (`RESOLVE_IN_PLACE`, `OVERLAY_RISE`, local
`duration-500`). The feedback-states work (2026-10-29) needed a full set and a budget:
heroes play a mark about 600ms, small marks pop in about 250ms and scale their glyph,
states move only when they change, and one animated mark per view.

Closes with a Motion foundations page and tokens, taken from
[feedback-states.md](features/feedback-states.md), including reduced-motion behaviour.

## 24. No status mark or feedback components

Success, failure and warning are expressed in 23 different ways across the product
(board: `/success-board` on `feature/states-board`). Six dialogs copy the same
tinted-disc header by hand. The DS offers `Banner`, `Alert` and `Badge`, but no mark,
no outcome header, no inline status line and no partial-result tally.

Closes when the DS ships a status mark in six tones, a takeover header, an inline
status line, a field-error entrance and a tally. It must also deprecate the old
patterns with "use instead" notes.

## 25. `Badge` has no leading-mark slot

`Badge` is 24px tall with 8px start padding and a 1px border. A 16px round mark
inside it sits 4px from the top and bottom but 9px from the end, so it is not
concentric with the pill's curve. The board corrects it per use with `pl-[3px]`.

Closes when `Badge` takes a leading mark that sets its own inset to match the vertical
inset.

## 26. Toaster defaults do not fit the feedback system

Sonner's 4s life, its lack of a click-away dismissal and the `popover` fill are product
choices that now differ. The lead designer asked for 2.75s and dismissal on any click,
and error toasts must persist. In dark mode `popover` equals the page colour, so the
toast disappears. `AppToaster` can carry these as app settings.

Closes when the DS toaster recipe documents the duration, click-away, error persistence
and a raised dark surface, or exposes them as variants.

