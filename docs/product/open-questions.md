# Open questions (product lens)

These docs intentionally stay on the **domain / reference** side of the line. The items
below are **not answered** by the product docs or the domain snapshot. Do not invent answers
in orientation docs until PUCAR confirms them.

## Users and personas

- Who logs into DRISTI in each state deployment?
- Which domain actors are in-product users vs external counterparts?
- Are primary users advocates, court staff, institutional filers, litigants, or a mix?
- How does that differ between Kerala (individual / low volume) and Gujarat (bulk institutional)?

## Product journeys and scope

- Which national §138 stages are in-product workflows vs off-platform / integrated systems?
- What is v1 scope per state (filing only, full trial support, bulk ops, etc.)?
- How does DRISTI sit relative to CIS, eCourts, NJDG, NSTEP for each role?
- Joining a case, shared vakalatnama: the first advocate names and pays for the others,
  who are recognised and let in without paying. If an advocate is added by mistake, how
  is their access undone? An accept-the-invite step and removal before acceptance were
  suggested and deferred (owner, 2026-10-13); today the only route is a support ticket.
- Bulk filing, changing a batch's complainants or advocates after it is created: the
  Bulk Filing PRD sets them once for every case at creation (`BLK-04`, `BLK-05`), then
  lets each case change its own, without touching the others (`BLK-06`). It does not
  say whether one change can reach many cases (for example, a new advocate on all 50).
  If it can: does it go to every case not yet signed, or to chosen ones, and what
  happens to a case whose parties were already changed on its own? Until answered,
  Common details is editable before the batch is created and read-only after it, and
  a case's parties are changed in that case (owner, 2026-11-11).

## Evidence still needed

- Confirmed product requirements / JTBD from PUCAR (not only statutory Requirements).
- Which practice-note observations ([domain/practice-notes.md](domain/practice-notes.md))
  are in scope to design for vs background context only.

When answers exist, add a `docs/product/` layer (e.g. personas, journeys) rather than
folding assumptions into `domain/`.
