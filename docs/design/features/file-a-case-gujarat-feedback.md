# File a case: Gujarat design-validation feedback
Updated: 2026-10-31
Status: in progress

Design-validation feedback on the File a case flow, raised by the Gujarat High Court and
assigned to Neer (Owner, shared with Mohit) in the Coda Design Validation Feedback
Tracker. Branch: `revamp-file-a-case` (first named `revamp-file-a-case-complaint`), from
`origin/main` at 2157a236.
Review page with today/proposed mock-ups of all eight items:
https://claude.ai/artifact/GU2NCBwad8Qu45bVuTtDLF
PR #177 review (Anshumanth, changes requested 2026-10-30), shown as this-PR / his-ask
mock-ups: https://claude.ai/artifact/JmbXiRjdTvobUz2BRLzeev

## Current outcome

| # | Feedback | Where | State |
|---|---|---|---|
| 11 | Flag which required fields are pending after moving on | Every filing section | Revised after PR review (2026-10-31); checked on screen |
| 6 | Name as on the verified ID, not the cheque | Complainant | Labels reverted after PR review (2026-10-31); checked on screen |
| 32 | Neutral email placeholder (domain.com) | Every email field in the product | Widened after PR review (2026-10-31); example still to agree with Anshumanth |
| 12 | Find advocates by mobile number too | Advocate | Built and checked on screen; error copy fixed after PR review (2026-10-31) |
| 9 | Pre-fill the filing advocate's own details | Advocate | Revised after PR review (2026-10-31); checked on screen |
| 13 | "Add complainant / accused" hard to find | Complainant, Accused | Revised after PR review (2026-10-31); checked on screen |
| 56 | Oath to cover later submissions | Sign · Record your oath | Waiting on court wording |
| 40 | Language switch for the oath text | Sign · Record your oath | Moved onto the top bar's shared switch after PR review (2026-10-31); checked on screen; Gujarati text awaited |

### #11 as built
- When a person leaves a section with required fields empty, the Sections list shows a
  count in place of the tick ("3", read as "3 to fix"). It reuses the count bulk filing
  already shows for problems to fix, so one mark means one thing across the product.
- Errors show only after Continue (PR review, 2026-10-31). Continue with required fields
  empty marks each one in error with a short instruction ("Enter the age."). Errors clear
  as fields are filled. Opening a section, coming back to it through the Sections list or
  Back, and adding a party or advocate show nothing in red, even after Continue: a row
  added after Continue starts clean. Leaving the section forgets its errors.
- Before the review, coming back to a section showed its errors too, which put a new
  advocate's card in red the moment it was added.
- On the section on screen, the Sections list counts the errors Continue is showing; on a
  section left behind it counts every empty required field, as before.
- A section is ticked only when every field marked with an asterisk is filled.
- Continue on a section with required fields empty stays on it, shows the errors, and
  moves the cursor to the first empty field, scrolled to the middle of the screen. The
  Sections list and Back still move freely. Code:
  `apps/dristi-app/src/components/filing/filing-footer.tsx`, `lib/filing/store.tsx`.
- On a phone the Sections list is a sheet behind a "Sections" button, so the button
  carries the total to fix beside "Step N of 12", and while it has one it does not shrink
  to its icon. Without this the counts sit in a sheet nobody has a reason to open.
- Bulk filing and scrutiny corrections keep their own checks and are not affected.
- Code: `apps/dristi-app/src/lib/filing/missing.ts` (which fields are missing, with
  tests in `missing.test.ts`), `lib/filing/store.tsx` (what Continue found empty),
  `components/filing/form-field.tsx` (the field error),
  `components/filing/sections-rail.tsx` (the count).

### #6 as built
- The labels read "Full name" (complainant, company representative) and "PoA holder
  full name", as on `main`. From 2026-10-30 they read "… as on government ID"; reverted
  on 2026-10-31 at Anshumanth's review: the court objected to the placeholder, not the
  field name.
- The complainant name's placeholder "As printed on the cheque" is removed: it told
  filers to do the opposite of what the court asked.
- Not changed: the accused's and witnesses' names (the filer may not know their ID
  name), and the scrutiny officer's view of the filing.
