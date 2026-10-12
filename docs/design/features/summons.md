# Summons (v15)
Updated: 2026-10-12
Status: built on `feature/summons-v15`; static render checked, live route not yet rendered

## Current outcome

`/summons` renders the summons an accused person receives: v14's one-sheet, two-sided
design with the owner's review fixes, in two versions and for every court.

- **One version for paper and screen.** Every address is written in full (paper cannot
  be clicked); on screen the same addresses, phones and the join QR are also links. In
  print, links are plain black. "Please turn over" in both.
- **The state comes from the URL** (`?court=kerala|gujarat|punjab|haryana`). A real
  summons link is unique to the state that sent it. Without the param, the court picked
  in Settings stands in.
- **Court config.** Text is written in Kerala's terms and voiced through
  `localizeCourtText` (court name, places, PINs, names, case number). The sheet is
  `data-court-raw`, so the app's text layer does not voice it again. What the court
  profile lacks is in `lib/summons/content.ts`.
- **Onboarding.** "View the original summons" opens `/summons?court=<court>` instead of
  the static `Summons_v14.pdf`.

## Decisions

| Date | Decision and reason | Source | Status |
|---|---|---|---|
| 2026-10-12 | Remove "Kollam District · Kerala Subordinate Judiciary". The court is the 24×7 ON Court. | Owner review of v14 | Built |
| 2026-10-12 | One case number; the CNR is dropped. | Owner review of v14 | Built |
| 2026-10-12 | No seal: signed digitally. | Owner review of v14 | Built |
| 2026-10-12 | Print full addresses, never link text, on paper. | Owner review of v14 | Built |
| 2026-10-12 | The paper has no video link: tell the person to sign in and open the case. | Owner review of v14 | Built |
| 2026-10-12 | Not appearing does not cost the right to question the complainant. Clause removed. | Owner review of v14 | Built |
| 2026-10-12 | Fit the summons to the court config (court name, language and so on). | PM, relayed by owner | Built |
| 2026-10-12 | The language line follows the court's language: ml, gu, pa, hi. | Owner | Built |
| 2026-10-12 | Design both a print and a digital version; the state is known from the summons URL. | Owner | Superseded by the next row |
| 2026-10-12 | Print and digital read the same, so keep one version: "Please turn over" on screen too; links stay tappable on screen. | Owner | Built |
| 2026-10-12 | "Summons to an Accused Person" at 12pt, a step under the 16pt court name. | Owner | Built |
| 2026-10-12 | Live in the onboarding modal's "View the original summons", touching no other screen. | Owner | Built |

## Open

- Portal addresses, phone numbers and Bar Council sites for Gujarat, Punjab and Haryana
  (bracketed placeholders and `0000 000000` until supplied).
- Native check of the Gujarati, Punjabi and Hindi lines.
- Whether the heading should still name the magistrate's bench.
- The demo address keeps "Manakkal House" in every state (not in `HOUSE_NAMES`).
- Hearing date 18 September 2026 is v14's and now in the past.
