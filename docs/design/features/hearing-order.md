# Hearing order
Updated: 2026-10-13
Status: implemented — A/B versions, render-checked

## Current outcome

**2026-10-12 — two composers, A/B tested, one catalogue.** Court settings → *Order screen*
switches between them (`lib/employee/order-layout.ts`); both serve the hearing route and
the cognizance route, and each keeps its own draft.

- **A: Blocks** (`components/employee/order-composer.tsx`). Abhirami's v14 screen around
  the order: header with the case name, facts, **Case file** toggle and **Next case**; a
  **This order** index on the left with one "to fill" count; the order as one page; the
  case file on the right (Documents with linking, Overview). The order itself is Varun's
  blocks: every piece is a framed block — text, or an order item with its **fields on top
  and its text below** — with Move up / Move down / Remove, and the type chosen from
  Abhirami's searchable picker (Text, Likely at this hearing, categories, unavailable
  items with the reason). Fields and text are loosely coupled
  (`lib/employee/order-composer.ts`): the text follows the fields until typed into, then
  is the drafter's ("Edited by hand…", **Reset wording**). Attendance and Next hearing
  appear on any order tied to a hearing; the cognizance (outside-a-hearing) order has
  neither and schedules through its item.
- **B: Text box** (`components/employee/order-text-composer.tsx`). Today's screen,
  tightened (16px gaps), with Applications, Attendance, **Items** and Next hearing in the
  left column and the right side one large rich-text box. Choosing an item asks for its
  fields in a dialog before its sentence is written in; the pencil rewrites it in place.
- **Catalogue** brought in line with `dristi-be/PRDs/order-template-catalogue.md`
  (2026-10-06 (17)): 26 order items with per-variable input types, defaults and
  combination restrictions (`lib/employee/order-templates.ts`); process channels and
  pre-selection per `process-handover.md` (`lib/employee/process-variables.ts`).
- Footer unchanged in meaning and shared by both: Saved, Preview (Sign now inside),
  Add to signing list — now held back until nothing is left to fill (`SGN-04`), with
  **Move back to draft** once added (`SGN-05`).

### Before 2026-10-12

The listing header’s matter facts (Item, Case, Stage, Today for) are one size:
`text-body-compact` (14/20). Labels stay muted and medium; values stay foreground,
with lining figures on the serial and case number. The composed region on the
order sheet is ruled at the top only; the hairline under the editor is gone. The
sheet title (`ORDER`) is left-aligned with the card content.

**The footer now carries three things, not one** (owner, 2026-09-26): a Saved
indicator, **Preview**, and the primary **Add to signing list**. Preview opens
the order as paper in the same read-then-sign overlay the four signing queues
already share (`sign-method-stage.tsx`), with **Sign now** advancing to the
signature choice from there — so a bench can still sign immediately without
first adding to the list. Add to signing list is the lighter, dialog-free act;
either path settles the footer's own state (draft → added / signed) and the
button relabels itself accordingly. The identical three additions were made to
the cognizance composite (`cognizance-order-screen.tsx`), which had no
read-then-sign overlay before this and now shares the same one.