- Code: `apps/dristi-app/src/components/filing/sections/complainant-section.tsx`.

### #32 as built
- Every email field in the filing shows `name@domain.com`: complainant, company,
  representative, accused and witness contacts, the people summoned for an entity, and
  the advocate's profile.
- Replaced along the way: `optional@example.com`, `name@example.com`, `you@example.com`,
  and the witness field's `ex: xyz@gmail.com`, which named a real company's domain, the
  exact concern the court raised. The case page's "Add witness" form copies the filing's
  witness form and is changed with it.
- Since the PR review (2026-10-31) registration (`lib/registration/content.ts`) and the
  court staff's evidence screen (`components/employee/evidence-view.tsx`) show
  `name@domain.com` too, so every email field shows one example. Which example to use is
  still to be agreed with Anshumanth; changing it is a find-and-replace.

### #13 as built
- Before: "+ Add complainant" and "+ Add accused" sat only at the end of the tab row at
  the top of the section. The row does not stick, so after a long party form the filer
  had to scroll all the way back up.
- Now an outlined "+ Add another complainant" / "+ Add another accused" button sits
  below the last card, outside any card, the same as "Add another advocate" on the
  Advocate page (PR review, 2026-10-31). Pressing it opens the new party's tab, puts
  focus on that tab and returns to the top of the form. The tab row keeps its button.
  Hidden in a scrutiny correction round, as the row's button is.
- It replaces the "… on this filing" card (option E, 2026-10-30), which listed the parties
  again and read as part of the first party's details.
- Code: `apps/dristi-app/src/components/filing/add-party-button.tsx` (`AddPartyButton`),
  used in `complainant-section.tsx` and `accused-section.tsx`. `party-roster.tsx` is
  removed.

### #9 as built
- Before: a new filing already copied the signed-in person's profile into Advocate 1,
  but the Advocate screen showed an advocate only if the demo register listed them. The
  sample drafts' advocates and most profiles are not on it, so the card read as an empty
  search box although the draft held the advocate. This is what the court saw. It also
  copied a name with no bar number, so a litigant could land in the advocate row.
- Now an advocate signed in and starting a filing finds Advocate 1 already showing their
  name and bar number, with Change to replace it. Any advocate the draft holds is shown,
  in the register's spelling where the register lists them.
- Only a person with a bar number is pre-filled. A litigant or clerk starts with an
  empty card.
- It fills once, when the filing is created. An advocate who removes themselves is not
  put back; "Use my details" appears on an empty card for them instead, and nowhere once
  they are on the filing.
- The demo behaves as if connected (PR review, 2026-10-31). Signed in as the demo
  advocate, the profile is known with her bar number (K/1188/2011, the one the sample
  drafts give her, shown as G/… on Gujarat), so every new filing opens with Advocate 1
  filled and no setup. Details saved from the header avatar win; the litigant and clerk
  profiles and any other account get nothing. Before, the profile was empty unless
  someone typed a bar number into it, so the pre-fill never showed in a demo.
- Side effect: signing now marks the demo advocate as "you" on drafts listing
  K/1188/2011, the sample drafts included, as a connected session would.
- The profile is read in the selected court's terms, as a draft is. Without this, on
  Gujarat the profile's K/1188/2011 never matched the draft's G/1188/2011, so "Use my
  details" showed on Advocate 2 while she was already Advocate 1 (found on screen,
  2026-10-31).
- Applies in every state: the pre-fill already existed everywhere and this makes it
  work; nothing in it is specific to Gujarat.
- Code: `apps/dristi-app/src/lib/filing/profile.tsx` (`asDemoAdvocate`, `DEMO_ADVOCATE`,
  read through `useProfile()`; tests in `sample-drafts.test.ts`),
  `lib/filing/blank.ts` (`blankAdvocate`, `isAdvocateProfile`, tests in `blank.test.ts`),
  `components/filing/sections/advocate-section.tsx`.

### #12 as built
- Before: the advocate search matched name and bar number only.
- Now the same search box also finds an advocate by mobile number. The placeholder reads
  "Name, bar number or mobile". "+91 90000 10421", "090000-10421" and "9000010421" are
  read as the same number.
