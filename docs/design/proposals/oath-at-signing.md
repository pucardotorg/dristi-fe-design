# Oath at signing — brief

**Date:** 2026-10-19 · **Source:** `efiling-handover.md` v46 §18 / §18.2 (`SIG-05`, `SIG-07`,
`SIG-08`, `SIG-10`, `OTH-1` to `OTH-5`) and `scrutiny-registration-handover.md` v3.2
(`SCR-14`, `SCR-15`). The handovers decide the behaviour; this brief only says how the
prototype shows it.

## What changes

1. **Who records an oath** (`OTH-3`). One oath per complainant, taken by whoever signs for
   them: the complainant, their PoA holder, or an Institution's authorised representative.
   Advocates and clerks never record one. Previously every advocate swore too.
2. **Recorded, never uploaded** (`OTH-1`). The oath step offers the camera only; the
   recorder stops at 2 minutes. The "Upload a video" card and the re-upload link go.
3. **Upload mode confirms on the party's own device** (`SIG-05`, §18.3). The uploader's
   window no longer takes anyone else's OTP: each other party gets a link, enters their
   OTP there and, where the state has the oath, records it there. A party at the uploader's
   own keyboard (the filer is a complainant) confirms in place, which is their own device.
   A confirmation is complete only with its oath (`OTH-3` `[DERIVED]`).
4. **Carried over on correction** (`OTH-5`). Starting a correction round no longer wipes
   oaths. Only a flagged oath is cleared and recorded again.
5. **Scrutiny** (`SCR-14`, `SCR-15`). The oath group lists one row per complainant: whose
   oath, who recorded it, when. Selecting the row plays the recording in the centre
   panel. Each row is flagged on its own with a comment, through the ordinary field flag.
   After a correction round an oath that was not recorded again says it carried over, with
   its date. A paper-signed case shows why it was signed on paper and when that reason was
   given.
6. **The switch** (`OTH-2`, `Q-6`). `signing.oath` stays per court in `lib/court/profiles.ts`
   and is the only switch; the step label ("Sign and oath" / "Sign") now follows it. The
   values in the profiles are prototype settings, not a decision about which states have
   the oath.

## Not done here

- The filer-side correction fixtures cannot yet carry an *oath* defect (defect targets are
  fields and documents). The carry-over rule is in place and clears exactly the oaths it is
  told were flagged; wiring a scrutiny flag through to the correction queue is a follow-up.
- Oath wording: the step now shows the handover's placeholder affirmation (§18.2), which
  is itself marked `[GAP]` until the court-prescribed text is confirmed.

## Acceptance

- No form section, sidebar entry or upload control for the oath anywhere in the filing.
- E-sign: a complainant (or PoA holder / representative) at the keyboard is asked for the
  oath after their signature; an advocate is not.
- Upload: the uploader's window shows each other party as "link sent / waiting /
  confirmed"; the link page asks for the OTP and then the oath; submit waits on all.
- With `signing.oath` off, no oath appears at signing or at scrutiny.
- Scrutiny shows per-complainant oath rows that play, flag, and say "carried over".
- Scrutiny shows the paper-upload reason and its time on a paper-signed case.
