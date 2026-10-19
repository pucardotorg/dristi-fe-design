# Order screen E — Case history in the side panel

Prototype brief for `ORD-15` (order-generation PRD v8.1, 2026-10-19). Built on
`feature/order-panel-case-history`.

## What ORD-15 asks for

The side panel beside the order page carries three tabs: **Case file** (the case's Case
File section), **Case history** (the case history of View Case §12, the case's last order
highlighted, a filter to show only orders) and **Data flags** (not yet defined). The panel
can still be put away; a filed document still opens in the panel itself (`ORD-16`).

## Behaviour built

- Screen E's panel shows **Case file · Case history · Data flags**, in that order. The old
  Overview and Hearings tabs are gone from E only; screens A–D keep their panels.
- **Case history** is one list in the order things happened, **oldest first**, on a timeline:
  - the court events the hearing overview's Case history already shows (the event
    catalogue: Case Filed, Cognizance Taken, Summons Issued, …), with their existing links;
  - **each order passed at a sitting**, from the sittings record the Hearings tab read,
    with the order's text.
- The **last order** (the newest order in the list) sits on a sunken well with a
  *Last order* badge and the timeline's current mark. The tab **opens scrolled to it**
  (about a third of the way down the panel), so what came before is above and anything
  that happened after it is below. It is often not the latest entry.
- **Show**, a searchable multi-select of event types (the court filters' chip dropdown),
  is pinned at the top of the tab. Nothing picked shows everything; picking *Orders* shows
  only orders. The options are the types this case actually has: Orders, Applications,
  Documents, Process, Parties, Case filing (and *Other events* for an untyped event).
  Changing it scrolls back to the last order.
- **Long orders**: an order's text is shown in full up to **240 characters**. Longer, it
  is cut at the last word before 240 characters with an ellipsis, followed by
  **Read the full order**, which opens the order **in the panel itself** (the way a filed
  document does under `ORD-16`), with *Back to case history* and Escape returning focus to
  the link it came from. 240 characters is about four lines at the panel's width.
- Orders that are documents in the case file (cognizance, summons) have no text in the
  record; they show **Open the order**, which opens that order's page of the case file's
  Orders PDF in the panel.
- **Data flags**: an honest empty state — not yet defined.

## Data

Events come from `caseTimeline` and orders from `hearingSittings`
(`lib/employee/hearing-overview.ts`), both demo data already in the app. The demo case
with a full set is the hearing `h-241`.

**Example events added for this prototype** (owner, 2026-10-19), on `h-241` only, so the
last order is not the latest thing: *Application - Exemption from appearance onboarded*
(27 Aug 2026) and *Document - Original bank return memo filed* (3 Sep 2026), in
`EXAMPLE_LATER_EVENTS` in `lib/employee/order-case-history.ts`. Nothing else reads them.

## Open

- **Which sittings count as orders.** A sitting recorded as an update with no order passed
  (`directed: false`) is left out of Case history: it is neither an order nor an event in
  the catalogue. Whether such sittings belong in the history is the owner's call.
- **The real order.** For sittings' orders the full view is the order's text on a page;
  the signed PDF of each order is not in the demo data. Built for real, *Read the full
  order* opens the signed order.
- **The cut-off** (240 characters) is a judgment, not a requirement.
- **Event types.** The catalogue's own types are not in this build; the six types are
  assigned here per event. The real list should come from the event catalogue.
- **Data flags** content is undefined (`ORD-15`).