- A mobile number matches only when it is complete. Part of a number finds nobody, and
  the results show name and bar number, never the mobile. Otherwise anyone filing could
  type a few digits and read advocates' phone numbers off the list.
- Parts of a name or bar number still match as before.
- The empty-field error says "Find the advocate by name, bar number or mobile.", to match
  the placeholder (PR review, 2026-10-31).
- Applies in every state: it is one search box shared by all of them.
- The demo register now carries a mobile number for each advocate (90000 1 followed by
  the middle of the bar number, e.g. K/0421/2004 → 9000010421). The real register must
  hold mobile numbers and keep the full-number rule on the server.
- Code: `apps/dristi-app/src/lib/filing/registry.ts` (`searchAdvocates`,
  `asMobileQuery`, tests in `registry.test.ts`),
  `components/filing/sections/advocate-section.tsx` (placeholder).

### #40 as built
- Before: the oath's words followed only the site's language switch in the top bar,
  which changes the whole page.
- Now "Say these words" uses the top bar's language switch, made a shared component
  (PR review, 2026-10-31): English beside a second language, with a menu for which
  second language that is. It lists the second languages the state's `oathLanguages`
  allows; with only one (Gujarat), the menu has nothing to offer and is left out. It
  changes only the words to be read on camera; the rest of the page stays as it is. It
  starts on the language already sworn in, else the site's language, else English.
- From 2026-10-30 to 2026-10-31 it was a fixed two-option switch of its own, which could
  never offer more than two languages.
- Each language is named in its own script on the switch, and the words carry the right
  language mark for screen readers.
- The Gujarati wording has not come from the court yet. Choosing ગુજરાતી shows "The
  court has not provided the Gujarati wording yet. Choose English to record now." and
  offers no recording until the text exists. When the court sends it, it goes into one
  place (`OATH_WORDS` in `oath-capture.tsx`) and the switch works with no other change.
- The switch is locked while recording, so the words cannot change mid-oath. The
  recording saves the language it was sworn in, shown under it as "Sworn in English",
  so the court knows which wording was used.
- Gujarat only: each state lists its oath languages on its court profile
  (`oathLanguages`). Kerala and Punjab & Haryana list English alone and show no switch;
  neither asks for an oath at signing today.
- Fixed along the way: "Recording as Nasreen K.." printed a second full stop after a
  name ending in one.
- Code: `apps/dristi-app/src/components/shell/language-toggle.tsx` (`LanguageToggle`,
  shared with `top-bar.tsx`), `components/filing/oath-capture.tsx`,
  `lib/court/profiles.ts` (`oathLanguages`), `lib/filing/types.ts`
  (`OathVideo.language`).

## Decisions

