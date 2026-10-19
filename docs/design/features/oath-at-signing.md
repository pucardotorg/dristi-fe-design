# Oath at signing
Updated: 2026-10-19
Status: implemented — desktop render checked; review not independent

## Current outcome

The prototype follows e-filing handover v46 §18 / §18.2 and scrutiny handover v3.2
`SCR-14`, `SCR-15`. Brief: [`proposals/oath-at-signing.md`](../proposals/oath-at-signing.md).

- Only a complainant's slot carries an oath, taken by the complainant, their PoA holder or
  an Institution's representative (`OTH-3`). Advocates sign and nothing more.
  `lib/filing/selectors.ts` (`signatories`, `oathTakerName`, `oathTakerRole`).
- Recorded through the camera only, stopping at 2:00 (`OTH-1`); the upload option is gone.
  `components/filing/oath-capture.tsx`, `oath-recorder.tsx`.
- Upload mode: each other complainant confirms by OTP on their own device via the link and
  records the oath there (`SIG-05`, `OTH-3`); the uploader's window shows link status only,
  except for the uploader's own row. `sign-flow-dialog.tsx`, `sign-link/sign-link-screen.tsx`.
- Correction round keeps oaths unless flagged (`OTH-5`, `carryOverOaths`);
  `scrutinyReturn.signingFrom` marks when the round's signing opened.
- Scrutiny: one oath row per complainant with who recorded it and when, plays in the centre
  panel, flagged on its own; "Carried over from an earlier round" note; paper-upload reason
  and time on paper-signed cases. `lib/employee/scrutiny/from-draft.ts`, `bundle-view.tsx`.
- The step label "Sign and oath" follows `signing.oath` in every court, Kerala included.

## Decisions

Date | Decision and reason | Source | Status
--- | --- | --- | ---
2026-10-19 | Oath per complainant, never advocate; recorded not uploaded; 2-minute stop | Handover `OTH-1`, `OTH-3` | implemented
2026-10-19 | Upload-mode OTP moves to the party's own device; oath recorded there | Handover `SIG-05`, §18.3 | implemented
2026-10-19 | Oath flag uses the ordinary field flag with a comment, not the document-issue flag (no re-upload applies) | Coordinator judgment | implemented
2026-10-19 | `signing.oath` values in court profiles kept as prototype settings, not a state decision; `signWithOath` removed so one switch drives label and behaviour | Handover `OTH-2`, `Q-6` | implemented

## Changes and tradeoffs

- A scrutiny flag on an oath cannot yet reach the filer's correction queue: defect targets
  are fields and documents. `carryOverOaths` takes the flagged list; the correction screen
  passes an empty one today. Follow-up.
- Sample filings have no real recordings; the centre panel says so instead of showing a
  stand-in video.

## Verification

- `npm test` (app suite): 1237 pass, 0 fail. `check:tokens`, `check:ui-sync`,
  `check:rails` pass. `check:typography` fails on `advocate/mobile-hearing-card.tsx:91`,
  untouched by this branch (pre-existing on main).
- Desktop render on port 3011 (Gujarat): scrutiny 00338 oath row, carried-over note,
  centre-panel recording frame, flag with comment; 00341 paper reason; filing Sign step
  (advocate "Done", no oath owed); paper stage link rows; link page Confirm by OTP → Oath.
- Not checked: actual camera recording in the pane, 375px and dark theme (desktop-only by
  owner preference).