**View Case now opens the case file in place on the cognizance composite too**
(2026-09-27), matching the hearing composer's own toggle exactly — the same
right-column swap, the same `OrderCaseFile` component, reused with no new
props (it already reads a fixed case-file tree, not anything hearing-specific,
so cognizance needed no data plumbing to adopt it). Before this, the header's
only button was labelled "View case" but actually navigated away to the
complaint's own page (`subjectReturn`'s `back.href`) — the label of one act on
the behaviour of a different one, which is what read as broken (owner,
2026-09-27: "not coming up on the right side like it does when I go from the
hearing"). Both acts now exist as two buttons, each under its own name: **View
Case** (the toggle) and **Back to the complaint** (`back.label`, previously
hardcoded as "View case").

Built in `apps/dristi-app/src/components/employee/order-screen.tsx` and
`cognizance-order-screen.tsx`, sharing `order-draft-facsimile.tsx` (the paper
render) and `order-save-indicator.tsx` (the Saved indicator) between them.
The longer sitting-panel history remains in `docs/design/proposals/hearing-order.md`.

### Adding a workflow that opens the order screen

Every way into the order screen is one door description (`OrderDoor`) drawn by one
screen ([`order-door-screen.tsx`](../../../apps/dristi-app/src/components/employee/order-door-screen.tsx)),
which picks A, B or C and adapts the opening draft for each
([`lib/employee/order-door.ts`](../../../apps/dristi-app/src/lib/employee/order-door.ts)).
A new workflow writes three things:

1. **A preset** in `lib/employee/` returning `{ blocks, fixedIds }` — the order items it
   opens with and which cannot be removed (pattern: `cognizanceComposition` in
   [`cognizance-order.ts`](../../../apps/dristi-app/src/lib/employee/cognizance-order.ts)).
2. **A door builder** — a hook returning an `OrderDoor`: draft key, heading, facts,
   notice, the way back, context and the preset as `initial` / `fixedIds`. Leave out
   `hearing` for an order outside a hearing. Pattern: `useCognizanceOrderDoor` in
   [`cognizance-order-screen.tsx`](../../../apps/dristi-app/src/components/employee/cognizance-order-screen.tsx).
3. **A route page** that looks the subject up and renders
   `<OrderDoorScreen door={door} />`.

## Decisions

Date | Decision and reason | Source/person | Status
---|---|---|---
2026-10-13 | The hearing and cognizance doors onto the order screen are **one door description + one screen** (`OrderDoor`, `OrderDoorScreen`); all per-variant adaptation (B's opening text, C leaving out decision blocks, each variant's own draft key) is in `lib/employee/order-door.ts`. The cognizance door gains **C**, which previously fell back to A: no attendance, applications or Next hearing, the act's items preloaded, fixed items not removable, the act's outcome under the title. B on a hearing keeps its own nav label (*Next hearing*, no chevron) as it shipped. | owner (chat) | implemented |
2026-10-12 | A process item's **Addresses** are every destination on the person's record — postal addresses, mobile numbers and email addresses, each of which may be several — grouped by kind, each ticked on its own, all pre-selected. Each channel goes to the ticked destinations of its kind (SMS → mobiles, Email → emails, RPAD/e-Post/police → postal addresses), one process each; a channel with none of its kind ticked is noted. `case-people.ts` records now hold several mobiles and emails. | owner (chat) | implemented |
2026-10-12 | Rebased onto `main` (the `design` branch is retired). The composer now reads the people on a case from main's `case-people.ts` (people with roles, addresses, mobiles, emails, witnesses) and its police-station master, replacing this branch's stand-in people and Kollam station list; channels follow the deployment (Police (NSTEP)); a channel the person has no destination for is noted beside the channels (`PRC-05`). Hearing and complaint data, and the paper, are voiced for the court chosen in settings (main's court switch). Supersedes main's multi-recipient issue-process pop-up with the one-person model above. | owner (chat) | implemented |
2026-10-12 | **One police station per address**, not one per order item: on a police channel each address is its own process (§3, `PRC-05`), served through the station that covers it, so each selected address gets its own station dropdown, filled from that address (`AUT-04`) and changeable on its own. Corrects the previous build, which filled one station from the first address. | owner (chat) | implemented |
2026-10-12 | Master-data variables are never typed: document type, mode of ADR, notice type and process type are dropdowns over stand-in lists (`DUMMY_MASTERS` in `order-templates.ts`) until the real masters arrive. Document details stays free text, as the catalogue specifies. | owner (chat) | implemented |
2026-10-12 | Process order items reworked to the owner's model: **one person**, then **some or all of that person's addresses** (all pre-selected, `AUT-07`), then **the channels**; the police station follows the first selected address. Several people means several order items (`ITM-06`). Departs from `AUT-09` ("several recipients may be selected at once"), which the process handover should be updated to match. Fixture people gain addresses on record (residence; the accused also a place of business). | owner (chat) | implemented |
2026-10-12 | Catalogue compliance audit, item by item against `order-template-catalogue.md` 2026-10-06 (17): all 26 names, availabilities, categories, templates and variables match. Fixed: six workflow lines now verbatim; *Scheduling of hearing date* no longer pre-fills a purpose on the cognizance order (the catalogue gives it no default), superseding the act's earlier default purpose. | owner (chat) | implemented |
2026-10-12 | Version B's item search opens its dropdown on click or focus (Likely at this hearing first, then the catalogue), not only once typing starts. Police station becomes a dropdown over a stand-in Kollam station list (`POLICE_STATIONS`, standing in for the `PRC-08` master), pre-filled from the recipient's address (`AUT-04`) and kept if the drafter changes it. Both versions. | owner (chat) | implemented |
2026-10-12 | Version B's left column reordered: Attendance, Next hearing, Applications, Items. Items no longer lists the catalogue: it shows only Likely at this hearing, and typing turns the field into a searchable dropdown (flips upward near the footer). One-line descriptions removed from the catalogue rows in both versions; an unavailable item still shows its reason. Both versions gain Abhirami's **Drafting / Preview order** switch at the head of the order page. | owner (chat) | implemented |
2026-10-12 | Order composer rebuilt as two versions for A/B testing. A: Abhirami's v14 layout (header, This order index, case file panel) with Varun's block shape (fields on top, text below, loosely coupled; move up/down/remove; no block title). B: the existing text-box screen with tighter spacing, Attendance and Next hearing moved to the left, right side one large text box, catalogue renamed "Items". Toggle in Court settings. **Supersedes 2026-09-15 "one body of text, not a list of boxes"** for version A only. | owner (chat) | implemented |
2026-10-12 | Attendance and Next hearing appear on any order tied to a hearing (before, during or after it); outside a hearing (cognizance) they are absent and the next date is set by *Scheduling of hearing date*. The cognizance composite moves onto the same composer. | owner (chat) | implemented |
2026-10-12 | Use the actual catalogue: `order-template-catalogue.md` status 2026-10-06 (17), 26 items with variables, input types, defaults and combination restrictions. | owner (chat) | implemented |
2026-09-26 | Footer primary renamed again, from "Send to sign order" to **"Add to signing list"**. Owner: the old name "sounded so bad" — it read as an order already handed off somewhere, when the act is only marking the draft ready. Reverses D-2026-09-15's rename below rather than erasing it — see that row. | owner (chat) | implemented |
2026-09-26 | Add a Saved indicator to the footer, "similar to what we have done in the e-filing screen" (`components/filing/saving-indicator.tsx`). Built as a plain, always-"Saved" status rather than a copy of the filing indicator's Saving/Saved/error states: an order draft writes synchronously into `order-drafts.ts` (or the cognizance screen's own local state), so there is never an in-flight "Saving…" interval the way there is for filing's asynchronous IndexedDB write. Recorded gap: this is honest about surviving navigation within the sitting, not about surviving a reload — neither composer's draft does, before or after this change. | owner (chat) | implemented, scope note above |
2026-09-26 | Add a **Preview** button that shows the order and offers to sign it immediately. Built by adopting the four signing queues' own shared "read the paper, then choose how to sign" overlay (`SIGN_STAGES`/`SIGN_SCENES`/`SignatureStage` in `sign-method-stage.tsx`) instead of inventing a second one — the hearing composer's signature overlay was one stage before this because there was nothing separate to read (D-2026-09-15 below); Preview is exactly that separate thing. The cognizance composite had no signature-choice stage at all before this and gained the identical overlay for parity. | owner (chat) | implemented |
2026-09-27 | The cognizance composite's header gains the hearing composer's **View Case** toggle (`OrderCaseFile`, in place on the right), and the pre-existing navigate-away button is relabelled to what it already computed (`back.label`, "Back to the complaint") instead of the hardcoded "View case" it wore. Owner flagged the old single button as broken: it was named for the toggle and behaved as the navigate-away link. | owner (chat) | implemented |
2026-09-16 | Order-sheet title left-aligned. Owner on the live `h2#order-paper`: centred `ORDER` sat in the middle of the card; it should start with the rest of the sheet. Dropped `text-center` so the heading uses the default start alignment. | owner (live UI) | verified
2026-09-15 | Composed region keeps the top hairline and drops the bottom one. Owner on the live sheet: with next hearing beside attendance, nothing sits under the writing, so the lower divider was leftover decoration. The editor’s own border still closes the writable region. | owner (live UI) | implemented
2026-09-15 | Footer primary renamed from “Sign order” to “Send to sign order”. Owner on the live CTA. Matches D10: this screen records a signature choice and does not sign. The Add signature overlay and the Sign orders queue keep their names. **Superseded 2026-09-26 — see above.** | owner (live UI) | superseded
2026-09-15 | Matter-facts labels leave `text-caption` (12px) for `text-body-compact` (14px). Owner asked for the whole row at 14px; values were already that size. Hierarchy stays in colour and weight, not a second size. D58’s caption labels remain the panel rule. | owner (live UI) | implemented

## Changes and tradeoffs

Caption is the DS metadata role. The owner judged 12px too small under the 24px
page title for facts a typist needs before they can set anything down. Rejected:
keeping caption on labels only — that was the 12px the report named.

The composed region used matching hairlines above and below the editor while
next hearing still sat under the writing. With that block now beside attendance,
the lower rule was a leftover divider over empty card. Rejected: keeping both
rules as the reference drew them.

**Add to signing list does not write into the real Sign-orders queue**
(`lib/employee/sign-orders.ts`'s `SIGN_ORDER_QUEUE`), which is a static fixture
read by a separate screen, not a live store. Making this button actually queue
the order there would mean turning that fixture into a mutable, subscribable
store — a materially bigger change than a footer button, and not something this
request asked for. What is built instead matches this codebase's existing
"nothing is issued from this screen" honesty elsewhere: the footer's own state
(draft/added/signed) is local to the composer and says only what happened here.
Rejected: silently wiring the button into the fixture array, which would have
made the "signing list" claim true in this screen and meaningless in that one.

**Preview reuses `buildOrderDocument` / a hand-built equivalent, not a new
document type.** The hearing composer already had `OrderDocument`
(`order-draft.ts`) for the paper on the page; the cognizance composite had
nothing equivalent, since a complaint carries no attendance or applications.
Rather than give cognizance a full `OrderDocument`, `order-draft-facsimile.tsx`
takes the narrower structural shape both screens can actually supply (court,
case number, cause, title, one body passage, dated, signature) — the same
"read only what both have" reasoning `order-subject.ts` already uses for
everything else these two screens share.

## Verification and open work

`npm run verify:ui` passed on this checkout (DS pin e0cadea6b9d4) after the
title alignment change. On `/employee/hearings/h-241/order` (this checkout,
owner server), `#order-paper` computed `text-align: start` with 0px offset
from the card content inset: desktop light (~1433px), 375px light, and a
synthetic dark class. Desktop light render shows `ORDER` flush left with
Attendance / Next hearing.

Earlier (2026-09-15): matter facts were measured 14px; footer CTA reads
“Send to sign order” (153×40 desktop, 327×40 at 375px); composed-region
hairline `border-top` 1px, `border-bottom` 0px. Those checks were not
re-run for this alignment-only change.

**2026-09-26.** `npm test` (1049 tests), `npm run lint` (tokens, typography,
ui-sync, spacing, table-rows) and `npm run check:rails` all pass on this
checkout. Verified live against the owner's running dev server on both
`/employee/hearings/h-241/order` and `/employee/cognizance/c-2041/order`: the
footer now reads Saved · Preview · Add to signing list; Preview opens the
order as paper with Sign now disabled while blockers stand and enabled once
they clear; Sign now → Add signature → Submit closes the overlay, returns
focus to Preview, and relabels the primary button to Signed on both screens.
At 375px the footer stacks Saved above a full-width Preview above a full-width
primary, each an independent row rather than wrapping into each other. Not
verified: dark mode (not toggled live this pass).

**2026-09-27.** `npm test` (1054 tests), `npm run lint` and `npx tsc --noEmit`
pass on this checkout. Verified live on `/employee/cognizance/c-2041/order`:
View Case opens `OrderCaseFile` in the right column with the catalogue and
"In this order" list untouched on the left, relabels to "Back to order",
toggling back restores the order article with every field exactly as left
(next-hearing purpose, the unset date, the composed text) — nothing in the
draft was lost by the round trip. "Back to the complaint" still navigates to
`/employee/cognizance/{id}` as it always did. Not verified: 375px and dark
mode for this specific change (`OrderCaseFile` is desktop-only by the owner's
own earlier instruction on the hearing composer, so parity here inherits that
scope rather than extending it).