| Date | Decision and reason | Source | Status |
|---|---|---|---|
| 2026-10-30 | Work only the eight tracker rows still open for Neer. Checked first that Mohit had not done them: his work since 28 Oct is the shared feedback-states rollout, which does not touch these fields. | Neer asked for the check; Coda, Figma section 604:2, git history | Confirmed |
| 2026-10-30 | Review everything as a standalone mock-up page before building, and build one item at a time. | Neer | Confirmed |
| 2026-10-30 | #11: show a number instead of the tick on a section left with fields missed; opening the section again shows the missed fields in red. | Neer's own approach | Confirmed |
| 2026-10-30 | #11: count every field marked with an asterisk, not only the ones the tick used to need. The section's tick ignored fields such as Age and Pincode even though the form marks them required, so the count would otherwise contradict the form. | Neer chose this over "only what blocks the tick" | Confirmed |
| 2026-10-30 | #11: do not change what blocks submitting the filing. Counting more fields is a signal to the filer, not a new legal requirement; making Age or Pincode mandatory for filing is a separate decision. | Neer chose this over "every asterisk, and block submit" | Confirmed |
| 2026-10-30 | #11 applies in every state, not only Gujarat. It is a general usability fix with no state-specific or legal meaning. Normally feedback applies only to the state that raised it. | Neer | Confirmed |
| 2026-10-30 | #11: Next stops on a section with required fields empty, shows them, and moves focus to the first one. The Sections list and Back stay free, so nobody is trapped and people who move around by the list still get the count. | Neer, comment on the review page | Confirmed, built (see below) |
| 2026-10-30 | #11: a filing cannot be submitted while any required (asterisk) field is empty, however the filer moved through the sections. This reverses the earlier "leave submitting unchanged": a field marked required has to mean required, otherwise the Sections list becomes a way round Continue. Today's submit check is narrower than the asterisks (Age, Pincode and others slip through), so the gate must use the same list as the counts. | Neer | Parked under "no new things" (see Open) |
| 2026-10-30 | #11: the overall pattern combines what mature form products do. Continue checks its own section (step-by-step wizard), the Sections list stays free with a count per section (task list with status), and Preview is the final gate (check-everything page). Buttons are never greyed out; a blocked press explains what is missing. | Recommendation after Neer asked for industry patterns | Proposed |
| 2026-10-30 | #11: build no new screens or controls. The existing Preview step ("N sections incomplete", with links, before signing) is the final gate; it only needs to check the same required fields as the counts. Continue stops and moves focus to the first empty field, using the existing field errors; the summary list at the top of a section, proposed above, is dropped. | Neer: "let's not complicate the build by building new things" | Confirmed, not yet built |
| 2026-10-30 | #11 scope check: the court asked to flag a section left with a field missing and to show which field is pending. Both are built. Stopping at Continue and widening the Preview check came from our own discussion, not the feedback. Recommended: close #11 as built and park those two as open questions. | Neer asked what #11 actually asked for | Superseded: Neer kept the Continue stop |
| 2026-10-30 | #11: build "Continue stops on missing fields" after all. The scope check above was right that the court did not ask for it, but Neer had already decided it (review-page comment) and reaffirmed it: Continue should not move a filer past empty required fields. The Preview check stays as it is for now, per "no new things". | Neer | Built |
| 2026-10-30 | #11 final shape, after weighing removal of the Continue stop: keep it. Continue with required fields empty highlights them and does not move on; choosing another section from the list is allowed and leaves the number of missing fields on the section left. Before this build Continue always moved on and the list showed only a tick or a dashed ring; the original design left checking to the Documents step and Preview, with no recorded reason for not checking at Continue. | Neer | Confirmed, built |
| 2026-10-30 | #11: the count uses the yellow "to fix" mark bulk filing already uses, with red field errors, the same pairing bulk filing has. | Implementation choice | Open to change |
| 2026-10-30 | #11: an untouched blank witness is not flagged. Witnesses are optional and every new draft opens with one blank witness card, so flagging it would put a count on a section the filer was allowed to skip. | Implementation choice | Open to change |
| 2026-10-30 | #11: an advocate counts as present when the draft holds a name and bar number, the same rule signing uses. The demo register does not contain the sample drafts' advocates, so checking against it would flag every sample. | Implementation choice | Open to change |
| 2026-10-30 | #6: say "as on government ID" in the label itself rather than in a hint line below it. The label is read on every visit and by screen readers; a hint is easy to skip, and the court wanted it unmissable. | Proposed on the review page; Neer asked to build it | Confirmed |
| 2026-10-30 | #6 applies in every state. It is clearer for any filer and has no state-specific meaning. | Neer | Confirmed |
| 2026-10-30 | #6: remove the "As printed on the cheque" placeholder, which contradicted the court's point. Accused and witness names keep "Full name", since a filer cannot be expected to know someone else's ID name. | Implementation choice | Open to change |
| 2026-10-30 | #11 on phones: put the total to fix on the Sections button and keep the button full width while there is one. On a phone the counts live in a sheet, and nothing outside it said anything was wrong. | Neer asked to fix #11 for phone; the treatment is an implementation choice | Built |
| 2026-10-30 | #32: use `name@domain.com` in every email field of the filing, not only the four the tracker card listed. The witness field used a real company's domain (gmail.com), which is the concern the court raised; one example everywhere also reads as one product. Applies in every state, in line with Neer's calls on #6 and #11. | Neer asked to build #32; the wider scope is an implementation choice | Built, open to change |
| 2026-10-30 | #13: repeat the Add button after the last card rather than a floating "+ person" icon or a sticky tab row. A wordless icon does not say what it adds, cannot be named by voice-control users, covers fields on a phone, and has no DS component. A sticky row would stack a third band on the phone screen (top bar, Sections button, tabs) for a button needed only when a party is finished, at the foot of its form. | Neer agreed to the proposal | Confirmed, built |
| 2026-10-30 | #13: the end-of-form button becomes a visual tile in the brand language, for more prominence than a plain outline button. Built from the DS Button: the dashed edge is the DS's "slot to fill" (an empty document slot), the brand appears in the tinted mark and on hover, and there is no solid fill or explanatory subtitle, so Continue stays the screen's one strong action. Label reads "Add another …" at the end of a form. | Neer asked for a more prominent visual card; the treatment is an implementation choice | Built, then rejected |
| 2026-10-30 | #13: the dashed tile is rejected ("looks ugly"). Seven variations are laid out for Neer to choose from before anything more is built: plain button, the rejected tile, the next complainant's card (recommended), a divider with a button, a list of who is on the filing, a brand strip, and a row of people. The app keeps the rejected tile until he picks. https://claude.ai/artifact/JirPKstdV47ijp64p1QCAi | Neer | Decided: E |
| 2026-10-30 | #13: option E chosen, a card listing who is on the filing with Add under it. It gives the filer context (who is already added, and whether each is complete) at the moment they decide whether to add another, and reuses the form's own card and the Sections list's status words. Accepted cost: it is the heaviest of the seven. | Neer | Confirmed, built |
| 2026-10-30 | #13 covers Complainant and Accused only, the two the court named. Cheque, Demand notice and Witnesses use the same tab row and are left as they are. | Neer | Confirmed |
| 2026-10-30 | #9: the court wants the signed-in advocate's details already filled in when they file. Fill Advocate 1 automatically, no click. | Neer | Confirmed, built |
| 2026-10-30 | #9: pre-fill only a person with a bar number, and only once, when the filing is created. A clerk or litigant has no bar number, which settles the open clerk question without a new rule; filling once means an advocate who removes themselves is not put back. | Implementation choice | Built, open to change |
| 2026-10-30 | #9: show any advocate the draft holds, not only those on the demo register. Without this the pre-fill, and every sample draft, read as an empty search box. It fixes a fault already on `main`. | Implementation choice | Built |
| 2026-10-30 | #12: add mobile number to the one advocate search box rather than a separate field, matching how name and bar number already share it. | Neer asked to build #12 | Built |
| 2026-10-30 | #12: match a mobile number only when all ten digits are typed, and never show it in the results. Partial matching would let any filer collect advocates' phone numbers digit by digit; someone with the whole number learns nothing new. | Recommendation, built without an explicit answer from Neer | Built, open to change |
| 2026-10-30 | #40: build the oath language switch now, before the court's Gujarati text arrives. This reverses the recommendation to wait: Gujarati is offered and marked as awaited, and recording waits for its text. | Neer | Built |
| 2026-10-30 | #40: Gujarat only, set per state on the court profile. Feedback applies to the state that raised it; the other states do not ask for an oath today. | Implementation choice, per Neer's standing rule | Built, open to change |
| 2026-10-30 | #40: save the language with the recording and lock the switch while recording, so the court can tell which wording was sworn. | Recommended on the review page | Built |
| 2026-10-30 | #40, #56: the oath wording and its Gujarati translation must come from the High Court through PUCAR. We do not draft legal wording or translate an oath ourselves; the review page shows only where the text goes. | Recommendation | Awaiting court text |
| 2026-10-31 | #11: errors show only after Continue, on the fields it found empty. Opening or coming back to a section, and adding a party or advocate, show nothing in red; the skipped-section count stays. Reverses "coming back shows the missed fields in red" (2026-10-30). | Anshumanth, PR #177 review; Neer asked to build it | Built |
| 2026-10-31 | #6: labels back to "Full name" / "PoA holder full name"; the cheque placeholder stays removed. Reverses "say 'as on government ID' in the label" (2026-10-30): the court objected to the placeholder, not the name. | Anshumanth, PR #177 review; Neer asked to build it | Built |
| 2026-10-31 | #13: an outlined Add button after the last card, as on the Advocate page, replaces the "on this filing" card (option E). The card repeated the tabs and Sections list and sat at the wrong level. | Anshumanth, PR #177 review; Neer asked to build it | Built |
| 2026-10-31 | #9: the demo advocate account carries a bar number and the pre-fill uses the signed-in demo advocate, kept in `useProfile()`. | Anshumanth, PR #177 review; Neer asked to build it | Built |
| 2026-10-31 | #9: reuse K/1188/2011, the bar number the sample drafts and tests already give the demo advocate, rather than inventing another. | Implementation choice | Built, open to change |
| 2026-10-31 | #9: read the profile in the selected court's terms, as drafts are, so the signed-in advocate matches their own row on every court. | Implementation choice, fixing a fault found on screen | Built |
| 2026-10-31 | #12: the advocate field's error names mobile as well. | Anshumanth, PR #177 review | Built |
| 2026-10-31 | #32: registration and the court staff evidence screen use `name@domain.com`, so every email field matches. The example itself is still to be agreed with Anshumanth before merge. | Anshumanth, PR #177 review; the choice of `name@domain.com` is an implementation choice | Built, example open |
| 2026-10-31 | #40: Anshumanth asked to reuse the top bar's language switch (`LanguageToggle`) for the oath. Held back at first because Neer was unsure the review mock-up was right; then built as Anshumanth described it. | Anshumanth, PR #177 review; Neer asked to build all his asks as he wants them | Built |
| 2026-10-31 | #40: the shared switch leaves out its menu when there is only one second language to offer, since it has nothing to choose. Gujarat's oath (English, Gujarati) therefore shows the two-option switch without a chevron. | Implementation choice | Built, open to change |

## Changes and tradeoffs

- **#11, numbers versus a summary list.** The tracker card asked to "list what is
  pending". We show the list in place: the fields themselves are marked when the
  section is opened, rather than in a separate summary that the filer then has to
  match to fields. Since 2026-10-31 they are marked when Continue is pressed,
  not when the section is opened.
- **#11, blocking.** The first mock-up kept Next moving and only left the count, on the
  reading that the court asked for a flag, not a block. Neer reversed this on the
  review page: stopping at Next with the errors shown is clearer, while the list
  stays free for people who choose to move around.

## Verification and open work

Checked on 2026-10-30 on `revamp-file-a-case`, DS at the pin (e0cadea6b9d4):
- New `missingRequired` tests (10) and the whole app suite (1,450 tests at commit) pass.
- Changed files pass type checks and lint; token, UI-sync and table-row checks pass.
- The full UI check still fails on code this branch does not touch, failures already
  on `main`: lint in `src/provakil/`, typography in `mobile-hearing-card.tsx`, spacing in
  `profile-settings.tsx` and `poa-join-fields.tsx`.
- Checked on screen on the running app (localhost:3000, serving this checkout, Gujarat
  skin), headless Chromium:
  - #11 at 1440px, light: no errors on a first visit; after leaving Complainant with the
    name filled, the list shows "Complainant 7 to fix"; coming back shows all seven
    field errors; typing the age clears its error and the count drops to 6. A sample
    draft filled to the end shows ticks only, no false counts.
  - #6 at 1440px and 375px, light and dark: the new label renders, sits level with Age
    on desktop, wraps cleanly on a phone; no cheque placeholder remains.
  - #11 at 375px, light and dark: after Continue from a Complainant with fields empty,
    the Sections button reads "Step 2 of 12" with a 7; the sheet shows Complainant 7;
    going back through the sheet shows the seven errors and the button reads 8
    (Complainant 7, Advocate 1).
  - #32: the complainant, accused and witness sections all render `name@domain.com`.
  - #11 Continue at 1440px and 375px: on Complainant with the name filled, Continue
    stays, shows 7 errors and focuses Mobile number, centred on screen; the Sections
    list still moves to Advocate; a complete Complainant (sample draft) continues to
    Advocate as before.
  - #13 (option E) at 1440px and 375px, light and dark, Complainant and Accused: the card
    lists "Nasreen K. · Complete" (accused "Juned M. · Complete"); Add appends
    "Complainant 2 · Not started", focus lands on the new tab, and the form is back at
    the top.
  - #9 at 1440px: the sample draft shows its advocate instead of an empty box; a new
    draft for an advocate opens with Advocate 1 filled and no "Use my details"; Change
    leaves an empty card with "Use my details"; a new draft for a person without a bar
    number opens empty with no button. New `blankAdvocate` tests (3) and the filing
    suite (124 tests) pass.
  - #12 at 1440px: the placeholder reads "Name, bar number or mobile"; "900001" finds
    nobody; "+91 90000 10421" finds one advocate shown by name and bar number only, and
    picking them fills the card. New register tests (4) and the filing suite (128
    tests) pass.
  - #40 at 1440px and 375px, Gujarat, complainant's sign link on a sample draft after
    Aadhaar OTP: the switch shows English / ગુજરાતી, the words carry `lang="en"`;
    choosing ગુજરાતી shows the awaited message and no recording option. Court and
    filing tests (158) pass.
- Not yet checked on screen: keyboard focus order around the new errors; #40 "Sworn in"
  line after a real recording (the camera cannot run headless); #40 in dark mode.
- #40: the app loads no Gujarati font and relies on the device's. The DS asks product
  apps to add a Noto font for each Indic script they serve; needed before the Gujarati
  oath ships.
- Found while checking #13, already on `main`, not changed: a newly added complainant's
  tab shows a green "Complete" dot although every field is empty (its dot reflects only
  the "to review" flag). It now disagrees with the #11 count.
- The review was the builder's own, not independent.

Checked on 2026-10-31 after the PR review fixes, on `revamp-file-a-case` (uncommitted,
on top of 166460a4), DS at the pin (e0cadea6b9d4):
- App suite: 1,453 tests pass, including three new `asDemoAdvocate` tests.
- Changed files: no type errors, no new lint warnings. The full UI check fails only on the
  files listed above, as before.
- The dev server stopped answering for a while and was restarted by Neer; nothing was
  touched from here.
- Checked on screen (localhost:3000 serving this checkout, Gujarat, headless Chromium):
  - #11 at 1440px: a new filing's Advocate opens with no errors; Add another advocate
    shows none; Continue stays, shows one error on Advocate 2 and focuses its search;
    an advocate added after Continue starts clean; the Sections list shows "Advocate 2 to
    fix" from Complainant; coming back through the list shows no errors. A newly added
    complainant shows none. At 375px dark, Advocate opens with none.
  - #12: the error reads "Find the advocate by name, bar number or mobile."
  - #6 at 1440px: "Full name"; "government ID" appears nowhere on Complainant.
  - #13 at 1440px light and 375px dark: no "on this filing" card on Complainant or
    Accused; an outlined, 40px "Add another complainant" below the last card; pressing it
    opens and focuses "Complainant 2". No sideways scroll on a phone.
  - #9 at 1440px: a brand-new filing opens with Anjali Parmar, G/1188/2011 as Advocate 1;
    after the court-terms fix, no "Use my details" with one or two advocates.
  - #40 at 1440px light and 375px dark, complainant's sign link after Aadhaar OTP: the
    oath shows English / ગુજરાતી in the shared switch with no menu; the words carry
    `lang="en"`; choosing ગુજરાતી shows the awaited message and no recording option. The
    top bar's switch still offers हिन्दी, ગુજરાતી and ਪੰਜਾਬੀ and switches the page.
- Not checked on screen: #32 on registration and the court staff evidence screen (one
  placeholder string each); keyboard order beyond the focus checks above.
- Open from the review: whether an advocate the register does not list should show only
  for the signed-in advocate (#9), and the email example (#32).

Open:
- The Preview step checks fewer fields than the asterisks mark (Age, Pincode and others),
  so a filer who skips them by way of the Sections list can still reach signing. Neer's
  rule is that required fields must be filled before filing; closing this gap is a
  change to an existing check, not a new screen, and is parked until he asks for it.
- #12 in the real product: the advocate register needs mobile numbers, and the
  full-number rule must be enforced by the server, not only this screen.
- #40, #56: court wording and Gujarati translation. Ask for the final English wording
  (with #56's clause) first, then its Gujarati, so it is not translated twice.
- #9 in the real product: the pre-fill reads the profile kept in this browser;
  engineering must point it at the signed-in session's advocate record.
- Coda tracker rows not yet updated.
